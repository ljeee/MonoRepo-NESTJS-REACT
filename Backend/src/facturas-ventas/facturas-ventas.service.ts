import {Injectable, NotFoundException, BadRequestException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {EntityManager, Repository, SelectQueryBuilder} from 'typeorm';
import type {QueryDeepPartialEntity} from 'typeorm/query-builder/QueryPartialEntity';
import {FacturasVentas} from './esquemas/facturas-ventas.entity';
import {AbonoDto, CreateFacturasVentasDto} from './esquemas/facturas-ventas.dto';
import {getBogotaDayBoundaries, getBogotaDateString} from '../common/utils/date.utils';
import {CajaMovimientosService} from '../caja-movimientos/caja-movimientos.service';
import {EstadisticasGateway} from '../estadisticas/estadisticas.gateway';
import {ConsumoOrdenService} from '../inventario/consumo-orden.service';
import {
	sqlMontoEnCuenta,
	acumularDesglose,
	cobrado,
	metodoSegunPagos,
	sqlCobrado,
	sqlCoincideCuenta,
	sqlFacturaValida,
	sqlFechaBogota,
	sqlMontoEfectivo,
	sqlMontoTransferencia,
	sqlPorCobrar,
} from '../common/domain/ventas';
import {BOM_UTF8, celdaNumero, celdaTexto, filaCsv} from '../common/utils/csv.util';
import {leerCursor, siguienteCursor} from '../common/utils/paginacion.util';

/** Filas por consulta al exportar: el CSV se escribe por tandas, nunca se carga el rango entero en memoria. */
const LOTE_EXPORT = 1000;

/** Tolerancia (pesos) al comparar montos: los totales son enteros, pero llegan como numeric. */
const TOLERANCIA = 0.5;

const esMetodoTransferencia = (m?: string | null) => m === 'transferencia' || m === 'qr' || m === 'efectivo_transferencia';

@Injectable()
export class FacturasVentasService {
	constructor(
		@InjectRepository(FacturasVentas)
		private readonly repo: Repository<FacturasVentas>,
		private readonly cajaMovimientosService: CajaMovimientosService,
		private readonly estadisticasGateway: EstadisticasGateway,
		private readonly consumoOrden: ConsumoOrdenService,
	) {}

	/** Reconcilia el inventario de las órdenes de la factura (anulada o a punto de borrarse). */
	private async reconciliarOrdenesDe(facturaId: number, manager: EntityManager, eliminada: boolean) {
		const ordenes: {ordenId: number}[] = await manager.query(
			'SELECT orden_id AS "ordenId" FROM ordenes WHERE factura_id = $1 ORDER BY orden_id',
			[facturaId],
		);
		for (const o of ordenes) await this.consumoOrden.reconciliar(o.ordenId, manager, {eliminada});
	}

	/**
	 * Facturas filtradas. Paginación: con `limit` > 0 pagina; con `limit=0` — o sin `limit` pero
	 * con rango from/to — devuelve TODO el rango (la contabilidad no admite topes silenciosos: sus
	 * pantallas y exportaciones suman lo que reciben). Sin límite y sin rango: 50 por página.
	 * Con `cursor` ('inicio' o el id de la última factura recibida) pagina POR CLAVE (factura_id
	 * descendente, tandas de `limit`, 500 por defecto) y devuelve `siguiente`: así las pantallas traen
	 * un rango completo por tandas sin duplicar ni perder facturas que entran mientras tanto.
	 */
	async findAll(
		opts: {
			from?: string;
			to?: string;
			page?: number;
			limit?: number;
			estado?: string;
			clienteNombre?: string;
			metodo?: string;
			cuentaTransferenciaId?: number;
			/** Solo ventas válidas con dinero cobrado por transferencia/QR (incluye mixtas y abonos QR). */
			conTransferencia?: boolean;
			/** Paginación por clave: 'inicio' o el id de la última factura recibida. */
			cursor?: string;
		} = {},
	) {
		const {from, to, estado, clienteNombre, metodo, cuentaTransferenciaId, conTransferencia} = opts;
		const cursor = leerCursor(opts.cursor, opts.limit);
		const limitPedido = opts.limit != null && Number.isFinite(Number(opts.limit)) ? Number(opts.limit) : undefined;
		const todos = !cursor.activo && (limitPedido != null ? limitPedido <= 0 : !!(from && to));
		const limit = cursor.activo ? cursor.limite : todos ? 0 : (limitPedido ?? 50);
		const page = todos || cursor.activo ? 1 : Number(opts.page) > 0 ? Number(opts.page) : 1;

		// Apply all WHERE filters — uses explicit Bogotá offset so Alpine Docker
		// (no tzdata) gives the same result as an environment with TZ=America/Bogota.
		const addFilters = (qb: SelectQueryBuilder<FacturasVentas>) => {
			if (from && to) {
				const {start} = getBogotaDayBoundaries(from);
				const {end} = getBogotaDayBoundaries(to);
				qb.where('f.fechaFactura BETWEEN :from AND :to', {from: start, to: end});
			} else if (from) {
				const {start} = getBogotaDayBoundaries(from);
				qb.where('f.fechaFactura >= :from', {from: start});
			} else if (to) {
				const {end} = getBogotaDayBoundaries(to);
				qb.where('f.fechaFactura <= :to', {to: end});
			}

			if (estado) {
				if (estado === 'pendiente') {
					qb.andWhere('(f.estado = :estado OR f.estado IS NULL)', {estado: 'pendiente'});
				} else {
					qb.andWhere('f.estado = :estado', {estado});
				}
			}

			if (clienteNombre && clienteNombre.trim()) {
				qb.andWhere('f.clienteNombre ILIKE :clienteNombre', {clienteNombre: `%${clienteNombre.trim()}%`});
			}

			if (metodo) {
				// 'mixto' es el alias UI de efectivo_transferencia.
				// Efectivo y transferencia incluyen las facturas mixtas cuya parte
				// correspondiente sea > 0 ("mixta con efectivo" / "mixta con QR").
				if (metodo === 'efectivo') {
					qb.andWhere(
						"(f.metodo = 'efectivo' OR (f.metodo = 'efectivo_transferencia' AND COALESCE(f.pagoEfectivo, 0) > 0))",
					);
				} else if (metodo === 'transferencia') {
					qb.andWhere(
						"(f.metodo = 'transferencia' OR f.metodo = 'qr' OR (f.metodo = 'efectivo_transferencia' AND COALESCE(f.pagoTransferencia, 0) > 0))",
					);
				} else {
					const m = metodo === 'mixto' ? 'efectivo_transferencia' : metodo;
					qb.andWhere('f.metodo = :metodo', {metodo: m});
				}
			}

			// Mismas facturas que suman en "cobrado por transferencia" del resumen (/estadisticas/resumen).
			if (conTransferencia) {
				qb.andWhere(sqlFacturaValida('f'));
				qb.andWhere(`${sqlMontoTransferencia('f')} > 0`);
			}

			if (cuentaTransferenciaId) {
				if (cuentaTransferenciaId === -1) {
					qb.andWhere(sqlCoincideCuenta(null));
				} else {
					qb.andWhere(sqlCoincideCuenta(':cuentaId'), {cuentaId: cuentaTransferenciaId});
				}
			}
		};

		// Separate count query (no joins) — avoids TypeORM COUNT+leftJoinAndSelect issues
		const countQb = this.repo.createQueryBuilder('f');
		addFilters(countQb);
		const total = await countQb.getCount();

		// Data query with full joins (+ paginación si se pidió)
		const dataQb = this.repo
			.createQueryBuilder('f')
			.leftJoinAndSelect('f.ordenes', 'ordenes')
			.leftJoinAndSelect('ordenes.productos', 'op')
			.leftJoinAndSelect('f.domicilios', 'domicilios')
			.leftJoinAndSelect('domicilios.domiciliario', 'domiciliario');
		if (cursor.activo) dataQb.orderBy('f.facturaId', 'DESC');
		else dataQb.orderBy('f.fechaFactura', 'DESC').addOrderBy('f.facturaId', 'DESC');
		addFilters(dataQb);
		// El cursor va DESPUÉS de los filtros: addFilters abre la condición con `where`.
		if (cursor.despuesDe) dataQb.andWhere('f.facturaId < :despuesDe', {despuesDe: Number(cursor.despuesDe)});
		if (limit) dataQb.take(limit).skip(cursor.activo ? 0 : (page - 1) * limit);
		const data = await dataQb.getMany();

		return {
			data,
			total,
			page,
			limit,
			totalPages: cursor.activo ? 1 : limit ? Math.ceil(total / limit) : 1,
			siguiente: cursor.activo ? siguienteCursor(data, limit, (f) => f.facturaId) : null,
		};
	}

	/**
	 * CSV de las facturas del rango (todas, sin tope), generado por tandas con paginación por clave
	 * (`factura_id` descendente): sirve para rangos de años sin cargar todo en memoria. Las columnas usan las
	 * definiciones únicas de dinero (cobrado, por cobrar, efectivo y transferencia) y marcan si la venta es válida.
	 */
	async *csvFacturas(opts: {from: string; to: string; conTransferencia?: boolean; cuentaTransferenciaId?: number}): AsyncGenerator<string> {
		// Con una cuenta elegida va además lo que entró a ESA cuenta: "Transferencia" es todo lo cobrado por QR y una
		// factura abonada a dos cuentas sumaba de más si se totalizaba esa columna en el reporte de una sola.
		const porCuenta = !!opts.cuentaTransferenciaId;
		yield BOM_UTF8 +
			filaCsv(
				[
					'Factura', 'Fecha (Bogotá)', 'Cliente', 'Teléfono', 'Estado', 'Venta válida', 'Método', 'Total', 'Cobrado', 'Por cobrar',
					'Efectivo', 'Transferencia', 'Cuentas de transferencia', ...(porCuenta ? ['Transferencia a esta cuenta'] : []),
				].map(celdaTexto),
			);
		const {start} = getBogotaDayBoundaries(opts.from);
		const {end} = getBogotaDayBoundaries(opts.to);
		let ultimo: number | null = null;
		for (;;) {
			const params: unknown[] = [start, end];
			let extra = '';
			let columnaCuenta = '';
			if (opts.conTransferencia) extra += ` AND ${sqlFacturaValida('f')} AND ${sqlMontoTransferencia('f')} > 0`;
			if (opts.cuentaTransferenciaId) {
				if (opts.cuentaTransferenciaId === -1) {
					extra += ` AND ${sqlCoincideCuenta(null)}`;
					columnaCuenta = `, ${sqlMontoEnCuenta(null)}::float8 AS en_cuenta`;
				} else {
					params.push(opts.cuentaTransferenciaId);
					extra += ` AND ${sqlCoincideCuenta(`$${params.length}`)}`;
					columnaCuenta = `, ${sqlMontoEnCuenta(`$${params.length}`)}::float8 AS en_cuenta`;
				}
			}
			if (ultimo != null) {
				params.push(ultimo);
				extra += ` AND f.factura_id < $${params.length}`;
			}
			const filas: Record<string, unknown>[] = await this.repo.query(
				`SELECT f.factura_id AS id, to_char(${sqlFechaBogota('f')}, 'YYYY-MM-DD HH24:MI') AS fecha,
					f.cliente_nombre AS cliente, f.telefono_cliente AS telefono, f.estado, f.metodo, f.total::float8 AS total,
					${sqlFacturaValida('f')} AS valida,
					${sqlCobrado('f')}::float8 AS cobrado, ${sqlPorCobrar('f')}::float8 AS por_cobrar,
					${sqlMontoEfectivo('f')}::float8 AS efectivo, ${sqlMontoTransferencia('f')}::float8 AS transferencia,
					COALESCE(
						(SELECT string_agg(COALESCE(e.item->>'cuenta', 'sin cuenta') || ' $' || COALESCE(e.item->>'monto', '0'), '; ')
						 FROM jsonb_array_elements(f.desglose_transferencia) AS e(item)),
						NULLIF(f.cuenta_transferencia_nombre, '')
					) AS cuentas${columnaCuenta}
				 FROM facturas_ventas f
				 WHERE f."fechaFactura" BETWEEN $1 AND $2${extra}
				 ORDER BY f.factura_id DESC
				 LIMIT ${LOTE_EXPORT}`,
				params,
			);
			if (!filas.length) return;
			yield filas
				.map((r) =>
					filaCsv([
						celdaNumero(r.id),
						celdaTexto(r.fecha),
						celdaTexto(r.cliente),
						celdaTexto(r.telefono),
						celdaTexto(r.estado),
						celdaTexto(r.valida ? 'sí' : 'no'),
						celdaTexto(r.metodo),
						celdaNumero(r.total),
						celdaNumero(r.cobrado),
						celdaNumero(r.por_cobrar),
						celdaNumero(r.efectivo),
						celdaNumero(r.transferencia),
						celdaTexto(r.cuentas),
						...(porCuenta ? [celdaNumero(r.en_cuenta)] : []),
					]),
				)
				.join('');
			ultimo = Number(filas[filas.length - 1].id);
			if (filas.length < LOTE_EXPORT) return;
		}
	}

	async findByDay() {
		const {start, end} = getBogotaDayBoundaries();
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
		const {start, end} = getBogotaDayBoundaries();
		return this.repo
			.createQueryBuilder('f')
			.leftJoinAndSelect('f.ordenes', 'ordenes')
			.leftJoinAndSelect('f.domicilios', 'domicilios')
			.leftJoinAndSelect('domicilios.domiciliario', 'domiciliario')
			.where('(f.estado = :pendiente OR f.estado IS NULL)')
			.andWhere('f.fechaFactura BETWEEN :start AND :end', {start, end, pendiente: 'pendiente'})
			.getMany();
	}

	/** Foto del día con las definiciones únicas (ventas válidas; cobrado topado; abonos cuentan). */
	async getDayStats() {
		const {start, end} = getBogotaDayBoundaries();
		const [fila] = await this.repo.query(
			`SELECT COUNT(*)::int AS count,
				COALESCE(SUM(f.total), 0)::float8 AS total,
				COALESCE(SUM(${sqlCobrado('f')}), 0)::float8 AS cobrado,
				COALESCE(SUM(${sqlPorCobrar('f')}), 0)::float8 AS por_cobrar
			 FROM facturas_ventas f
			 WHERE f."fechaFactura" BETWEEN $1 AND $2 AND ${sqlFacturaValida('f')}`,
			[start, end],
		);
		return {
			totalDia: Number(fila?.total) || 0,
			totalPagado: Number(fila?.cobrado) || 0,
			totalPendiente: Number(fila?.por_cobrar) || 0,
			count: Number(fila?.count) || 0,
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
		this.estadisticasGateway.emitirActualizacionStats({source: 'factura_create', id: saved.facturaId});
		return saved;
	}

	/**
	 * Cuenta de transferencia vigente: con id, el nombre sale SIEMPRE de la tabla (no se confía
	 * en el que manda el cliente); con solo nombre se enlaza por nombre y debe existir (antes un nombre
	 * inventado se guardaba tal cual y el dinero quedaba "sin asignar" con un nombre falso). Una cuenta
	 * desactivada no puede recibir cobros nuevos.
	 */
	private async resolverCuenta(
		id?: number | null,
		nombre?: string | null,
	): Promise<{id: number | null; nombre: string | null}> {
		const manager = this.repo.manager;
		if (id) {
			const [cuenta] = await manager.query('SELECT id, nombre, activa FROM cuentas_transferencia WHERE id = $1', [id]);
			if (!cuenta) throw new BadRequestException(`La cuenta de transferencia #${id} no existe`);
			if (cuenta.activa === false) throw new BadRequestException(`La cuenta "${cuenta.nombre}" está desactivada`);
			return {id: Number(cuenta.id), nombre: cuenta.nombre};
		}
		const limpio = nombre?.trim();
		if (!limpio) return {id: null, nombre: null};
		const [cuenta] = await manager.query(
			'SELECT id, nombre, activa FROM cuentas_transferencia WHERE lower(nombre) = lower($1) ORDER BY id LIMIT 1',
			[limpio],
		);
		if (!cuenta) throw new BadRequestException(`La cuenta de transferencia "${limpio}" no existe`);
		if (cuenta.activa === false) throw new BadRequestException(`La cuenta "${cuenta.nombre}" está desactivada`);
		return {id: Number(cuenta.id), nombre: cuenta.nombre};
	}

	async update(id: number, data: Partial<CreateFacturasVentasDto>) {
		const completing = data.estado === 'pagada' || data.estado === 'pagado';
		const revirtiendo = data.estado === 'pendiente';
		const cambios: QueryDeepPartialEntity<FacturasVentas> = {...data};
		/** Efectivo que sube (+) o baja (−) en una factura ya cobrada al editar su total: se refleja en la caja. */
		let diferenciaEfectivo = 0;

		// Asignar/cambiar la cuenta: toda la transferencia de la factura va a esa cuenta.
		if (data.cuentaTransferenciaId !== undefined || data.cuentaTransferenciaNombre !== undefined) {
			const cuenta = await this.resolverCuenta(data.cuentaTransferenciaId, data.cuentaTransferenciaNombre);
			// Reasignar manda TODA la transferencia a una cuenta y borra el reparto: si la factura se abonó a varias
			// cuentas, eso destruiría información real sin avisar.
			if (!completing) {
				const previa = await this.repo.findOne({where: {facturaId: id}});
				const distintas = new Set((previa?.desgloseTransferencia ?? []).map((d) => d.cuentaId ?? `n:${d.cuenta}`));
				if (distintas.size > 1) {
					throw new BadRequestException(
						'Esta factura tiene abonos por QR en varias cuentas: no se puede reasignar todo a una sola cuenta',
					);
				}
			}
			cambios.cuentaTransferenciaId = cuenta.id;
			cambios.cuentaTransferenciaNombre = cuenta.nombre;
			cambios.desgloseTransferencia = null;
		}

		if (completing) {
			const existing = await this.repo.findOne({where: {facturaId: id}});
			const totalFactura = Number(data.total ?? existing?.total) || 0;
			const metodo = data.metodo ?? existing?.metodo;
			if (data.montoPagado === undefined) {
				cambios.montoPagado = totalFactura;
			}
			if (metodo === 'efectivo') {
				cambios.pagoEfectivo = data.pagoEfectivo ?? totalFactura;
				cambios.pagoTransferencia = data.pagoTransferencia ?? 0;
			} else if (metodo === 'transferencia' || metodo === 'qr') {
				cambios.pagoTransferencia = data.pagoTransferencia ?? totalFactura;
				cambios.pagoEfectivo = data.pagoEfectivo ?? 0;
			}
			// Un cobro nuevo reemplaza al anterior: sin desglose por abonos y, si ya no hay
			// transferencia, sin cuenta (si no, quedaba la de un cobro anterior revertido).
			cambios.desgloseTransferencia = null;
			// Todo cobro con transferencia dice A QUÉ cuenta entró (sin esto el dinero queda "sin asignar"):
			// la cuenta viene en la petición o ya la tenía la factura.
			const montoTransferencia =
				metodo === 'efectivo_transferencia'
					? Number(data.pagoTransferencia ?? existing?.pagoTransferencia ?? 0)
					: Number(data.pagoTransferencia ?? totalFactura);
			const traeCuenta =
				cambios.cuentaTransferenciaId != null ||
				!!cambios.cuentaTransferenciaNombre ||
				!!existing?.cuentaTransferenciaId ||
				!!existing?.cuentaTransferenciaNombre;
			if (esMetodoTransferencia(metodo) && montoTransferencia > 0 && !traeCuenta) {
				throw new BadRequestException('Elige la cuenta a la que entró la transferencia');
			}
			if (!esMetodoTransferencia(metodo)) {
				cambios.cuentaTransferenciaId = null;
				cambios.cuentaTransferenciaNombre = null;
			}
			cambios.fechaCobro = new Date();
		} else if (revirtiendo) {
			// Revertir a pendiente descarta lo cobrado. Antes quedaban montoPagado y el desglose
			// con el valor viejo: un abono posterior se sumaba a ellos y saldaba la factura de golpe.
			cambios.montoPagado = 0;
			cambios.pagoEfectivo = null;
			cambios.pagoTransferencia = null;
			cambios.fechaCobro = null;
			cambios.desgloseTransferencia = null;
		} else if (data.total !== undefined) {
			const previo = await this.repo.findOne({where: {facturaId: id}});
			const ajustes = await this.ajustesPorNuevoTotal(id, Number(data.total) || 0);
			Object.assign(cambios, ajustes);
			if (previo && (previo.estado === 'pagado' || previo.estado === 'pagada')) {
				const antes = Number(previo.pagoEfectivo ?? 0);
				const despues = ajustes.pagoEfectivo !== undefined ? Number(ajustes.pagoEfectivo) : antes;
				diferenciaEfectivo = despues - antes;
			}
		}

		if (!completing) {
			if (data.estado === 'cancelado') {
				// Anular la factura anula la venta: el inventario consumido vuelve y el efectivo cobrado sale de la caja.
				await this.repo.manager.transaction(async (manager) => {
					await manager.getRepository(FacturasVentas).update(id, cambios);
					await this.reconciliarOrdenesDe(id, manager, false);
					await this.cajaMovimientosService.compensarFactura(id, 'factura anulada', manager);
				});
			} else if (revirtiendo) {
				// Revertir a pendiente devuelve lo cobrado: el efectivo que entró a la caja sale.
				await this.repo.manager.transaction(async (manager) => {
					await manager.getRepository(FacturasVentas).update(id, cambios);
					await this.cajaMovimientosService.compensarFactura(id, 'cobro revertido', manager);
				});
			} else {
				await this.repo.update(id, cambios);
				if (diferenciaEfectivo) await this.cajaMovimientosService.ajustarEfectivoDeFactura(id, diferenciaEfectivo, 'cambio de total');
			}
			this.estadisticasGateway.emitirActualizacionStats({source: 'factura_update', id});
			return;
		}

		// Actualiza solo la factura — las órdenes mantienen su estado propio.
		// Pueden estar en preparación y pagarse por adelantado sin cerrarse.
		await this.repo.update(id, cambios);
		const result = await this.repo.findOne({where: {facturaId: id}});

		// Register caja entry + exit in parallel (independent INSERTs).
		// skipValidation on salida: las denominaciones del cambio están garantizadas
		// por la entrada que se inserta simultáneamente; saltarse getEstadoActual
		// elimina una query O(N) sobre los movimientos del día.
		const fecha = getBogotaDateString();
		const cajaOps: Promise<unknown>[] = [];

		if (
			(data.metodo === 'efectivo' || data.metodo === 'efectivo_transferencia') &&
			data.denominaciones &&
			Object.keys(data.denominaciones).length > 0 &&
			(data.pagoEfectivo ?? 0) > 0
		) {
			cajaOps.push(
				this.cajaMovimientosService.registrarEntrada({
					denominaciones: data.denominaciones,
					facturaVentaId: id,
					descripcion: `Cobro factura #${id}${result?.clienteNombre ? ` - ${result.clienteNombre}` : ''}`,
					fecha,
					metodo: data.metodo,
					pagoTransferencia: data.pagoTransferencia,
				}),
			);
		}

		if (data.cambioDenominaciones && Object.keys(data.cambioDenominaciones).length > 0) {
			cajaOps.push(
				this.cajaMovimientosService.registrarSalida({
					denominaciones: data.cambioDenominaciones,
					facturaVentaId: id,
					descripcion: `Cambio factura #${id}${result?.clienteNombre ? ` - ${result.clienteNombre}` : ''}`,
					fecha,
					skipValidation: true,
				}),
			);
		}

		if (cajaOps.length) await Promise.all(cajaOps);

		this.estadisticasGateway.emitirActualizacionStats({source: 'factura_pagada', id});
		return result;
	}

	/**
	 * Editar el total de una factura ya cobrada (o con abonos) deja lo cobrado coherente con el
	 * nuevo valor: antes se editaba solo `total` y montoPagado/pagoEfectivo/pagoTransferencia
	 * quedaban con el valor viejo (cobrado y desglose por método ≠ total).
	 */
	private async ajustesPorNuevoTotal(id: number, nuevoTotal: number): Promise<QueryDeepPartialEntity<FacturasVentas>> {
		const actual = await this.repo.findOne({where: {facturaId: id}});
		if (!actual) return {};

		if (actual.estado === 'parcial') {
			// Si el nuevo total ya está cubierto por los abonos, la factura queda saldada.
			if ((actual.montoPagado ?? 0) + TOLERANCIA >= nuevoTotal) {
				return {
					estado: 'pagado',
					montoPagado: nuevoTotal,
					fechaCobro: new Date(),
					metodo: metodoSegunPagos(actual.pagoEfectivo ?? 0, actual.pagoTransferencia ?? 0),
				};
			}
			return {};
		}
		if (actual.estado !== 'pagado' && actual.estado !== 'pagada') return {};

		if (actual.metodo === 'efectivo') return {montoPagado: nuevoTotal, pagoEfectivo: nuevoTotal};
		if (actual.metodo === 'transferencia' || actual.metodo === 'qr') {
			return {montoPagado: nuevoTotal, pagoTransferencia: nuevoTotal, desgloseTransferencia: null};
		}
		if (actual.metodo === 'efectivo_transferencia') {
			// La transferencia es verificable contra el banco: se respeta y el efectivo absorbe la diferencia.
			const tr = actual.pagoTransferencia ?? 0;
			const nuevaTr = Math.min(tr, nuevoTotal);
			return {
				montoPagado: nuevoTotal,
				pagoTransferencia: nuevaTr,
				pagoEfectivo: Math.max(0, nuevoTotal - nuevaTr),
				...(nuevaTr !== tr ? {desgloseTransferencia: null} : {}),
			};
		}
		return {montoPagado: nuevoTotal};
	}

	async registrarAbono(id: number, dto: AbonoDto) {
		const factura = await this.findOne(id);

		if (factura.estado === 'pagado' || factura.estado === 'pagada' || factura.estado === 'cancelado') {
			throw new BadRequestException('No se puede abonar a una factura ya pagada o cancelada');
		}

		const metodoAbono = dto.metodo === 'transferencia' ? 'transferencia' : 'efectivo';
		if (metodoAbono === 'transferencia' && !dto.cuentaTransferenciaId && !dto.cuentaTransferenciaNombre?.trim()) {
			throw new BadRequestException('Elige la cuenta a la que entró el abono por transferencia');
		}

		// Lo ya cobrado solo cuenta si la factura es 'parcial'. Una 'pendiente' puede traer
		// montoPagado/pago_* viejos (venía de "revertir"): sumarles el abono la saldaba de golpe.
		const parcial = factura.estado === 'parcial';
		const baseMonto = parcial ? cobrado(factura) : 0;
		const basePagoEfectivo = parcial ? (factura.pagoEfectivo ?? 0) : 0;
		const basePagoTransferencia = parcial ? (factura.pagoTransferencia ?? 0) : 0;

		const saldo = Math.max(0, (factura.total ?? 0) - baseMonto);
		if (dto.monto > saldo + TOLERANCIA) {
			throw new BadRequestException(
				`El abono ($${dto.monto.toLocaleString('es-CO')}) supera el saldo pendiente ($${saldo.toLocaleString('es-CO')})`,
			);
		}

		const nuevoMonto = baseMonto + dto.monto;
		const nuevoEstado = nuevoMonto + TOLERANCIA >= (factura.total ?? 0) ? 'pagado' : 'parcial';

		// Acumular el desglose por método: registra cuánto del saldo entró en
		// efectivo y cuánto por QR/transferencia (facturas "mixtas" por abonos)
		const pagoEfectivo = basePagoEfectivo + (metodoAbono === 'efectivo' ? dto.monto : 0);
		const pagoTransferencia = basePagoTransferencia + (metodoAbono === 'transferencia' ? dto.monto : 0);

		const cambios: QueryDeepPartialEntity<FacturasVentas> = {
			montoPagado: nuevoMonto,
			estado: nuevoEstado,
			pagoEfectivo,
			pagoTransferencia,
		};

		if (metodoAbono === 'transferencia') {
			const cuenta = await this.resolverCuenta(dto.cuentaTransferenciaId, dto.cuentaTransferenciaNombre);
			// Cada abono por QR queda en SU cuenta: la factura puede abonarse a cuentas distintas.
			// Lo abonado antes (sin desglose) pertenecía a la cuenta que ya tenía la factura.
			const previo =
				(parcial ? factura.desgloseTransferencia : null) ??
				(basePagoTransferencia > 0
					? [
							{
								cuentaId: factura.cuentaTransferenciaId ?? null,
								cuenta: factura.cuentaTransferenciaNombre ?? null,
								monto: basePagoTransferencia,
							},
						]
					: []);
			cambios.desgloseTransferencia = acumularDesglose(previo, cuenta.id, cuenta.nombre, dto.monto);
			cambios.cuentaTransferenciaId = cuenta.id;
			cambios.cuentaTransferenciaNombre = cuenta.nombre;
		} else if (!parcial) {
			cambios.desgloseTransferencia = null;
		}

		// Al saldarse por abonos, derivar el método final para que la factura no
		// quede 'pagado' sin método (quedaba invisible en filtros y stats de métodos)
		if (nuevoEstado === 'pagado') {
			cambios.metodo = metodoSegunPagos(pagoEfectivo, pagoTransferencia);
			cambios.fechaCobro = new Date();
		}

		await this.repo.update(id, cambios);

		const fecha = getBogotaDateString();
		const cajaOps: Promise<unknown>[] = [];

		if (metodoAbono === 'efectivo' && dto.denominaciones && Object.keys(dto.denominaciones).length > 0) {
			cajaOps.push(
				this.cajaMovimientosService.registrarEntrada({
					denominaciones: dto.denominaciones,
					facturaVentaId: id,
					descripcion: `Abono factura #${id}${factura.clienteNombre ? ` - ${factura.clienteNombre}` : ''}`,
					fecha,
					metodo: 'efectivo',
				}),
			);
		}

		if (dto.cambioDenominaciones && Object.keys(dto.cambioDenominaciones).length > 0) {
			cajaOps.push(
				this.cajaMovimientosService.registrarSalida({
					denominaciones: dto.cambioDenominaciones,
					facturaVentaId: id,
					descripcion: `Cambio abono factura #${id}${factura.clienteNombre ? ` - ${factura.clienteNombre}` : ''}`,
					fecha,
					skipValidation: true,
				}),
			);
		}

		if (cajaOps.length) await Promise.all(cajaOps);

		this.estadisticasGateway.emitirActualizacionStats({source: 'factura_abono', id});
		return this.findOne(id);
	}

	async remove(id: number) {
		// Antes del borrado en cascada de sus órdenes: después ya no habría qué devolver.
		const res = await this.repo.manager.transaction(async (manager) => {
			await this.reconciliarOrdenesDe(id, manager, true);
			await this.cajaMovimientosService.compensarFactura(id, 'factura eliminada', manager);
			return manager.getRepository(FacturasVentas).delete(id);
		});
		this.estadisticasGateway.emitirActualizacionStats({source: 'factura_delete', id});
		return res;
	}
}
