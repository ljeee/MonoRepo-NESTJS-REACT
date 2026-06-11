import {Injectable, NotFoundException, BadRequestException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, SelectQueryBuilder} from 'typeorm';
import {FacturasVentas} from './esquemas/facturas-ventas.entity';
import {AbonoDto, CreateFacturasVentasDto} from './esquemas/facturas-ventas.dto';
import {Ordenes} from '../ordenes/esquemas/ordenes.entity';
import {getBogotaDayBoundaries, getBogotaDateString} from '../common/utils/date.utils';
import {CajaMovimientosService} from '../caja-movimientos/caja-movimientos.service';

@Injectable()
export class FacturasVentasService {
	constructor(
		@InjectRepository(FacturasVentas)
		private readonly repo: Repository<FacturasVentas>,
		private readonly cajaMovimientosService: CajaMovimientosService,
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
			relations: ['ordenes', 'domicilios'],
		});
		if (!factura) {
			throw new NotFoundException(`Factura con ID ${id} no encontrada`);
		}
		return factura;
	}

	create(data: CreateFacturasVentasDto) {
		return this.repo.save(data);
	}

	async update(id: number, data: Partial<CreateFacturasVentasDto>) {
		const completing = data.estado === 'pagada' || data.estado === 'pagado';

		if (!completing) {
			return this.repo.update(id, data);
		}

		// Transactional: complete factura + all linked orders atomically
		const result = await this.repo.manager.transaction(async (manager) => {
			const facturasRepo = manager.getRepository(FacturasVentas);
			const ordenesRepo = manager.getRepository(Ordenes);

			await facturasRepo.update(id, data);

			await ordenesRepo
				.createQueryBuilder()
				.update(Ordenes)
				.set({ estadoOrden: 'completada' })
				.where('factura_id = :facturaId', { facturaId: id })
				.andWhere('estado_orden NOT IN (:...estados)', { estados: ['completada', 'cancelada'] })
				.execute();

			return facturasRepo.findOne({ where: { facturaId: id } });
		});

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

		return this.findOne(id);
	}

	remove(id: number) {
		return this.repo.delete(id);
	}
}
