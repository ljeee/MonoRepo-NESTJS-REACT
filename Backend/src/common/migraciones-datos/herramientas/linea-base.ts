import {sqlCobrado, sqlFacturaValida, sqlMontoEfectivo, sqlMontoTransferencia, sqlPorCobrar} from '../../domain/ventas';
import {type Ejecutar, SQL_MES_BOGOTA, fuenteFacturas, leerEsquema} from './esquema';

/**
 * "Línea base": una foto de todo lo que la migración NO debe cambiar (conteos, dinero por mes, huellas de las columnas
 * que no se tocan) y de lo que se va a transformar (inventario anterior, catálogo). Se toma ANTES de desplegar, con el
 * backend viejo detenido, y `verificarMigracion` la compara con la base ya migrada. SOLO LEE.
 *
 * El dinero se calcula con las definiciones de `common/domain/ventas.ts` (las mismas que usará la facturación nueva),
 * tanto antes como después: si la migración no toca montos, las dos fotos son idénticas. Que difiera de lo que mostraban
 * las pantallas viejas es un cambio de DEFINICIÓN (ver la auditoría), no un efecto de migrar.
 */

export interface FilaVentasMes {
	mes: string;
	facturas: number;
	validas: number;
	facturado: number;
	cobrado: number;
	porCobrar: number;
	efectivo: number;
	transferencia: number;
}

export interface FilaGastosMes {
	mes: string;
	egresos: number;
	total: number;
	pagados: number;
}

export interface FilaLineasMes {
	mes: string;
	lineas: number;
	unidades: number;
	valor: number;
}

export interface LineaBase {
	version: 1;
	capturadaEn: string;
	/** Filas por tabla (solo las que existen). */
	tablas: Record<string, number>;
	ventasPorMes: FilaVentasMes[];
	gastosPorMes: FilaGastosMes[];
	lineasPorMes: FilaLineasMes[];
	cajaPorTipo: {tipo: string; movimientos: number; total: number}[];
	/** md5 de las columnas que la migración NO modifica: cualquier cambio es un error. */
	huellas: Record<string, string>;
	/** Inventario del sistema anterior (lo que `inventario-unificado-v1` debe dejar igual en los ítems nuevos). */
	inventario: {
		cajas: {id: number; nombre: string; cantidad: number}[];
		stockBebidas: {varianteId: number; stock: number}[];
	};
	catalogo: {
		variantes: {id: number; precio: number}[];
		sabores: {id: number; nombre: string; tipo: string; activo: boolean; recargos: [number, number, number]}[];
	};
}

/** Tablas de las que se anota el número de filas. */
export const TABLAS_CONTADAS = [
	'facturas_ventas',
	'ordenes',
	'ordenes_productos',
	'facturas_pagos',
	'clientes',
	'cliente_direcciones',
	'domicilios',
	'domiciliarios',
	'caja_movimientos',
	'cierres_caja',
	'users',
	'productos',
	'producto_variantes',
	'pizza_sabores',
	'empresa_config',
];

/**
 * Tablas cuyo número de filas NO debe cambiar al migrar. `pizza_sabores` queda fuera a propósito: la migración le AGREGA
 * los sabores del Calzone (antes eran los nombres de sus variantes).
 */
export const TABLAS_SIN_CAMBIOS = TABLAS_CONTADAS.filter((t) => t !== 'pizza_sabores');

const redondear = (n: unknown) => Math.round(Number(n) || 0);

export async function capturarLineaBase(q: Ejecutar): Promise<LineaBase> {
	const esq = await leerEsquema(q);
	const valida = sqlFacturaValida('f');

	const tablas: Record<string, number> = {};
	for (const t of TABLAS_CONTADAS) {
		if (esq.tiene(t)) tablas[t] = Number((await q(`SELECT COUNT(*)::int AS n FROM ${t}`))[0]?.n) || 0;
	}

	const ventasPorMes: FilaVentasMes[] = esq.tiene('facturas_ventas')
		? (
				await q(
					`SELECT ${SQL_MES_BOGOTA('f."fechaFactura"')} AS mes,
						COUNT(*)::int AS facturas,
						COUNT(*) FILTER (WHERE ${valida})::int AS validas,
						COALESCE(SUM(f.total) FILTER (WHERE ${valida}), 0) AS facturado,
						COALESCE(SUM(${sqlCobrado('f')}) FILTER (WHERE ${valida}), 0) AS cobrado,
						COALESCE(SUM(${sqlPorCobrar('f')}) FILTER (WHERE ${valida}), 0) AS por_cobrar,
						COALESCE(SUM(${sqlMontoEfectivo('f')}) FILTER (WHERE ${valida}), 0) AS efectivo,
						COALESCE(SUM(${sqlMontoTransferencia('f')}) FILTER (WHERE ${valida}), 0) AS transferencia
					 FROM ${fuenteFacturas(esq)} GROUP BY 1 ORDER BY 1`,
				)
			).map((r) => ({
				mes: r.mes,
				facturas: Number(r.facturas),
				validas: Number(r.validas),
				facturado: redondear(r.facturado),
				cobrado: redondear(r.cobrado),
				porCobrar: redondear(r.por_cobrar),
				efectivo: redondear(r.efectivo),
				transferencia: redondear(r.transferencia),
			}))
		: [];

	const gastosPorMes: FilaGastosMes[] = esq.tiene('facturas_pagos')
		? (
				await q(
					`SELECT to_char(fecha_factura, 'YYYY-MM') AS mes, COUNT(*)::int AS egresos, COALESCE(SUM(total), 0) AS total,
						COALESCE(SUM(total) FILTER (WHERE estado IN ('pagado', 'pagada')), 0) AS pagados
					 FROM facturas_pagos WHERE fecha_factura IS NOT NULL GROUP BY 1 ORDER BY 1`,
				)
			).map((r) => ({
				mes: r.mes,
				egresos: Number(r.egresos),
				total: redondear(r.total),
				pagados: redondear(r.pagados),
			}))
		: [];

	const lineasPorMes: FilaLineasMes[] =
		esq.tiene('ordenes_productos') && esq.tiene('ordenes')
			? (
					await q(
						`SELECT ${SQL_MES_BOGOTA('o.fecha_orden')} AS mes, COUNT(*)::int AS lineas, COALESCE(SUM(op.cantidad), 0) AS unidades,
							COALESCE(SUM(op.cantidad * op.precio_unitario), 0) AS valor
						 FROM ordenes_productos op JOIN ordenes o ON o.orden_id = op.orden_id GROUP BY 1 ORDER BY 1`,
					)
				).map((r) => ({
					mes: r.mes,
					lineas: Number(r.lineas),
					unidades: redondear(r.unidades),
					valor: redondear(r.valor),
				}))
			: [];

	const cajaPorTipo = esq.tiene('caja_movimientos')
		? (
				await q(
					`SELECT tipo, COUNT(*)::int AS movimientos, COALESCE(SUM(total), 0) AS total FROM caja_movimientos GROUP BY 1 ORDER BY 1`,
				)
			).map((r) => ({tipo: r.tipo, movimientos: Number(r.movimientos), total: redondear(r.total)}))
		: [];

	const huella = async (tabla: string, sql: string) => {
		if (!esq.tiene(tabla)) return;
		const [r] = await q(`SELECT md5(COALESCE(string_agg(fila, ',' ORDER BY orden), '')) AS h FROM (${sql}) x`);
		huellas[tabla] = String(r?.h ?? '');
	};
	const huellas: Record<string, string> = {};
	await huella(
		'facturas_ventas',
		`SELECT factura_id AS orden, concat_ws('|', factura_id, total, extract(epoch FROM "fechaFactura"), estado, metodo, COALESCE(cliente_nombre, '')) AS fila FROM facturas_ventas`,
	);
	await huella(
		'ordenes',
		`SELECT orden_id AS orden, concat_ws('|', orden_id, factura_id, tipo_pedido, estado_orden, extract(epoch FROM fecha_orden)) AS fila FROM ordenes`,
	);
	await huella(
		'ordenes_productos',
		`SELECT id AS orden, concat_ws('|', id, orden_id, producto, cantidad, precio_unitario, variante_id) AS fila FROM ordenes_productos`,
	);
	await huella(
		'facturas_pagos',
		`SELECT pagos_id AS orden, concat_ws('|', pagos_id, total, nombre_gasto, estado, fecha_factura, metodo) AS fila FROM facturas_pagos`,
	);
	await huella(
		'caja_movimientos',
		`SELECT row_number() OVER (ORDER BY created_at, id::text) AS orden, concat_ws('|', id, tipo, total, fecha, factura_venta_id) AS fila FROM caja_movimientos`,
	);
	await huella(
		'clientes',
		`SELECT row_number() OVER (ORDER BY telefono) AS orden, concat_ws('|', telefono, cliente_nombre) AS fila FROM clientes`,
	);

	const inventario: LineaBase['inventario'] = {cajas: [], stockBebidas: []};
	if (esq.tiene('inventario_cajas')) {
		inventario.cajas = (await q(`SELECT id, nombre, cantidad FROM inventario_cajas ORDER BY id`)).map((r) => ({
			id: Number(r.id),
			nombre: String(r.nombre),
			cantidad: Number(r.cantidad) || 0,
		}));
	}
	if (esq.tiene('producto_variantes', 'stock_bebida')) {
		inventario.stockBebidas = (
			await q(
				`SELECT variante_id, stock_bebida FROM producto_variantes WHERE COALESCE(stock_bebida, 0) <> 0 ORDER BY variante_id`,
			)
		).map((r) => ({varianteId: Number(r.variante_id), stock: Number(r.stock_bebida) || 0}));
	}

	const catalogo: LineaBase['catalogo'] = {variantes: [], sabores: []};
	if (esq.tiene('producto_variantes')) {
		catalogo.variantes = (
			await q(`SELECT variante_id AS id, precio FROM producto_variantes ORDER BY variante_id`)
		).map((r) => ({
			id: Number(r.id),
			precio: Number(r.precio),
		}));
	}
	if (esq.tiene('pizza_sabores')) {
		catalogo.sabores = (
			await q(
				`SELECT sabor_id AS id, nombre, tipo, activo, recargo_pequena AS rp, recargo_mediana AS rm, recargo_grande AS rg FROM pizza_sabores ORDER BY sabor_id`,
			)
		).map((r) => ({
			id: Number(r.id),
			nombre: String(r.nombre),
			tipo: String(r.tipo),
			activo: Boolean(r.activo),
			recargos: [Number(r.rp) || 0, Number(r.rm) || 0, Number(r.rg) || 0] as [number, number, number],
		}));
	}

	return {
		version: 1,
		capturadaEn: new Date().toISOString(),
		tablas,
		ventasPorMes,
		gastosPorMes,
		lineasPorMes,
		cajaPorTipo,
		huellas,
		inventario,
		catalogo,
	};
}
