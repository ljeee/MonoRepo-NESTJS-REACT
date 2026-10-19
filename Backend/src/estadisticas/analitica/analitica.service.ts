import {Injectable} from '@nestjs/common';
import {InjectDataSource} from '@nestjs/typeorm';
import {DataSource} from 'typeorm';
import {
	sqlCobrado,
	sqlDomicilioCuenta,
	sqlFechaBogota,
	sqlMetodoNormalizado,
	sqlMontoEfectivo,
	sqlMontoTransferencia,
	sqlPorCobrar,
	sqlTransferenciasPorCuenta,
} from '../../common/domain/ventas';
import {perfilCliente} from './cliente-perfil';
import type {
	FiltrosAnaliticaDto,
	LimiteAnaliticaDto,
	ClientesAnaliticaDto,
	ProductosAnaliticaDto,
	SaboresAnaliticaDto,
	SerieAnaliticaDto,
} from './analitica.dto';
import {
	ParametrosSql,
	Rango,
	calcularPeriodo,
	condicionesFactura,
	condicionesOrden,
	fechaBogota,
	fromFacturas,
	fromLineas,
	granularidadPorDefecto,
	hayFiltrosDeLinea,
	sqlEstadoPago,
} from './filtros';

// ─── Tipos de respuesta ───────────────────────────────────────────────────────

export interface KpisResumen {
	facturado: number;
	cobrado: number;
	porCobrar: number;
	facturas: number;
	ticket: number;
	ordenes: number;
	domicilios: number;
	canceladas: number;
	/** % de órdenes canceladas sobre el total del período (1 decimal). */
	tasaCancelacion: number;
	unidades: number;
	pizzas: number;
	/** Σ cantidad × precio de las líneas (sin domicilio ni ajustes de total). */
	ingresosLineas: number;
	/** Σ (precio de lista − precio cobrado) en líneas con precio manual. */
	descuentos: number;
}

export interface Destacados {
	pizzaMasVendida: {tamano: string | null; sabores: string[]; unidades: number} | null;
	saborMasPedido: {saborId: number | null; nombre: string; apariciones: number} | null;
	combinacionMasPedida: {sabores: string[]; pizzas: number} | null;
}

export interface FilaProducto {
	clave: string;
	nombre: string;
	productoId: number | null;
	varianteId: number | null;
	unidades: number;
	ingresos: number;
	veces: number;
	precioPromedio: number;
	pctUnidades: number;
	pctIngresos: number;
	anterior?: {unidades: number; ingresos: number} | null;
}

export interface FilaSabor {
	clave: string;
	saborId: number | null;
	nombre: string;
	/** Nombre del grupo de sabores (Pizza, Calzone…); null = sabor sin clasificar. */
	grupo: string | null;
	apariciones: number;
	porciones: number;
	ingresos: number;
	ordenes: number;
	pct: number;
	sinClasificar: boolean;
}

export interface PuntoSerie {
	periodo: string;
	facturas: number;
	facturado: number;
	cobrado: number;
	ticket: number;
	unidades: number;
}

const num = (v: unknown): number => {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
};
const redondear = (n: number, decimales = 1) => Math.round(n * 10 ** decimales) / 10 ** decimales;
const porcentaje = (parte: number, total: number) => (total > 0 ? redondear((parte / total) * 100) : 0);
const separarSabores = (combinacion: string | null): string[] => (combinacion ? combinacion.split(' + ') : []);

/** Nombre canónico del sabor: el del catálogo si existe, si no el guardado en la línea. */
const SQL_NOMBRE_SABOR = 'COALESCE(ps.nombre, s.sabor_nombre)';
const JOIN_SABORES = `JOIN ordenes_productos_sabores s ON s.orden_producto_id = op.id
		LEFT JOIN pizza_sabores ps ON ps.sabor_id = s.sabor_id
		LEFT JOIN sabor_grupos sg ON sg.id = ps.grupo_id`;
/** Combinación de sabores de la línea `op`, en orden alfabético ("Carnes + Paisa"). */
const SQL_COMBINACION = `(SELECT string_agg(COALESCE(ps_c.nombre, s_c.sabor_nombre), ' + ' ORDER BY lower(COALESCE(ps_c.nombre, s_c.sabor_nombre)))
		FROM ordenes_productos_sabores s_c LEFT JOIN pizza_sabores ps_c ON ps_c.sabor_id = s_c.sabor_id
		WHERE s_c.orden_producto_id = op.id)`;

const ORDEN_TAMANOS = ['pequena', 'mediana', 'grande'];
const PG_GRANULARIDAD = {dia: 'day', semana: 'week', mes: 'month'} as const;

/**
 * Analítica de ventas. Todas las métricas salen de las definiciones de
 * common/domain/ventas.ts y los filtros de ./filtros.ts, para que cada endpoint
 * cuente igual.
 */
@Injectable()
export class AnaliticaService {
	constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

	private consultar<T>(sql: string, p: ParametrosSql): Promise<T[]> {
		return this.dataSource.query(sql, p.valores);
	}

	/** Perfil de un cliente (resumen de dinero, hábitos, favoritos y sus órdenes más recientes). */
	clientePerfil(telefono: string, limiteOrdenes = 100) {
		return perfilCliente((sql, params) => this.dataSource.query(sql, params), telefono, limiteOrdenes);
	}

	// ─── Resumen ─────────────────────────────────────────────────────────────────

	async resumen(filtros: FiltrosAnaliticaDto) {
		const periodo = calcularPeriodo(filtros.from, filtros.to, filtros.comparar);
		const [actual, anterior, destacados] = await Promise.all([
			this.kpis(filtros, periodo.actual),
			periodo.anterior ? this.kpis(filtros, periodo.anterior) : Promise.resolve(null),
			this.destacados(filtros, periodo.actual),
		]);
		return {
			periodo: this.describirPeriodo(filtros, periodo),
			filtrosDeLinea: hayFiltrosDeLinea(filtros),
			actual,
			anterior,
			destacados,
		};
	}

	private describirPeriodo(filtros: FiltrosAnaliticaDto, periodo: ReturnType<typeof calcularPeriodo>) {
		return {
			from: filtros.from,
			to: filtros.to,
			dias: periodo.dias,
			inicio: periodo.actual.inicio.toISOString(),
			fin: periodo.actual.fin.toISOString(),
			anterior: periodo.anterior
				? {inicio: periodo.anterior.inicio.toISOString(), fin: periodo.anterior.fin.toISOString()}
				: null,
		};
	}

	async kpis(filtros: FiltrosAnaliticaDto, rango: Rango): Promise<KpisResumen> {
		const pF = new ParametrosSql();
		const sqlFacturas = `SELECT COUNT(*)::int AS facturas,
				COALESCE(SUM(f.total), 0)::float8 AS facturado,
				COALESCE(SUM(${sqlCobrado('f')}), 0)::float8 AS cobrado,
				COALESCE(SUM(${sqlPorCobrar('f')}), 0)::float8 AS por_cobrar
			${fromFacturas(filtros, rango, pF)}`;

		const pO = new ParametrosSql();
		const sqlOrdenes = `SELECT COUNT(*)::int AS ordenes,
				COUNT(*) FILTER (WHERE o.tipo_pedido = 'domicilio')::int AS domicilios
			FROM ordenes o
			JOIN facturas_ventas f ON f.factura_id = o.factura_id
			WHERE ${[
				...condicionesFactura(filtros, rango, pO, {ordenComoExists: false}),
				`o.estado_orden IS DISTINCT FROM 'cancelado'`,
				...condicionesOrden(filtros, pO, 'o'),
			].join(' AND ')}`;

		// Canceladas: una orden cancelada o con su factura anulada. Solo se le aplican los
		// filtros que tienen sentido para algo que no se cobró (fecha y datos de la orden).
		const pC = new ParametrosSql();
		const sqlCanceladas = `SELECT COUNT(*)::int AS canceladas
			FROM ordenes o
			JOIN facturas_ventas f ON f.factura_id = o.factura_id
			WHERE ${[
				`f."fechaFactura" BETWEEN ${pC.agregar(rango.inicio)} AND ${pC.agregar(rango.fin)}`,
				`(o.estado_orden = 'cancelado' OR f.estado = 'cancelado')`,
				...condicionesOrden(filtros, pC, 'o'),
			].join(' AND ')}`;

		const pL = new ParametrosSql();
		const sqlLineas = `SELECT COALESCE(SUM(op.cantidad), 0)::float8 AS unidades,
				COALESCE(SUM(op.cantidad) FILTER (WHERE op.categoria = 'pizza'), 0)::float8 AS pizzas,
				COALESCE(SUM(op.cantidad * op.precio_unitario), 0)::float8 AS ingresos_lineas,
				COALESCE(SUM((op.precio_lista - op.precio_unitario) * op.cantidad)
					FILTER (WHERE op.precio_manual IS TRUE AND op.precio_lista > op.precio_unitario), 0)::float8 AS descuentos
			${fromLineas(filtros, rango, pL)}`;

		const [[f], [o], [c], [l]] = await Promise.all([
			this.consultar<{facturas: number; facturado: number; cobrado: number; por_cobrar: number}>(sqlFacturas, pF),
			this.consultar<{ordenes: number; domicilios: number}>(sqlOrdenes, pO),
			this.consultar<{canceladas: number}>(sqlCanceladas, pC),
			this.consultar<{unidades: number; pizzas: number; ingresos_lineas: number; descuentos: number}>(
				sqlLineas,
				pL,
			),
		]);

		const facturas = num(f?.facturas);
		const facturado = num(f?.facturado);
		const ordenes = num(o?.ordenes);
		const canceladas = num(c?.canceladas);
		return {
			facturado,
			cobrado: num(f?.cobrado),
			porCobrar: num(f?.por_cobrar),
			facturas,
			ticket: facturas > 0 ? Math.round(facturado / facturas) : 0,
			ordenes,
			domicilios: num(o?.domicilios),
			canceladas,
			tasaCancelacion: porcentaje(canceladas, ordenes + canceladas),
			unidades: num(l?.unidades),
			pizzas: num(l?.pizzas),
			ingresosLineas: num(l?.ingresos_lineas),
			descuentos: num(l?.descuentos),
		};
	}

	async destacados(filtros: FiltrosAnaliticaDto, rango: Rango): Promise<Destacados> {
		const pP = new ParametrosSql();
		const sqlPizza = `WITH lineas AS (
				SELECT op.cantidad, op.tamano, ${SQL_COMBINACION} AS combinacion
				${fromLineas(filtros, rango, pP)} AND op.categoria = 'pizza'
			)
			SELECT tamano, combinacion, SUM(cantidad)::float8 AS unidades
			FROM lineas WHERE combinacion IS NOT NULL
			GROUP BY tamano, combinacion
			ORDER BY unidades DESC, combinacion
			LIMIT 1`;

		const pC = new ParametrosSql();
		const sqlCombinacion = `WITH lineas AS (
				SELECT op.cantidad, ${SQL_COMBINACION} AS combinacion,
					(SELECT COUNT(*) FROM ordenes_productos_sabores s_n WHERE s_n.orden_producto_id = op.id) AS n
				${fromLineas(filtros, rango, pC)}
			)
			SELECT combinacion, SUM(cantidad)::float8 AS pizzas
			FROM lineas WHERE n >= 2
			GROUP BY combinacion
			ORDER BY pizzas DESC, combinacion
			LIMIT 1`;

		const [[pizza], [combinacion], sabores] = await Promise.all([
			this.consultar<{tamano: string | null; combinacion: string; unidades: number}>(sqlPizza, pP),
			this.consultar<{combinacion: string; pizzas: number}>(sqlCombinacion, pC),
			this.agregadoSabores(filtros, rango, 'apariciones', 1),
		]);
		const top = sabores.filas[0];

		return {
			pizzaMasVendida: pizza
				? {tamano: pizza.tamano, sabores: separarSabores(pizza.combinacion), unidades: num(pizza.unidades)}
				: null,
			saborMasPedido: top ? {saborId: top.saborId, nombre: top.nombre, apariciones: top.apariciones} : null,
			combinacionMasPedida: combinacion
				? {sabores: separarSabores(combinacion.combinacion), pizzas: num(combinacion.pizzas)}
				: null,
		};
	}

	// ─── Productos ───────────────────────────────────────────────────────────────

	async productos(dto: ProductosAnaliticaDto) {
		const periodo = calcularPeriodo(dto.from, dto.to, dto.comparar);
		const agrupar = dto.agrupar ?? 'producto';
		const actual = await this.agregadoProductos(dto, periodo.actual, {
			agrupar,
			orden: dto.orden ?? 'unidades',
			limit: dto.limit ?? 50,
			offset: dto.offset ?? 0,
			q: dto.q?.trim() || null,
		});

		if (periodo.anterior && actual.filas.length) {
			const previo = await this.agregadoProductos(dto, periodo.anterior, {
				agrupar,
				claves: actual.filas.map((f) => f.clave),
			});
			const porClave = new Map(previo.filas.map((f) => [f.clave, f]));
			for (const fila of actual.filas) {
				const p = porClave.get(fila.clave);
				fila.anterior = p ? {unidades: p.unidades, ingresos: p.ingresos} : {unidades: 0, ingresos: 0};
			}
		}

		return {periodo: this.describirPeriodo(dto, periodo), agrupar, ...actual};
	}

	private async agregadoProductos(
		filtros: FiltrosAnaliticaDto,
		rango: Rango,
		opciones: {
			agrupar: NonNullable<ProductosAnaliticaDto['agrupar']>;
			orden?: NonNullable<ProductosAnaliticaDto['orden']>;
			limit?: number;
			offset?: number;
			q?: string | null;
			claves?: string[];
		},
	) {
		const nombreProducto = 'COALESCE(p.producto_nombre, op.producto_base)';
		const nombreVariante = 'COALESCE(pv.nombre, op.variante_nombre)';
		const agrupaciones = {
			producto: {
				clave: `COALESCE(op."productoObjProductoId"::text, 'n:' || lower(COALESCE(op.producto_base, op.producto, '')))`,
				nombre: `MAX(COALESCE(${nombreProducto}, op.producto))`,
				producto: `MAX(op."productoObjProductoId")`,
				variante: 'NULL::int',
				extra: '',
			},
			variante: {
				clave: `COALESCE(op.variante_id::text, 'n:' || lower(COALESCE(op.producto, '')))`,
				nombre: `MAX(CASE WHEN ${nombreProducto} IS NOT NULL AND ${nombreVariante} IS NOT NULL
					THEN ${nombreProducto} || ' - ' || ${nombreVariante} ELSE op.producto END)`,
				producto: `MAX(op."productoObjProductoId")`,
				variante: 'MAX(op.variante_id)',
				extra: '',
			},
			tamano: {
				clave: 'op.tamano',
				nombre: 'op.tamano',
				producto: 'NULL::int',
				variante: 'NULL::int',
				extra: 'AND op.tamano IS NOT NULL',
			},
			categoria: {
				clave: `COALESCE(op.categoria, 'otro')`,
				nombre: `COALESCE(op.categoria, 'otro')`,
				producto: 'NULL::int',
				variante: 'NULL::int',
				extra: '',
			},
		};
		const g = agrupaciones[opciones.agrupar];
		const p = new ParametrosSql();
		const from = fromLineas(
			filtros,
			rango,
			p,
			`LEFT JOIN productos p ON p.producto_id = op."productoObjProductoId"
			LEFT JOIN producto_variantes pv ON pv.variante_id = op.variante_id`,
		);
		const columnaOrden = {unidades: 'unidades', ingresos: 'ingresos', veces: 'veces'}[opciones.orden ?? 'unidades'];
		const filtroClaves = opciones.claves ? `WHERE t.clave = ANY(${p.agregar(opciones.claves)})` : '';
		const filtroQ = opciones.q
			? `${filtroClaves ? 'AND' : 'WHERE'} t.nombre ILIKE ${p.agregar(`%${opciones.q}%`)}`
			: '';
		const paginacion =
			opciones.limit != null
				? `LIMIT ${p.agregar(opciones.limit)} OFFSET ${p.agregar(opciones.offset ?? 0)}`
				: '';

		const sql = `WITH g AS (
				SELECT ${g.clave} AS clave, ${g.nombre} AS nombre,
					${g.producto} AS producto_id, ${g.variante} AS variante_id,
					SUM(op.cantidad)::float8 AS unidades,
					COALESCE(SUM(op.cantidad * op.precio_unitario), 0)::float8 AS ingresos,
					COUNT(DISTINCT o.orden_id)::int AS veces
				${from} ${g.extra}
				GROUP BY 1
			), t AS (
				SELECT g.*, SUM(unidades) OVER () AS total_unidades, SUM(ingresos) OVER () AS total_ingresos FROM g
			)
			SELECT t.*, COUNT(*) OVER ()::int AS total_filas
			FROM t ${filtroClaves} ${filtroQ}
			ORDER BY ${columnaOrden} DESC, nombre ASC
			${paginacion}`;

		const filas = await this.consultar<{
			clave: string;
			nombre: string;
			producto_id: number | null;
			variante_id: number | null;
			unidades: number;
			ingresos: number;
			veces: number;
			total_unidades: number;
			total_ingresos: number;
			total_filas: number;
		}>(sql, p);

		const totalUnidades = num(filas[0]?.total_unidades);
		const totalIngresos = num(filas[0]?.total_ingresos);
		return {
			total: num(filas[0]?.total_filas),
			totales: {unidades: totalUnidades, ingresos: totalIngresos},
			filas: filas.map<FilaProducto>((f) => {
				const unidades = num(f.unidades);
				const ingresos = num(f.ingresos);
				return {
					clave: f.clave,
					nombre: f.nombre,
					productoId: f.producto_id != null ? num(f.producto_id) : null,
					varianteId: f.variante_id != null ? num(f.variante_id) : null,
					unidades,
					ingresos,
					veces: num(f.veces),
					precioPromedio: unidades > 0 ? Math.round(ingresos / unidades) : 0,
					pctUnidades: porcentaje(unidades, totalUnidades),
					pctIngresos: porcentaje(ingresos, totalIngresos),
				};
			}),
		};
	}

	// ─── Sabores ─────────────────────────────────────────────────────────────────

	async sabores(dto: SaboresAnaliticaDto) {
		const periodo = calcularPeriodo(dto.from, dto.to, false);
		const metrica = dto.metrica ?? 'apariciones';
		const resultado = await this.agregadoSabores(dto, periodo.actual, metrica, dto.limit ?? 50);
		return {periodo: this.describirPeriodo(dto, periodo), metrica, ...resultado};
	}

	private async agregadoSabores(
		filtros: FiltrosAnaliticaDto,
		rango: Rango,
		metrica: NonNullable<SaboresAnaliticaDto['metrica']>,
		limit: number,
	) {
		const p = new ParametrosSql();
		const sql = `WITH g AS (
				SELECT COALESCE(s.sabor_id::text, 'n:' || lower(s.sabor_nombre)) AS clave,
					MAX(s.sabor_id) AS sabor_id,
					MAX(${SQL_NOMBRE_SABOR}) AS nombre,
					MAX(sg.nombre) AS grupo,
					SUM(op.cantidad)::float8 AS apariciones,
					SUM(op.cantidad * s.fraccion)::float8 AS porciones,
					COALESCE(SUM(op.cantidad * op.precio_unitario * s.fraccion), 0)::float8 AS ingresos,
					COUNT(DISTINCT o.orden_id)::int AS ordenes,
					BOOL_AND(s.sabor_id IS NULL) AS sin_clasificar
				${fromLineas(filtros, rango, p, JOIN_SABORES)}
				GROUP BY 1
			)
			SELECT g.*,
				SUM(g.${metrica}) OVER ()::float8 AS total,
				COALESCE(SUM(g.apariciones) FILTER (WHERE g.sin_clasificar) OVER (), 0)::float8 AS total_sin_clasificar_apariciones,
				COALESCE(SUM(g.porciones) FILTER (WHERE g.sin_clasificar) OVER (), 0)::float8 AS total_sin_clasificar_porciones
			FROM g
			ORDER BY g.${metrica} DESC, g.nombre ASC
			LIMIT ${p.agregar(limit)}`;

		const filas = await this.consultar<{
			clave: string;
			sabor_id: number | null;
			nombre: string;
			grupo: string | null;
			apariciones: number;
			porciones: number;
			ingresos: number;
			ordenes: number;
			sin_clasificar: boolean;
			total: number;
			total_sin_clasificar_apariciones: number;
			total_sin_clasificar_porciones: number;
		}>(sql, p);

		const total = num(filas[0]?.total);
		return {
			total,
			sinClasificar: {
				apariciones: num(filas[0]?.total_sin_clasificar_apariciones),
				porciones: num(filas[0]?.total_sin_clasificar_porciones),
			},
			filas: filas.map<FilaSabor>((f) => ({
				clave: f.clave,
				saborId: f.sabor_id != null ? num(f.sabor_id) : null,
				nombre: f.nombre,
				grupo: f.grupo,
				apariciones: num(f.apariciones),
				porciones: redondear(num(f.porciones), 2),
				ingresos: Math.round(num(f.ingresos)),
				ordenes: num(f.ordenes),
				pct: porcentaje(num(f[metrica]), total),
				sinClasificar: Boolean(f.sin_clasificar),
			})),
		};
	}

	/** Sabor × tamaño (solo pizzas con tamaño). */
	async saboresMatriz(dto: SaboresAnaliticaDto) {
		const periodo = calcularPeriodo(dto.from, dto.to, false);
		const p = new ParametrosSql();
		const sql = `SELECT COALESCE(s.sabor_id::text, 'n:' || lower(s.sabor_nombre)) AS clave,
				MAX(s.sabor_id) AS sabor_id,
				MAX(${SQL_NOMBRE_SABOR}) AS nombre,
				op.tamano,
				SUM(op.cantidad)::float8 AS apariciones,
				SUM(op.cantidad * s.fraccion)::float8 AS porciones
			${fromLineas(dto, periodo.actual, p, JOIN_SABORES)} AND op.tamano IS NOT NULL
			GROUP BY 1, op.tamano`;
		const filas = await this.consultar<{
			clave: string;
			sabor_id: number | null;
			nombre: string;
			tamano: string;
			apariciones: number;
			porciones: number;
		}>(sql, p);

		const porSabor = new Map<
			string,
			{
				clave: string;
				saborId: number | null;
				nombre: string;
				total: {apariciones: number; porciones: number};
				porTamano: Record<string, {apariciones: number; porciones: number}>;
			}
		>();
		const tamanos = new Set<string>();
		for (const f of filas) {
			tamanos.add(f.tamano);
			const entrada = porSabor.get(f.clave) ?? {
				clave: f.clave,
				saborId: f.sabor_id != null ? num(f.sabor_id) : null,
				nombre: f.nombre,
				total: {apariciones: 0, porciones: 0},
				porTamano: {},
			};
			const celda = {apariciones: num(f.apariciones), porciones: redondear(num(f.porciones), 2)};
			entrada.porTamano[f.tamano] = celda;
			entrada.total.apariciones += celda.apariciones;
			entrada.total.porciones = redondear(entrada.total.porciones + celda.porciones, 2);
			porSabor.set(f.clave, entrada);
		}

		const metrica = dto.metrica ?? 'apariciones';
		return {
			periodo: this.describirPeriodo(dto, periodo),
			metrica,
			tamanos: [...tamanos].sort((a, b) => ORDEN_TAMANOS.indexOf(a) - ORDEN_TAMANOS.indexOf(b)),
			filas: [...porSabor.values()].sort(
				(a, b) => b.total[metrica] - a.total[metrica] || a.nombre.localeCompare(b.nombre),
			),
		};
	}

	/** Combinaciones (mitad y mitad, tres sabores) más pedidas. */
	async combinaciones(dto: LimiteAnaliticaDto) {
		const periodo = calcularPeriodo(dto.from, dto.to, false);
		const p = new ParametrosSql();
		const sql = `WITH lineas AS (
				SELECT op.cantidad, ${SQL_COMBINACION} AS combinacion,
					(SELECT COUNT(*) FROM ordenes_productos_sabores s_n WHERE s_n.orden_producto_id = op.id) AS n
				${fromLineas(dto, periodo.actual, p)}
			)
			SELECT combinacion, SUM(cantidad)::float8 AS pizzas, COUNT(*)::int AS lineas
			FROM lineas WHERE n >= 2
			GROUP BY combinacion
			ORDER BY pizzas DESC, combinacion
			LIMIT ${p.agregar(dto.limit ?? 20)}`;
		const filas = await this.consultar<{combinacion: string; pizzas: number; lineas: number}>(sql, p);
		return {
			periodo: this.describirPeriodo(dto, periodo),
			filas: filas.map((f) => ({
				sabores: separarSabores(f.combinacion),
				pizzas: num(f.pizzas),
				lineas: num(f.lineas),
			})),
		};
	}

	// ─── Serie temporal ──────────────────────────────────────────────────────────

	async serie(dto: SerieAnaliticaDto) {
		const periodo = calcularPeriodo(dto.from, dto.to, dto.comparar);
		const granularidad = dto.granularidad ?? granularidadPorDefecto(periodo.dias);
		const [puntos, anterior] = await Promise.all([
			this.puntosSerie(dto, periodo.actual, granularidad),
			periodo.anterior ? this.puntosSerie(dto, periodo.anterior, granularidad) : Promise.resolve(null),
		]);
		return {periodo: this.describirPeriodo(dto, periodo), granularidad, puntos, anterior};
	}

	private async puntosSerie(
		filtros: FiltrosAnaliticaDto,
		rango: Rango,
		granularidad: NonNullable<SerieAnaliticaDto['granularidad']>,
	): Promise<PuntoSerie[]> {
		const p = new ParametrosSql();
		const unidad = p.agregar(PG_GRANULARIDAD[granularidad]);
		const desde = p.agregar(fechaBogota(rango.inicio));
		const hasta = p.agregar(fechaBogota(rango.fin));
		const paso = p.agregar(`1 ${PG_GRANULARIDAD[granularidad]}`);
		const fecha = sqlFechaBogota('f');
		const sql = `WITH periodos AS (
				SELECT generate_series(date_trunc(${unidad}, ${desde}::timestamp), date_trunc(${unidad}, ${hasta}::timestamp), ${paso}::interval)::date AS periodo
			), fact AS (
				SELECT date_trunc(${unidad}, ${fecha})::date AS periodo,
					COUNT(*)::int AS facturas,
					COALESCE(SUM(f.total), 0)::float8 AS facturado,
					COALESCE(SUM(${sqlCobrado('f')}), 0)::float8 AS cobrado
				${fromFacturas(filtros, rango, p)}
				GROUP BY 1
			), lin AS (
				SELECT date_trunc(${unidad}, ${fecha})::date AS periodo, COALESCE(SUM(op.cantidad), 0)::float8 AS unidades
				${fromLineas(filtros, rango, p)}
				GROUP BY 1
			)
			SELECT to_char(pe.periodo, 'YYYY-MM-DD') AS periodo,
				COALESCE(fact.facturas, 0)::int AS facturas,
				COALESCE(fact.facturado, 0)::float8 AS facturado,
				COALESCE(fact.cobrado, 0)::float8 AS cobrado,
				COALESCE(lin.unidades, 0)::float8 AS unidades
			FROM periodos pe
			LEFT JOIN fact ON fact.periodo = pe.periodo
			LEFT JOIN lin ON lin.periodo = pe.periodo
			ORDER BY pe.periodo`;
		const filas = await this.consultar<{
			periodo: string;
			facturas: number;
			facturado: number;
			cobrado: number;
			unidades: number;
		}>(sql, p);
		return filas.map((f) => {
			const facturas = num(f.facturas);
			const facturado = num(f.facturado);
			return {
				periodo: f.periodo,
				facturas,
				facturado,
				cobrado: num(f.cobrado),
				ticket: facturas > 0 ? Math.round(facturado / facturas) : 0,
				unidades: num(f.unidades),
			};
		});
	}

	// ─── Horarios ────────────────────────────────────────────────────────────────

	async horarios(dto: FiltrosAnaliticaDto) {
		const periodo = calcularPeriodo(dto.from, dto.to, false);
		const p = new ParametrosSql();
		const fecha = sqlFechaBogota('f');
		const sql = `SELECT EXTRACT(ISODOW FROM ${fecha})::int AS dia_semana,
				EXTRACT(HOUR FROM ${fecha})::int AS hora,
				COUNT(*)::int AS facturas,
				COALESCE(SUM(f.total), 0)::float8 AS facturado
			${fromFacturas(dto, periodo.actual, p)}
			GROUP BY 1, 2`;
		const filas = await this.consultar<{dia_semana: number; hora: number; facturas: number; facturado: number}>(
			sql,
			p,
		);

		const celdas = filas.map((f) => ({
			diaSemana: num(f.dia_semana),
			hora: num(f.hora),
			facturas: num(f.facturas),
			facturado: num(f.facturado),
		}));
		const porHora = Array.from({length: 24}, (_, hora) => ({hora, facturas: 0, facturado: 0}));
		const porDia = Array.from({length: 7}, (_, i) => ({diaSemana: i + 1, facturas: 0, facturado: 0}));
		for (const c of celdas) {
			porHora[c.hora].facturas += c.facturas;
			porHora[c.hora].facturado += c.facturado;
			porDia[c.diaSemana - 1].facturas += c.facturas;
			porDia[c.diaSemana - 1].facturado += c.facturado;
		}
		return {periodo: this.describirPeriodo(dto, periodo), celdas, porHora, porDia};
	}

	// ─── Mezcla (tipo de pedido, método, categoría, canal, estado) ──────────────

	async mix(dto: FiltrosAnaliticaDto) {
		const periodo = calcularPeriodo(dto.from, dto.to, false);
		const rango = periodo.actual;

		const pM = new ParametrosSql();
		const sqlMetodo = `SELECT ${sqlMetodoNormalizado('f')} AS clave, COUNT(*)::int AS facturas,
				COALESCE(SUM(f.total), 0)::float8 AS facturado,
				COALESCE(SUM(${sqlMontoEfectivo('f')}), 0)::float8 AS efectivo,
				COALESCE(SUM(${sqlMontoTransferencia('f')}), 0)::float8 AS transferencia
			${fromFacturas(dto, rango, pM)}
			GROUP BY 1`;

		// Lo cobrado por transferencia, por cuenta (id; el nombre es el vigente de la tabla). Una factura
		// abonada a varias cuentas aporta una fila por cuenta; sin cuenta = "Sin asignar".
		const pCu = new ParametrosSql();
		const sqlCuentas = `SELECT MAX(cuenta_id) AS cuenta_id, MAX(cuenta) AS cuenta,
				COUNT(DISTINCT factura_id)::int AS facturas, COALESCE(SUM(monto), 0)::float8 AS monto
			FROM (${sqlTransferenciasPorCuenta(condicionesFactura(dto, rango, pCu).join(' AND '))}) x
			GROUP BY COALESCE(cuenta_id::text, 'n:' || cuenta, 'sin')
			ORDER BY monto DESC`;

		const pE = new ParametrosSql();
		const sqlEstado = `SELECT ${sqlEstadoPago('f')} AS clave, COUNT(*)::int AS facturas,
				COALESCE(SUM(f.total), 0)::float8 AS facturado,
				COALESCE(SUM(${sqlCobrado('f')}), 0)::float8 AS cobrado,
				COALESCE(SUM(${sqlPorCobrar('f')}), 0)::float8 AS por_cobrar
			${fromFacturas(dto, rango, pE)}
			GROUP BY 1`;

		const porOrden = (columna: string) => {
			const p = new ParametrosSql();
			const sql = `SELECT ${columna} AS clave, COUNT(*)::int AS ordenes, COALESCE(SUM(f.total), 0)::float8 AS facturado
				FROM ordenes o
				JOIN facturas_ventas f ON f.factura_id = o.factura_id
				WHERE ${[
					...condicionesFactura(dto, rango, p, {ordenComoExists: false}),
					`o.estado_orden IS DISTINCT FROM 'cancelado'`,
					...condicionesOrden(dto, p, 'o'),
				].join(' AND ')}
				GROUP BY 1
				ORDER BY ordenes DESC`;
			return this.consultar<{clave: string; ordenes: number; facturado: number}>(sql, p);
		};

		const pCat = new ParametrosSql();
		const sqlCategoria = `SELECT COALESCE(op.categoria, 'otro') AS clave,
				COALESCE(SUM(op.cantidad), 0)::float8 AS unidades,
				COALESCE(SUM(op.cantidad * op.precio_unitario), 0)::float8 AS ingresos
			${fromLineas(dto, rango, pCat)}
			GROUP BY 1
			ORDER BY ingresos DESC`;

		const [metodos, cuentas, estados, tipos, canales, categorias] = await Promise.all([
			this.consultar<{
				clave: string;
				facturas: number;
				facturado: number;
				efectivo: number;
				transferencia: number;
			}>(sqlMetodo, pM),
			this.consultar<{cuenta_id: number | null; cuenta: string | null; facturas: number; monto: number}>(
				sqlCuentas,
				pCu,
			),
			this.consultar<{clave: string; facturas: number; facturado: number; cobrado: number; por_cobrar: number}>(
				sqlEstado,
				pE,
			),
			porOrden(`COALESCE(o.tipo_pedido, 'mesa')`),
			porOrden(`COALESCE(o.canal, 'historico')`),
			this.consultar<{clave: string; unidades: number; ingresos: number}>(sqlCategoria, pCat),
		]);

		return {
			periodo: this.describirPeriodo(dto, periodo),
			metodoPago: metodos
				.map((m) => ({clave: m.clave, facturas: num(m.facturas), facturado: num(m.facturado)}))
				.sort((a, b) => b.facturado - a.facturado),
			cobradoPorMetodo: {
				efectivo: metodos.reduce((s, m) => s + num(m.efectivo), 0),
				transferencia: metodos.reduce((s, m) => s + num(m.transferencia), 0),
			},
			porCuenta: cuentas.map((c) => ({
				cuentaId: c.cuenta_id != null ? num(c.cuenta_id) : null,
				cuenta: c.cuenta ?? 'Sin asignar',
				sinAsignar: c.cuenta_id == null && !c.cuenta,
				facturas: num(c.facturas),
				monto: num(c.monto),
			})),
			estadoPago: estados.map((e) => ({
				clave: e.clave,
				facturas: num(e.facturas),
				facturado: num(e.facturado),
				cobrado: num(e.cobrado),
				porCobrar: num(e.por_cobrar),
			})),
			tipoPedido: tipos.map((t) => ({clave: t.clave, ordenes: num(t.ordenes), facturado: num(t.facturado)})),
			canal: canales.map((t) => ({clave: t.clave, ordenes: num(t.ordenes), facturado: num(t.facturado)})),
			categoria: categorias.map((c) => ({clave: c.clave, unidades: num(c.unidades), ingresos: num(c.ingresos)})),
		};
	}

	// ─── Clientes y domiciliarios ────────────────────────────────────────────────

	async clientes(dto: ClientesAnaliticaDto) {
		const periodo = calcularPeriodo(dto.from, dto.to, false);
		const p = new ParametrosSql();
		/** Con `telefonos` solo se consultan esos clientes (la lista del POS pide los de la página que se ve). */
		const telefonos = (dto.telefonos ?? []).map((t) => t.replace(/\D/g, '').slice(-10)).filter(Boolean);
		const limite = telefonos.length ? telefonos.length : (dto.limit ?? 20);
		const offset = telefonos.length ? 0 : (dto.offset ?? 0);
		// Orden en el SQL (no en la pantalla) y con desempate por clave: las páginas no se solapan ni saltan clientes.
		const orden =
			dto.orden === 'facturas'
				? 'facturas DESC, gasto DESC'
				: dto.orden === 'ticket'
					? 'gasto / NULLIF(facturas, 0) DESC NULLS LAST, gasto DESC'
					: dto.orden === 'ultimaVisita'
						? 'ultima_visita DESC'
						: 'gasto DESC';
		const sql = `WITH base AS (
				SELECT f.total, f."fechaFactura" AS fecha, NULLIF(trim(f.cliente_nombre), '') AS nombre,
					-- Teléfono en su forma local de 10 dígitos: "+57 300…" y "300…" son el mismo cliente.
					NULLIF(right(regexp_replace(COALESCE(
						NULLIF(f.telefono_cliente, ''),
						(SELECT d.telefono FROM domicilios d WHERE d.factura_id = f.factura_id AND NULLIF(d.telefono, '') IS NOT NULL LIMIT 1)
					), '\\D', '', 'g'), 10), '') AS telefono
				${fromFacturas(dto, periodo.actual, p)}
			),
			clientes AS (
				SELECT COALESCE(telefono, 'n:' || lower(nombre)) AS clave,
					MAX(telefono) AS telefono,
					(array_agg(nombre ORDER BY fecha DESC) FILTER (WHERE nombre IS NOT NULL))[1] AS nombre,
					COUNT(*)::int AS facturas,
					COALESCE(SUM(total), 0)::float8 AS gasto,
					COALESCE(MAX(total), 0)::float8 AS pedido_maximo,
					MAX(fecha) AS ultima_visita
				FROM base
				WHERE ${
					telefonos.length
						? `telefono = ANY(${p.agregar(telefonos)})`
						: `telefono IS NOT NULL OR (nombre IS NOT NULL AND nombre !~* '^mesa( |$)' AND nombre !~ '^[0-9]+$')`
				}
				GROUP BY 1
			),
			-- Totales de TODOS los clientes del período, no de la página que se ve.
			totales AS (
				SELECT COUNT(*)::int AS clientes, (COUNT(*) FILTER (WHERE facturas > 1))::int AS recurrentes,
					COALESCE(SUM(gasto), 0)::float8 AS gasto
				FROM clientes
			)
			SELECT pagina.*, t.clientes AS total_clientes, t.recurrentes AS total_recurrentes, t.gasto AS total_gasto
			FROM totales t
			LEFT JOIN LATERAL (
				SELECT * FROM clientes
				ORDER BY ${orden}, clave ASC
				LIMIT ${p.agregar(limite)} OFFSET ${p.agregar(offset)}
			) pagina ON true`;
		const filas = await this.consultar<{
			clave: string | null;
			telefono: string | null;
			nombre: string | null;
			facturas: number;
			gasto: number;
			pedido_maximo: number;
			ultima_visita: Date | string;
			total_clientes: number;
			total_recurrentes: number;
			total_gasto: number;
		}>(sql, p);
		const primera = filas[0];
		return {
			periodo: this.describirPeriodo(dto, periodo),
			total: num(primera?.total_clientes),
			resumen: {
				clientes: num(primera?.total_clientes),
				recurrentes: num(primera?.total_recurrentes),
				gasto: num(primera?.total_gasto),
			},
			// Sin clientes (o página fuera de rango) el LATERAL deja una fila solo con los totales.
			filas: filas
				.filter((f) => f.clave != null)
				.map((f) => {
					const facturas = num(f.facturas);
					const gasto = num(f.gasto);
					return {
						clave: f.clave as string,
						telefono: f.telefono,
						nombre: f.nombre ?? f.telefono ?? 'Sin nombre',
						facturas,
						gasto,
						ticket: facturas > 0 ? Math.round(gasto / facturas) : 0,
						pedidoMaximo: num(f.pedido_maximo),
						ultimaVisita: f.ultima_visita instanceof Date ? f.ultima_visita.toISOString() : f.ultima_visita,
					};
				}),
		};
	}

	async domiciliarios(dto: FiltrosAnaliticaDto) {
		const periodo = calcularPeriodo(dto.from, dto.to, false);
		// Cada domicilio cuenta para su repartidor desde que se le ASIGNA (no hace falta marcarlo entregado), y lo
		// que se le paga es el costo de domicilio de esos. Solo se excluyen los cancelados (sqlDomicilioCuenta).
		const p = new ParametrosSql();
		const sql = `SELECT d.telefono_domiciliario_asignado AS telefono,
				MAX(dm.domiciliario_nombre) AS nombre,
				COUNT(*)::int AS asignados,
				COALESCE(SUM(d.costo_domicilio), 0)::float8 AS ganancia,
				COALESCE(AVG(f.total), 0)::float8 AS ticket_promedio
			FROM domicilios d
			JOIN facturas_ventas f ON f.factura_id = d.factura_id
			LEFT JOIN domiciliarios dm ON dm.telefono = d.telefono_domiciliario_asignado
			WHERE ${[...condicionesFactura(dto, periodo.actual, p), `d.telefono_domiciliario_asignado IS NOT NULL`, sqlDomicilioCuenta('d')].join(' AND ')}
			GROUP BY d.telefono_domiciliario_asignado
			ORDER BY asignados DESC, ganancia DESC`;
		const filas = await this.consultar<{
			telefono: string;
			nombre: string | null;
			asignados: number;
			ganancia: number;
			ticket_promedio: number;
		}>(sql, p);

		// Todos los domicilios del período (también los que aún no tienen repartidor) y el detalle por día y
		// repartidor: lo que mostraba la vista "Resumen domiciliarios" (cuántos salieron hoy, cuánto se les paga).
		const pT = new ParametrosSql();
		const [totales] = await this.consultar<{total: number; sin_repartidor: number; costo: number; a_pagar: number}>(
			`SELECT COUNT(*)::int AS total,
				COUNT(*) FILTER (WHERE d.telefono_domiciliario_asignado IS NULL)::int AS sin_repartidor,
				COALESCE(SUM(d.costo_domicilio), 0)::float8 AS costo,
				COALESCE(SUM(d.costo_domicilio) FILTER (WHERE d.telefono_domiciliario_asignado IS NOT NULL), 0)::float8 AS a_pagar
			 FROM domicilios d JOIN facturas_ventas f ON f.factura_id = d.factura_id
			 WHERE ${[...condicionesFactura(dto, periodo.actual, pT), sqlDomicilioCuenta('d')].join(' AND ')}`,
			pT,
		);
		const pD = new ParametrosSql();
		const porDia = await this.consultar<{
			dia: string;
			telefono: string | null;
			nombre: string | null;
			domicilios: number;
			ganancia: number;
		}>(
			`SELECT to_char(${sqlFechaBogota('f')}, 'YYYY-MM-DD') AS dia, d.telefono_domiciliario_asignado AS telefono,
				MAX(dm.domiciliario_nombre) AS nombre, COUNT(*)::int AS domicilios,
				COALESCE(SUM(d.costo_domicilio) FILTER (WHERE d.telefono_domiciliario_asignado IS NOT NULL), 0)::float8 AS ganancia
			 FROM domicilios d JOIN facturas_ventas f ON f.factura_id = d.factura_id
			 LEFT JOIN domiciliarios dm ON dm.telefono = d.telefono_domiciliario_asignado
			 WHERE ${[...condicionesFactura(dto, periodo.actual, pD), sqlDomicilioCuenta('d')].join(' AND ')}
			 GROUP BY 1, 2 ORDER BY 1, domicilios DESC`,
			pD,
		);

		const total = num(totales?.total);
		const sinRepartidor = num(totales?.sin_repartidor);
		return {
			periodo: this.describirPeriodo(dto, periodo),
			filas: filas.map((f) => ({
				telefono: f.telefono,
				nombre: f.nombre ?? f.telefono,
				asignados: num(f.asignados),
				/** @deprecated igual a `asignados` (cuenta desde que se asigna); se conserva para los POS viejos. */
				entregas: num(f.asignados),
				ganancia: num(f.ganancia),
				ticketPromedio: Math.round(num(f.ticket_promedio)),
			})),
			/** Domicilios del período (sin los cancelados): todos, sin repartidor, asignados y su costo. */
			totales: {
				domicilios: total,
				sinRepartidor,
				asignados: total - sinRepartidor,
				/** @deprecated igual a `asignados`; se conserva para los POS viejos. */
				entregados: total - sinRepartidor,
				/** Costo de domicilio de todos (también los que aún no tienen repartidor). */
				costoDomicilios: num(totales?.costo),
				/** Costo de domicilio de los asignados: lo que se paga a los domiciliarios. */
				aPagar: num(totales?.a_pagar),
			},
			/** Una fila por día y repartidor (telefono null = sin repartidor), para el resumen diario/mensual. */
			porDia: porDia.map((d) => ({
				dia: d.dia,
				telefono: d.telefono,
				nombre: d.telefono == null ? 'Sin repartidor' : (d.nombre ?? d.telefono),
				domicilios: num(d.domicilios),
				/** @deprecated = `domicilios` de un repartidor (0 en «Sin repartidor»); se conserva para los POS viejos. */
				entregas: d.telefono == null ? 0 : num(d.domicilios),
				ganancia: num(d.ganancia),
			})),
		};
	}

	// ─── Catálogos para la UI de filtros ─────────────────────────────────────────

	async opciones() {
		const vacio = new ParametrosSql();
		const [productos, sabores, grupos, domiciliarios, usuarios, tamanos] = await Promise.all([
			this.consultar<{producto_id: number; nombre: string; categoria: string; activo: boolean}>(
				`SELECT producto_id, producto_nombre AS nombre, COALESCE(categoria, 'otro') AS categoria, activo
				 FROM productos ORDER BY producto_nombre`,
				vacio,
			),
			this.consultar<{sabor_id: number; nombre: string; grupo_id: number | null; activo: boolean}>(
				`SELECT sabor_id, nombre, grupo_id, activo FROM pizza_sabores
				 WHERE tipo IS DISTINCT FROM 'configuracion' ORDER BY nombre`,
				vacio,
			),
			this.consultar<{id: number; nombre: string}>('SELECT id, nombre FROM sabor_grupos ORDER BY orden, id', vacio),
			this.consultar<{telefono: string; nombre: string | null}>(
				`SELECT telefono, domiciliario_nombre AS nombre FROM domiciliarios ORDER BY domiciliario_nombre`,
				vacio,
			),
			this.consultar<{id: string; nombre: string}>(
				`SELECT id::text AS id, COALESCE(NULLIF(name, ''), username) AS nombre FROM users ORDER BY 2`,
				vacio,
			),
			this.consultar<{tamano: string}>(
				`SELECT DISTINCT tamano FROM ordenes_productos WHERE tamano IS NOT NULL`,
				vacio,
			),
		]);
		return {
			productos: productos.map((x) => ({
				productoId: num(x.producto_id),
				nombre: x.nombre,
				categoria: x.categoria,
				activo: x.activo,
			})),
			sabores: sabores.map((x) => ({
				saborId: num(x.sabor_id),
				nombre: x.nombre,
				grupoId: x.grupo_id != null ? num(x.grupo_id) : null,
				activo: x.activo,
			})),
			grupos: grupos.map((g) => ({id: num(g.id), nombre: g.nombre})),
			domiciliarios: domiciliarios.map((x) => ({telefono: x.telefono, nombre: x.nombre ?? x.telefono})),
			usuarios,
			tamanos: tamanos.map((x) => x.tamano).sort((a, b) => ORDEN_TAMANOS.indexOf(a) - ORDEN_TAMANOS.indexOf(b)),
		};
	}

	// ─── Resumen general de dinero (staff; pantallas de caja y cierre) ──────────

	/**
	 * Ventas, gastos y balance de un rango, con las definiciones únicas. Sin filtros de
	 * analítica: es la "foto" de dinero que deben mostrar igual todas las pantallas.
	 */
	async resumenGeneral(from: string, to: string) {
		const periodo = calcularPeriodo(from, to, false);
		const vacio = {from, to} as FiltrosAnaliticaDto;
		const [kpis, mix] = await Promise.all([this.kpis(vacio, periodo.actual), this.mix(vacio)]);

		const pD = new ParametrosSql();
		const pG = new ParametrosSql();
		const [[domicilios], [gastos], gastosPorMetodo, gastosPorClase, gastosQrPorCuenta, productos, productosPorPrecio] = await Promise.all([
			this.consultar<{costo: number}>(
				`SELECT COALESCE(SUM(d.costo_domicilio), 0)::float8 AS costo
				 FROM domicilios d JOIN facturas_ventas f ON f.factura_id = d.factura_id
				 WHERE ${[...condicionesFactura(vacio, periodo.actual, pD), sqlDomicilioCuenta('d')].join(' AND ')}`,
				pD,
			),
			// facturas_pagos.fecha_factura es DATE (sin hora): se compara contra las fechas tal cual.
			this.consultar<{total: number; pagados: number; pendientes: number; cantidad: number}>(
				`SELECT COALESCE(SUM(total), 0)::float8 AS total,
					COALESCE(SUM(total) FILTER (WHERE estado IN ('pagado', 'pagada')), 0)::float8 AS pagados,
					COALESCE(SUM(total) FILTER (WHERE estado IS NULL OR estado NOT IN ('pagado', 'pagada')), 0)::float8 AS pendientes,
					COUNT(*)::int AS cantidad
				 FROM facturas_pagos
				 WHERE fecha_factura BETWEEN ${pG.agregar(from)}::date AND ${pG.agregar(to)}::date`,
				pG,
			),
			(() => {
				const p = new ParametrosSql();
				return this.consultar<{metodo: string; total: number; pagados: number}>(
					`SELECT COALESCE(NULLIF(metodo, ''), 'sin_metodo') AS metodo, COALESCE(SUM(total), 0)::float8 AS total,
						COALESCE(SUM(total) FILTER (WHERE estado IN ('pagado', 'pagada')), 0)::float8 AS pagados
					 FROM facturas_pagos
					 WHERE fecha_factura BETWEEN ${p.agregar(from)}::date AND ${p.agregar(to)}::date
					 GROUP BY 1 ORDER BY total DESC`,
					p,
				);
			})(),
			// Egresos por tipo (costo | gasto | sin_clasificar) y categoría (nómina, servicios, insumos…).
			(() => {
				const p = new ParametrosSql();
				return this.consultar<{tipo: string; categoria: string; cantidad: number; total: number; pagados: number}>(
					`SELECT COALESCE(NULLIF(tipo_gasto, ''), 'sin_clasificar') AS tipo,
						COALESCE(NULLIF(categoria, ''), 'general') AS categoria,
						COUNT(*)::int AS cantidad, COALESCE(SUM(total), 0)::float8 AS total,
						COALESCE(SUM(total) FILTER (WHERE estado IN ('pagado', 'pagada')), 0)::float8 AS pagados
					 FROM facturas_pagos
					 WHERE fecha_factura BETWEEN ${p.agregar(from)}::date AND ${p.agregar(to)}::date
					 GROUP BY 1, 2 ORDER BY total DESC`,
					p,
				);
			})(),
			// Egresos pagados por QR, por la cuenta de la que salieron (NULL = sin asignar).
			(() => {
				const p = new ParametrosSql();
				return this.consultar<{cuenta_id: number | null; cuenta: string | null; cantidad: number; total: number; pagados: number}>(
					`SELECT g.cuenta_origen_id AS cuenta_id, MAX(ct.nombre) AS cuenta, COUNT(*)::int AS cantidad,
						COALESCE(SUM(g.total), 0)::float8 AS total,
						COALESCE(SUM(g.total) FILTER (WHERE g.estado IN ('pagado', 'pagada')), 0)::float8 AS pagados
					 FROM facturas_pagos g
					 LEFT JOIN cuentas_transferencia ct ON ct.id = g.cuenta_origen_id
					 WHERE g.metodo = 'qr' AND g.fecha_factura BETWEEN ${p.agregar(from)}::date AND ${p.agregar(to)}::date
					 GROUP BY g.cuenta_origen_id ORDER BY total DESC`,
					p,
				);
			})(),
			this.productosVendidos(vacio, periodo.actual),
			this.productosPorPrecio(vacio, periodo.actual),
		]);

		const porCuentaGastos = gastosQrPorCuenta.map((g) => ({
			cuentaId: g.cuenta_id != null ? num(g.cuenta_id) : null,
			cuenta: g.cuenta ?? 'Sin asignar',
			sinAsignar: g.cuenta_id == null,
			cantidad: num(g.cantidad),
			total: num(g.total),
			pagados: num(g.pagados),
		}));
		// Saldo por cuenta: lo cobrado por transferencia que entró a la cuenta − lo pagado por QR que salió de ella.
		const claveCuenta = (c: {cuentaId: number | null; cuenta: string | null}) =>
			c.cuentaId != null ? `id:${c.cuentaId}` : c.cuenta && c.cuenta !== 'Sin asignar' ? `n:${c.cuenta}` : 'sin';
		const cuentas = new Map<string, {cuentaId: number | null; cuenta: string; sinAsignar: boolean; entradas: number; salidas: number; saldo: number}>();
		const cuentaDe = (c: {cuentaId: number | null; cuenta: string | null; sinAsignar?: boolean}) => {
			const clave = claveCuenta(c);
			let fila = cuentas.get(clave);
			if (!fila) {
				fila = {cuentaId: c.cuentaId, cuenta: c.cuenta ?? 'Sin asignar', sinAsignar: clave === 'sin', entradas: 0, salidas: 0, saldo: 0};
				cuentas.set(clave, fila);
			}
			return fila;
		};
		for (const c of mix.porCuenta) cuentaDe(c).entradas += c.monto;
		for (const g of porCuentaGastos) cuentaDe(g).salidas += g.pagados;
		const saldosPorCuenta = [...cuentas.values()]
			.map((c) => ({...c, saldo: c.entradas - c.salidas}))
			.sort((a, b) => Number(a.sinAsignar) - Number(b.sinAsignar) || b.entradas - a.entradas);

		const porCategoria = gastosPorClase.map((g) => ({
			categoria: g.categoria,
			tipo: g.tipo,
			cantidad: num(g.cantidad),
			total: num(g.total),
			pagados: num(g.pagados),
		}));
		const porTipo = ['costo', 'gasto', 'sin_clasificar'].map((tipo) => {
			const filas = porCategoria.filter((g) => g.tipo === tipo);
			return {
				tipo,
				cantidad: filas.reduce((t, g) => t + g.cantidad, 0),
				total: filas.reduce((t, g) => t + g.total, 0),
				pagados: filas.reduce((t, g) => t + g.pagados, 0),
			};
		});
		const pagadosDe = (tipo: string) => porTipo.find((t) => t.tipo === tipo)?.pagados ?? 0;

		const totalGastos = num(gastos?.total);
		const gastosPagados = num(gastos?.pagados);
		return {
			periodo: {from, to},
			ventas: {
				facturado: kpis.facturado,
				cobrado: kpis.cobrado,
				porCobrar: kpis.porCobrar,
				facturas: kpis.facturas,
				ticket: kpis.ticket,
				ordenes: kpis.ordenes,
				canceladas: kpis.canceladas,
				costoDomicilios: num(domicilios?.costo),
				cobradoPorMetodo: mix.cobradoPorMetodo,
				porMetodo: mix.metodoPago,
				porCuenta: mix.porCuenta,
				/** Facturas por estado de pago (cobrada | parcial | pendiente). */
				porEstado: mix.estadoPago,
			},
			gastos: {
				total: totalGastos,
				pagados: gastosPagados,
				pendientes: num(gastos?.pendientes),
				cantidad: num(gastos?.cantidad),
				porMetodo: gastosPorMetodo.map((g) => ({metodo: g.metodo, total: num(g.total), pagados: num(g.pagados)})),
				/** Egresos por QR según la cuenta de la que salieron (incluye "Sin asignar"). */
				porCuenta: porCuentaGastos,
				/** costo | gasto | sin_clasificar (siempre las tres, aunque en 0). */
				porTipo,
				/** Una fila por (categoría, tipo): una categoría puede estar clasificada distinto en egresos distintos. */
				porCategoria,
			},
			/** Por cuenta de transferencia: entradas (cobrado QR) − salidas (egresos QR pagados) = saldo del rango. */
			cuentas: saldosPorCuenta,
			/** Todo lo vendido en el rango por producto + variante (completo, sin tope) con su ajuste manual de precio. */
			productos: productos.filas,
			/** Ajuste manual de precio del rango: aumentos, bajas (negativo) y líneas afectadas. */
			ajustesPrecio: productos.ajustes,
			/** Unidades por producto + variante y PRECIO (los manuales aparte): "Pizza - Grande · $48.000 × 50". */
			productosPorPrecio,
			/**
			 * Estado de resultados con lo realmente cobrado y pagado: ingresos − costos = utilidad
			 * bruta; − gastos operativos (y los sin clasificar) = utilidad operativa (= balance.cobrado).
			 */
			resultado: {
				ingresos: kpis.cobrado,
				costos: pagadosDe('costo'),
				utilidadBruta: kpis.cobrado - pagadosDe('costo'),
				gastosOperativos: pagadosDe('gasto'),
				sinClasificar: pagadosDe('sin_clasificar'),
				utilidadOperativa: kpis.cobrado - pagadosDe('costo') - pagadosDe('gasto') - pagadosDe('sin_clasificar'),
			},
			balance: {
				/** Facturado − todos los gastos (lo devengado del período). */
				devengado: kpis.facturado - totalGastos,
				/** Cobrado − gastos pagados (lo que realmente entró y salió). */
				cobrado: kpis.cobrado - gastosPagados,
			},
		};
	}

	/**
	 * Productos vendidos (producto + variante) con unidades, valor y ajuste manual de precio:
	 * ajuste = Σ (precio_unitario − precio_lista) × cantidad en líneas con precio_manual. Las manuales sin
	 * precio_lista (histórico) no tienen ajuste calculable: se cuentan aparte, sin inventar nada.
	 */
	async productosVendidos(filtros: FiltrosAnaliticaDto, rango: Rango) {
		const p = new ParametrosSql();
		const from = fromLineas(
			filtros,
			rango,
			p,
			`LEFT JOIN productos p ON p.producto_id = op."productoObjProductoId"
			LEFT JOIN producto_variantes pv ON pv.variante_id = op.variante_id`,
		);
		const nombreProducto = 'COALESCE(p.producto_nombre, op.producto_base)';
		const manual = 'op.precio_manual IS TRUE';
		const sql = `SELECT COALESCE(op.variante_id::text, 'n:' || lower(COALESCE(op.producto, ''))) AS clave,
				MAX(CASE WHEN ${nombreProducto} IS NOT NULL AND COALESCE(pv.nombre, op.variante_nombre) IS NOT NULL
					THEN ${nombreProducto} || ' - ' || COALESCE(pv.nombre, op.variante_nombre) ELSE op.producto END) AS nombre,
				-- Categoría (pizza, bebida…): para contar "cuántas pizzas salieron" en el libro diario y el cierre.
				MAX(COALESCE(p.categoria, op.categoria)) AS categoria,
				SUM(op.cantidad)::float8 AS unidades,
				COALESCE(SUM(op.cantidad * op.precio_unitario), 0)::float8 AS valor,
				COUNT(*) FILTER (WHERE ${manual})::int AS lineas_manuales,
				COUNT(*) FILTER (WHERE ${manual} AND op.precio_lista IS NULL)::int AS sin_precio_lista,
				COALESCE(SUM((op.precio_unitario - op.precio_lista) * op.cantidad)
					FILTER (WHERE ${manual} AND op.precio_lista IS NOT NULL AND op.precio_unitario > op.precio_lista), 0)::float8 AS aumentos,
				COALESCE(SUM((op.precio_unitario - op.precio_lista) * op.cantidad)
					FILTER (WHERE ${manual} AND op.precio_lista IS NOT NULL AND op.precio_unitario < op.precio_lista), 0)::float8 AS bajas
			${from}
			GROUP BY 1
			ORDER BY unidades DESC, nombre ASC`;
		const filas = (
			await this.consultar<{
				clave: string;
				nombre: string;
				categoria: string | null;
				unidades: number;
				valor: number;
				lineas_manuales: number;
				sin_precio_lista: number;
				aumentos: number;
				bajas: number;
			}>(sql, p)
		).map((f) => ({
			clave: f.clave,
			nombre: f.nombre,
			categoria: f.categoria ?? null,
			unidades: num(f.unidades),
			valor: num(f.valor),
			lineasManuales: num(f.lineas_manuales),
			sinPrecioLista: num(f.sin_precio_lista),
			aumentos: num(f.aumentos),
			bajas: num(f.bajas),
			ajuste: num(f.aumentos) + num(f.bajas),
		}));
		const suma = (k: 'aumentos' | 'bajas' | 'lineasManuales' | 'sinPrecioLista' | 'unidades' | 'valor') =>
			filas.reduce((t, f) => t + f[k], 0);
		return {
			filas,
			ajustes: {
				aumentos: suma('aumentos'),
				bajas: suma('bajas'),
				neto: suma('aumentos') + suma('bajas'),
				lineasManuales: suma('lineasManuales'),
				sinPrecioLista: suma('sinPrecioLista'),
			},
		};
	}

	/**
	 * Lo vendido por producto + variante y PRECIO unitario, con los precios cambiados a mano en filas aparte: cuántas
	 * salieron a cada precio ("Pizza - Grande · $48.000 × 50" y "Pizza - Grande · $57.000 (precio manual) × 1").
	 * Mismo universo que productosVendidos (ventas válidas del rango).
	 */
	async productosPorPrecio(filtros: FiltrosAnaliticaDto, rango: Rango) {
		const p = new ParametrosSql();
		const from = fromLineas(
			filtros,
			rango,
			p,
			`LEFT JOIN productos p ON p.producto_id = op."productoObjProductoId"
			LEFT JOIN producto_variantes pv ON pv.variante_id = op.variante_id`,
		);
		const nombreProducto = 'COALESCE(p.producto_nombre, op.producto_base)';
		const filas = await this.consultar<{
			clave: string;
			nombre: string;
			categoria: string | null;
			precio: number;
			manual: boolean;
			precio_lista: number | null;
			unidades: number;
			valor: number;
		}>(
			`SELECT COALESCE(op.variante_id::text, 'n:' || lower(COALESCE(op.producto, ''))) AS clave,
				MAX(CASE WHEN ${nombreProducto} IS NOT NULL AND COALESCE(pv.nombre, op.variante_nombre) IS NOT NULL
					THEN ${nombreProducto} || ' - ' || COALESCE(pv.nombre, op.variante_nombre) ELSE op.producto END) AS nombre,
				MAX(COALESCE(p.categoria, op.categoria)) AS categoria,
				COALESCE(op.precio_unitario, 0)::float8 AS precio,
				(op.precio_manual IS TRUE) AS manual,
				MAX(op.precio_lista)::float8 AS precio_lista,
				SUM(op.cantidad)::float8 AS unidades,
				COALESCE(SUM(op.cantidad * op.precio_unitario), 0)::float8 AS valor
			${from}
			GROUP BY 1, 4, 5
			ORDER BY nombre ASC, manual ASC, unidades DESC, precio DESC`,
			p,
		);
		return filas.map((f) => ({
			clave: f.clave,
			nombre: f.nombre,
			categoria: f.categoria ?? null,
			precio: num(f.precio),
			manual: f.manual === true,
			/** Precio del menú de las líneas manuales (null si no se guardó o si no es manual). */
			precioLista: f.manual === true && f.precio_lista != null ? num(f.precio_lista) : null,
			unidades: num(f.unidades),
			valor: num(f.valor),
		}));
	}

	/** Top de productos con la forma que guarda el cierre ({producto, totalVendido, ingresos}). */
	async topProductosCierre(fecha: string, limite = 5) {
		const periodo = calcularPeriodo(fecha, fecha, false);
		const {filas} = await this.agregadoProductos({from: fecha, to: fecha} as FiltrosAnaliticaDto, periodo.actual, {
			agrupar: 'variante',
			orden: 'unidades',
			limit: limite,
			offset: 0,
		});
		return filas.map((f) => ({producto: f.nombre, totalVendido: f.unidades, ingresos: f.ingresos}));
	}

	// ─── Calidad del dato (avance del backfill del histórico) ───────────────────

	async calidadDatos() {
		const vacio = new ParametrosSql();
		const [[lineas], [sabores], migracion] = await Promise.all([
			this.consultar<{total: number; v1: number; errores: number; pendientes: number}>(
				`SELECT COUNT(*)::int AS total,
					COUNT(*) FILTER (WHERE detalle_version = 'v1')::int AS v1,
					COUNT(*) FILTER (WHERE detalle_version = 'v1-error')::int AS errores,
					COUNT(*) FILTER (WHERE detalle_version IS NULL)::int AS pendientes
				 FROM ordenes_productos`,
				vacio,
			),
			this.consultar<{total: number; sin_clasificar: number}>(
				`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE sabor_id IS NULL)::int AS sin_clasificar
				 FROM ordenes_productos_sabores`,
				vacio,
			),
			this.consultar<{estado: string; resultado: Record<string, unknown> | null; actualizada_en: Date}>(
				`SELECT estado, resultado, actualizada_en FROM migraciones_datos WHERE id = 'ventas-detalle-v1'`,
				vacio,
			),
		]);
		const total = num(lineas?.total);
		const procesadas = num(lineas?.v1) + num(lineas?.errores);
		return {
			lineas: {
				total,
				procesadas,
				errores: num(lineas?.errores),
				pendientes: num(lineas?.pendientes),
				porcentajeProcesado: total > 0 ? redondear((procesadas / total) * 100) : 100,
			},
			sabores: {total: num(sabores?.total), sinClasificar: num(sabores?.sin_clasificar)},
			migracion: migracion[0]
				? {
						estado: migracion[0].estado,
						resultado: migracion[0].resultado,
						actualizadaEn: migracion[0].actualizada_en,
					}
				: null,
		};
	}
}
