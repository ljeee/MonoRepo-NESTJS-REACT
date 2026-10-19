import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, SelectQueryBuilder} from 'typeorm';
import {FacturasPagos} from './esquemas/facturas-pagos.entity';
import {CreateFacturasPagosDto, FindFacturasPagosDto, UpdateFacturasPagosDto} from './esquemas/facturas-pagos.dto';
import {tipoPorCategoria} from '../common/utils/gastos.util';
import {getBogotaDateString} from '../common/utils/date.utils';
import {CajaMovimientosService} from '../caja-movimientos/caja-movimientos.service';
import {EstadisticasGateway} from '../estadisticas/estadisticas.gateway';
import {BOM_UTF8, celdaNumero, celdaTexto, filaCsv} from '../common/utils/csv.util';
import {leerCursor, siguienteCursor} from '../common/utils/paginacion.util';

/** Filas por consulta al exportar: el CSV se escribe por tandas. */
const LOTE_EXPORT = 1000;

@Injectable()
export class FacturasPagosService {
	constructor(
		@InjectRepository(FacturasPagos)
		private readonly repo: Repository<FacturasPagos>,
		private readonly cajaMovimientosService: CajaMovimientosService,
		private readonly estadisticasGateway: EstadisticasGateway,
	) {}

	/**
	 * Egresos del rango. Sin `limit` (o `limit=0`) devuelve TODOS: las pantallas de contabilidad
	 * suman y exportan lo que reciben, así que un tope por defecto (antes 100) falseaba los totales.
	 * Con `limit` > 0 pagina como siempre. Con `cursor` ('inicio' o el id del último egreso recibido)
	 * pagina POR CLAVE (pagos_id descendente) y devuelve `siguiente`: un rango completo por tandas sin
	 * duplicar ni perder egresos que se registran mientras tanto.
	 */
	async findAll(query: FindFacturasPagosDto = {}) {
		const {from, to, tipo, categoria, estado} = query;
		const cursor = leerCursor(query.cursor, query.limit);
		const limit = cursor.activo ? cursor.limite : Number(query.limit) > 0 ? Number(query.limit) : 0;
		const page = !cursor.activo && Number(query.page) > 0 ? Number(query.page) : 1;

		const aplicarFiltros = (qb: SelectQueryBuilder<FacturasPagos>) => {
			if (from && to) {
				qb.where('p.fechaFactura BETWEEN :from AND :to', {from, to});
			} else if (from) {
				qb.where('p.fechaFactura >= :from', {from});
			} else if (to) {
				qb.where('p.fechaFactura <= :to', {to});
			}
			if (tipo === 'sin_clasificar') {
				qb.andWhere("(p.tipoGasto IS NULL OR p.tipoGasto = '')");
			} else if (tipo) {
				qb.andWhere('p.tipoGasto = :tipo', {tipo});
			}
			if (categoria) qb.andWhere('p.categoria = :categoria', {categoria});
			if (estado === 'pendiente') {
				qb.andWhere('(p.estado = :pendiente OR p.estado IS NULL)', {pendiente: 'pendiente'});
			} else if (estado) {
				qb.andWhere('p.estado = :estado', {estado});
			}
			return qb;
		};

		if (cursor.activo) {
			// El total es el de TODO el filtro (sin el cursor), para mostrar el avance de la carga.
			const total = await aplicarFiltros(this.repo.createQueryBuilder('p')).getCount();
			const qb = aplicarFiltros(this.repo.createQueryBuilder('p')).orderBy('p.pagosId', 'DESC').take(limit);
			if (cursor.despuesDe) qb.andWhere('p.pagosId < :despuesDe', {despuesDe: cursor.despuesDe});
			const data = await qb.getMany();
			return {data, total, page: 1, limit, totalPages: 1, siguiente: siguienteCursor(data, limit, (g) => g.pagosId)};
		}

		const qb = aplicarFiltros(this.repo.createQueryBuilder('p')).orderBy('p.fechaFactura', 'DESC').addOrderBy('p.pagosId', 'DESC');
		if (limit) qb.take(limit).skip((page - 1) * limit);
		const [data, total] = await qb.getManyAndCount();
		return {data, total, page: limit ? page : 1, limit, totalPages: limit ? Math.ceil(total / limit) : 1, siguiente: null};
	}

	/** CSV de los egresos del rango (todos, sin tope), por tandas con paginación por clave (`pagos_id` descendente). */
	async *csvEgresos(opts: {from: string; to: string; tipo?: string; categoria?: string}): AsyncGenerator<string> {
		yield BOM_UTF8 +
			filaCsv(['Egreso', 'Fecha', 'Nombre', 'Descripción', 'Tipo', 'Categoría', 'Método', 'Cuenta de origen', 'Estado', 'Total'].map(celdaTexto));
		let ultimo: number | null = null;
		for (;;) {
			const params: unknown[] = [opts.from, opts.to];
			let extra = '';
			if (opts.tipo === 'sin_clasificar') extra += " AND (g.tipo_gasto IS NULL OR g.tipo_gasto = '')";
			else if (opts.tipo) {
				params.push(opts.tipo);
				extra += ` AND g.tipo_gasto = $${params.length}`;
			}
			if (opts.categoria) {
				params.push(opts.categoria);
				extra += ` AND g.categoria = $${params.length}`;
			}
			if (ultimo != null) {
				params.push(ultimo);
				extra += ` AND g.pagos_id < $${params.length}`;
			}
			const filas: Record<string, unknown>[] = await this.repo.query(
				`SELECT g.pagos_id AS id, to_char(g.fecha_factura, 'YYYY-MM-DD') AS fecha, g.nombre_gasto AS nombre,
					g.descripcion, COALESCE(NULLIF(g.tipo_gasto, ''), 'sin clasificar') AS tipo,
					COALESCE(NULLIF(g.categoria, ''), 'general') AS categoria, g.metodo, ct.nombre AS cuenta,
					COALESCE(g.estado, 'pendiente') AS estado, g.total::float8 AS total
				 FROM facturas_pagos g
				 LEFT JOIN cuentas_transferencia ct ON ct.id = g.cuenta_origen_id
				 WHERE g.fecha_factura BETWEEN $1::date AND $2::date${extra}
				 ORDER BY g.pagos_id DESC
				 LIMIT ${LOTE_EXPORT}`,
				params,
			);
			if (!filas.length) return;
			yield filas
				.map((r) =>
					filaCsv([
						celdaNumero(r.id),
						celdaTexto(r.fecha),
						celdaTexto(r.nombre),
						celdaTexto(r.descripcion),
						celdaTexto(r.tipo),
						celdaTexto(r.categoria),
						celdaTexto(r.metodo),
						celdaTexto(r.cuenta),
						celdaTexto(r.estado),
						celdaNumero(r.total),
					]),
				)
				.join('');
			ultimo = Number(filas[filas.length - 1].id);
			if (filas.length < LOTE_EXPORT) return;
		}
	}

	findByDay() {
		// fechaFactura is a date column (equality check is timezone-independent)
		const today = getBogotaDateString();
		return this.repo.createQueryBuilder('p').where('p.fechaFactura = :today', {today}).getMany();
	}

	findPendingByDay() {
		const today = getBogotaDateString();
		return this.repo
			.createQueryBuilder('p')
			.where('(p.estado = :pendiente OR p.estado IS NULL)')
			.andWhere('p.fechaFactura = :today', {today, pendiente: 'pendiente'})
			.getMany();
	}

	async findOne(id: number) {
		const pago = await this.repo.findOneBy({pagosId: id});
		if (!pago) {
			throw new NotFoundException(`Factura de pago con ID ${id} no encontrada`);
		}
		return pago;
	}

	/** Existe y está activa (o es la misma que ya tenía el egreso: una cuenta desactivada no rompe ediciones viejas). */
	private async validarCuentaOrigen(cuentaId: number, cuentaActual?: number | null) {
		const [fila]: {activa: boolean}[] = await this.repo.manager.query('SELECT activa FROM cuentas_transferencia WHERE id = $1', [cuentaId]);
		if (!fila) throw new BadRequestException(`La cuenta de origen #${cuentaId} no existe`);
		if (!fila.activa && cuentaId !== cuentaActual) throw new BadRequestException('La cuenta de origen está desactivada');
	}

	async create(data: CreateFacturasPagosDto) {
		if (!data.fechaFactura) {
			data.fechaFactura = getBogotaDateString();
		}
		// Un egreso por QR tiene que decir de qué cuenta salió (si no, no hay saldo por cuenta).
		if (data.metodo === 'qr') {
			if (data.cuentaOrigenId == null) throw new BadRequestException('Elige la cuenta de la que sale el pago por QR');
			await this.validarCuentaOrigen(data.cuentaOrigenId);
		} else {
			data.cuentaOrigenId = null;
		}
		// Sin tipo explícito, el de la categoría (nómina → gasto, insumos → costo…).
		if (!data.tipoGasto) data.tipoGasto = tipoPorCategoria(data.categoria) ?? undefined;
		const gasto = await this.repo.save(data);

		// Registrar salida de caja si el gasto es en efectivo y trae denominaciones
		if (data.metodo === 'efectivo' && data.denominaciones && Object.keys(data.denominaciones).length > 0) {
			await this.cajaMovimientosService.registrarSalida({
				denominaciones: data.denominaciones,
				facturaPagoId: gasto.pagosId,
				descripcion: data.nombreGasto ?? 'Gasto en efectivo',
				fecha: data.fechaFactura,
				cajaOrigen: 'gastos',
			});
		}

		// Los gastos cambian el balance: las pantallas con estadísticas se refrescan solas.
		this.estadisticasGateway.emitirActualizacionStats({source: 'gasto_create', id: gasto.pagosId});
		return gasto;
	}

	async update(id: number, dto: UpdateFacturasPagosDto) {
		// El id nunca se edita; `denominaciones` solo se usa al crear (la salida de caja ya quedó registrada).
		const {pagosId: _id, denominaciones: _den, ...data} = dto;
		// Cuenta de origen: solo existe con método QR. Se valida contra el estado resultante de la edición.
		if (data.metodo !== undefined || data.cuentaOrigenId !== undefined) {
			const actual = await this.findOne(id);
			const metodo = data.metodo ?? actual.metodo;
			if (metodo === 'qr') {
				const cuenta = data.cuentaOrigenId !== undefined ? data.cuentaOrigenId : actual.cuentaOrigenId;
				if (cuenta == null) throw new BadRequestException('Elige la cuenta de la que sale el pago por QR');
				await this.validarCuentaOrigen(cuenta, actual.cuentaOrigenId);
				data.cuentaOrigenId = cuenta;
			} else {
				data.cuentaOrigenId = null;
			}
		}
		// Al cambiar la categoría sin indicar tipo, se reclasifica con el tipo de la nueva categoría.
		if (data.categoria && !data.tipoGasto) data.tipoGasto = tipoPorCategoria(data.categoria) ?? undefined;
		const result = await this.repo.update(id, data);
		this.estadisticasGateway.emitirActualizacionStats({source: 'gasto_update', id});
		return result;
	}

	async remove(id: number) {
		const result = await this.repo.delete(id);
		this.estadisticasGateway.emitirActualizacionStats({source: 'gasto_delete', id});
		return result;
	}
}
