import {Injectable, NotFoundException, BadRequestException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, SelectQueryBuilder} from 'typeorm';
import {FacturasVentas} from './esquemas/facturas-ventas.entity';
import {AbonoDto, CreateFacturasVentasDto} from './esquemas/facturas-ventas.dto';
import {getBogotaDayBoundaries, getBogotaDateString} from '../common/utils/date.utils';
import {CajaMovimientosService} from '../caja-movimientos/caja-movimientos.service';
import {EstadisticasGateway} from '../estadisticas/estadisticas.gateway';

@Injectable()
export class FacturasVentasService {
	constructor(
		@InjectRepository(FacturasVentas)
		private readonly repo: Repository<FacturasVentas>,
		private readonly cajaMovimientosService: CajaMovimientosService,
		private readonly estadisticasGateway: EstadisticasGateway,
	) {}

	async findAll(opts: { from?: string; to?: string; page?: number; limit?: number; estado?: string; clienteNombre?: string; metodo?: string } = {}) {
		const { from, to, page = 1, limit = 50, estado, clienteNombre, metodo } = opts;

		// Apply all WHERE filters — uses explicit Bogotá offset so Alpine Docker
		// (no tzdata) gives the same result as an environment with TZ=America/Bogota.
		const addFilters = (qb: SelectQueryBuilder<FacturasVentas>) => {
			if (from && to) {
				const { start } = getBogotaDayBoundaries(from);
				const { end } = getBogotaDayBoundaries(to);
				qb.where('f.fechaFactura BETWEEN :from AND :to', { from: start, to: end });
			} else if (from) {
				const { start } = getBogotaDayBoundaries(from);
				qb.where('f.fechaFactura >= :from', { from: start });
			} else if (to) {
				const { end } = getBogotaDayBoundaries(to);
				qb.where('f.fechaFactura <= :to', { to: end });
			}

			if (estado) {
				if (estado === 'pendiente') {
					qb.andWhere('(f.estado = :estado OR f.estado IS NULL)', { estado: 'pendiente' });
				} else {
					qb.andWhere('f.estado = :estado', { estado });
				}
			}

			if (clienteNombre && clienteNombre.trim()) {
				qb.andWhere('f.clienteNombre ILIKE :clienteNombre', { clienteNombre: `%${clienteNombre.trim()}%` });
			}

			if (metodo) {
				// 'mixto' es el alias UI de efectivo_transferencia
				const m = metodo === 'mixto' ? 'efectivo_transferencia' : metodo;
				qb.andWhere('f.metodo = :metodo', { metodo: m });
			}
		};

		// Separate count query (no joins) — avoids TypeORM COUNT+leftJoinAndSelect issues
		const countQb = this.repo.createQueryBuilder('f');
		addFilters(countQb);
		const total = await countQb.getCount();

		// Data query with full joins + pagination
		const dataQb = this.repo
			.createQueryBuilder('f')
			.leftJoinAndSelect('f.ordenes', 'ordenes')
			.leftJoinAndSelect('ordenes.productos', 'op')
			.leftJoinAndSelect('f.domicilios', 'domicilios')
			.leftJoinAndSelect('domicilios.domiciliario', 'domiciliario')
			.orderBy('f.fechaFactura', 'DESC');
		addFilters(dataQb);
		const data = await dataQb.take(limit).skip((page - 1) * limit).getMany();

		return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
	}

	async findByDay() {
		const { start, end } = getBogotaDayBoundaries();
		const result = await this.repo
			.createQueryBuilder('f')
			.leftJoinAndSelect('f.ordenes', 'ordenes')
			.leftJoinAndSelect('ordenes.productos', 'op')
			.leftJoinAndSelect('f.domicilios', 'domicilios')
			.leftJoinAndSelect('domicilios.domiciliario', 'domiciliario')
			.where('f.fechaFactura BETWEEN :start AND :end', {start, end})
			.getMany();
		return result;
	}

	findPendingByDay() {
		const { start, end } = getBogotaDayBoundaries();
		return this.repo
			.createQueryBuilder('f')
			.leftJoinAndSelect('f.ordenes', 'ordenes')
			.leftJoinAndSelect('f.domicilios', 'domicilios')
			.leftJoinAndSelect('domicilios.domiciliario', 'domiciliario')
			.where('(f.estado = :pendiente OR f.estado IS NULL)')
			.andWhere('f.fechaFactura BETWEEN :start AND :end', {start, end, pendiente: 'pendiente'})
			.getMany();
	}

	async getDayStats() {
		const { start, end } = getBogotaDayBoundaries();

		const facturas = await this.repo
			.createQueryBuilder('f')
			.where('f.fechaFactura BETWEEN :start AND :end', {start, end})
			.andWhere('f.estado != :cancelado', {cancelado: 'cancelado'})
			.getMany();

		const totalDia = facturas.reduce((sum, f) => sum + (Number(f.total) || 0), 0);
		const totalPagado = facturas
			.filter((f) => f.estado === 'pagada' || f.estado === 'pagado')
			.reduce((sum, f) => sum + (Number(f.total) || 0), 0);
		const totalPendiente = facturas
			.filter((f) => f.estado !== 'pagado' && f.estado !== 'pagada')
			.reduce((sum, f) => sum + (Number(f.total) || 0), 0);

		return {
			totalDia,
			totalPagado,
			totalPendiente,
			count: facturas.length,
		};
	}

	async findOne(id: number) {
		const factura = await this.repo.findOne({
			where: {facturaId: id},
			relations: ['ordenes', 'domicilios', 'domicilios.domiciliario'],
		});
		if (!factura) {
			throw new NotFoundException(`Factura con ID ${id} no encontrada`);
		}
		return factura;
	}

	async create(data: CreateFacturasVentasDto) {
		const saved = await this.repo.save(data);
		this.estadisticasGateway.emitirActualizacionStats({ source: 'factura_create', id: saved.facturaId });
		return saved;
	}

	async update(id: number, data: Partial<CreateFacturasVentasDto>) {
		const completing = data.estado === 'pagada' || data.estado === 'pagado';

		if (!completing) {
			await this.repo.update(id, data);
			this.estadisticasGateway.emitirActualizacionStats({ source: 'factura_update', id });
			return;
		}

		// Actualiza solo la factura — las órdenes mantienen su estado propio.
		// Pueden estar en preparación y pagarse por adelantado sin cerrarse.
		await this.repo.update(id, data);
		const result = await this.repo.findOne({ where: { facturaId: id } });

		// Register caja entry + exit in parallel (independent INSERTs).
		// skipValidation on salida: las denominaciones del cambio están garantizadas
		// por la entrada que se inserta simultáneamente; saltarse getEstadoActual
		// elimina una query O(N) sobre los movimientos del día.
		const fecha = getBogotaDateString();
		const cajaOps: Promise<unknown>[] = [];

		if (
			(data.metodo === 'efectivo' || data.metodo === 'efectivo_transferencia') &&
			data.denominaciones && Object.keys(data.denominaciones).length > 0 &&
			(data.pagoEfectivo ?? 0) > 0
		) {
			cajaOps.push(this.cajaMovimientosService.registrarEntrada({
				denominaciones: data.denominaciones,
				facturaVentaId: id,
				descripcion: `Cobro factura #${id}${result?.clienteNombre ? ` - ${result.clienteNombre}` : ''}`,
				fecha,
				metodo: data.metodo,
				pagoTransferencia: data.pagoTransferencia,
			}));
		}

		if (
			data.cambioDenominaciones &&
			Object.keys(data.cambioDenominaciones).length > 0
		) {
			cajaOps.push(this.cajaMovimientosService.registrarSalida({
				denominaciones: data.cambioDenominaciones,
				descripcion: `Cambio factura #${id}${result?.clienteNombre ? ` - ${result.clienteNombre}` : ''}`,
				fecha,
				skipValidation: true,
			}));
		}

		if (cajaOps.length) await Promise.all(cajaOps);

		this.estadisticasGateway.emitirActualizacionStats({ source: 'factura_pagada', id });
		return result;
	}

	async registrarAbono(id: number, dto: AbonoDto) {
		const factura = await this.findOne(id);

		if (factura.estado === 'pagado' || factura.estado === 'pagada' || factura.estado === 'cancelado') {
			throw new BadRequestException('No se puede abonar a una factura ya pagada o cancelada');
		}

		const nuevoMonto = (factura.montoPagado ?? 0) + dto.monto;
		const nuevoEstado = nuevoMonto >= factura.total ? 'pagado' : 'parcial';

		await this.repo.update(id, { montoPagado: nuevoMonto, estado: nuevoEstado });

		const fecha = getBogotaDateString();
		const cajaOps: Promise<unknown>[] = [];

		if (dto.denominaciones && Object.keys(dto.denominaciones).length > 0) {
			cajaOps.push(this.cajaMovimientosService.registrarEntrada({
				denominaciones: dto.denominaciones,
				facturaVentaId: id,
				descripcion: `Abono factura #${id}${factura.clienteNombre ? ` - ${factura.clienteNombre}` : ''}`,
				fecha,
				metodo: 'efectivo',
			}));
		}

		if (dto.cambioDenominaciones && Object.keys(dto.cambioDenominaciones).length > 0) {
			cajaOps.push(this.cajaMovimientosService.registrarSalida({
				denominaciones: dto.cambioDenominaciones,
				descripcion: `Cambio abono factura #${id}${factura.clienteNombre ? ` - ${factura.clienteNombre}` : ''}`,
				fecha,
				skipValidation: true,
			}));
		}

		if (cajaOps.length) await Promise.all(cajaOps);

		this.estadisticasGateway.emitirActualizacionStats({ source: 'factura_abono', id });
		return this.findOne(id);
	}

	async remove(id: number) {
		const res = await this.repo.delete(id);
		this.estadisticasGateway.emitirActualizacionStats({ source: 'factura_delete', id });
		return res;
	}
}
