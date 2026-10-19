import {sqlCobrado, sqlFacturaValida, sqlPorCobrar} from '../../common/domain/ventas';

/** Ejecuta SQL parametrizado (en producción, `DataSource.query`; en las pruebas, PGlite). */
export type Consultar = <T>(sql: string, params: unknown[]) => Promise<T[]>;

/** Últimos 10 dígitos de un teléfono (quita +57, espacios y guiones): así "+57 300 123 4567" y "3001234567" son el mismo. */
export function telefonoLocal(valor: string | null | undefined): string {
	return (valor ?? '').replace(/\D/g, '').slice(-10);
}

/** Expresión SQL con el teléfono de una columna en su forma local de 10 dígitos. */
const sqlTel = (columna: string) => `right(regexp_replace(COALESCE(${columna}, ''), '\\D', '', 'g'), 10)`;

const num = (v: unknown): number => {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
};
const iso = (v: unknown): string | null => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

/**
 * Facturas de UN cliente. Se enlazan SOLO por teléfono (el de la factura, el de su domicilio o el de quien creó la
 * orden desde la web): enlazar por nombre atribuía al cliente las facturas de cualquier otro "Juan". Los teléfonos se
 * comparan normalizados.
 */
const FACTURAS_DEL_CLIENTE = `
	SELECT f.* FROM facturas_ventas f
	WHERE ${sqlTel('f.telefono_cliente')} = $1
		OR EXISTS (SELECT 1 FROM domicilios d WHERE d.factura_id = f.factura_id AND ${sqlTel('d.telefono')} = $1)
		OR EXISTS (SELECT 1 FROM ordenes o WHERE o.factura_id = f.factura_id AND ${sqlTel('o.usuario_creacion_id')} = $1)`;

export interface PerfilCliente {
	/** Facturas del cliente (válidas + anuladas). */
	totalOrdenes: number;
	completadas: number;
	canceladas: number;
	/** Facturado en ventas válidas. Mismas reglas que la analítica (no cuenta facturas ni órdenes canceladas). */
	gastoTotal: number;
	cobrado: number;
	porCobrar: number;
	ticketPromedio: number;
	pedidoMaximo: number;
	primeraVisita: string | null;
	ultimaVisita: string | null;
	/** Cada cuántos días pide, en promedio (null con menos de 2 pedidos). */
	diasEntrePedidos: number | null;
	tipoPedidoFavorito: string | null;
	canalFavorito: string | null;
	tamanoHabitual: string | null;
	productosTop: {nombre: string; cantidad: number; gastoTotal: number}[];
	saboresTop: {nombre: string; pizzas: number}[];
	/** `true` si hay más órdenes de las que se listan en `ordenes` (las cifras de arriba SÍ las incluyen todas). */
	hayMasOrdenes: boolean;
	ordenes: {
		ordenId: number | null;
		fechaOrden: string;
		estadoOrden: string | null;
		tipoPedido: string | null;
		canal: string | null;
		total: number;
		cobrado: number;
		porCobrar: number;
		facturaId: number;
		metodo: string | null;
		estadoFactura: string | null;
		observaciones: string | null;
		productos: {
			id: number;
			nombre: string;
			cantidad: number;
			precioUnitario: number;
			subtotal: number;
			tamano: string | null;
			categoria: string | null;
		}[];
	}[];
}

/**
 * Perfil de un cliente con las definiciones de dinero compartidas (`common/domain/ventas.ts`): lo que dice aquí
 * es lo mismo que la lista de clientes y la analítica. Las cifras cubren TODO el historial; solo el listado de
 * órdenes se limita a las más recientes (`limiteOrdenes`).
 */
export async function perfilCliente(
	consultar: Consultar,
	telefono: string,
	limiteOrdenes = 100,
): Promise<PerfilCliente> {
	const tel = telefonoLocal(telefono);
	const valida = sqlFacturaValida('f');

	const [resumen] = await consultar<{
		facturas: number;
		validas: number;
		facturado: number;
		cobrado: number;
		por_cobrar: number;
		maximo: number;
		primera: Date | string | null;
		ultima: Date | string | null;
	}>(
		`WITH mias AS (${FACTURAS_DEL_CLIENTE})
		SELECT COUNT(*)::int AS facturas,
			COUNT(*) FILTER (WHERE ${valida})::int AS validas,
			COALESCE(SUM(f.total) FILTER (WHERE ${valida}), 0)::float8 AS facturado,
			COALESCE(SUM(${sqlCobrado('f')}) FILTER (WHERE ${valida}), 0)::float8 AS cobrado,
			COALESCE(SUM(${sqlPorCobrar('f')}) FILTER (WHERE ${valida}), 0)::float8 AS por_cobrar,
			COALESCE(MAX(f.total) FILTER (WHERE ${valida}), 0)::float8 AS maximo,
			MIN(f."fechaFactura") FILTER (WHERE ${valida}) AS primera,
			MAX(f."fechaFactura") FILTER (WHERE ${valida}) AS ultima
		FROM mias f`,
		[tel],
	);

	const facturas = num(resumen?.facturas);
	const validas = num(resumen?.validas);
	const gastoTotal = num(resumen?.facturado);
	const primera = iso(resumen?.primera);
	const ultima = iso(resumen?.ultima);
	const dias = primera && ultima ? (new Date(ultima).getTime() - new Date(primera).getTime()) / 86_400_000 : 0;

	// Hábitos: qué tipo de pedido y canal usa más, y su tamaño de pizza habitual.
	const [tipoRows, canalRows, tamanoRows] = await Promise.all([
		consultar<{clave: string; n: number}>(
			`WITH mias AS (${FACTURAS_DEL_CLIENTE})
			SELECT o.tipo_pedido AS clave, COUNT(DISTINCT f.factura_id)::int AS n
			FROM mias f JOIN ordenes o ON o.factura_id = f.factura_id
			WHERE ${valida} AND o.tipo_pedido IS NOT NULL
			GROUP BY 1 ORDER BY n DESC, clave LIMIT 1`,
			[tel],
		),
		consultar<{clave: string; n: number}>(
			`WITH mias AS (${FACTURAS_DEL_CLIENTE})
			SELECT o.canal AS clave, COUNT(DISTINCT f.factura_id)::int AS n
			FROM mias f JOIN ordenes o ON o.factura_id = f.factura_id
			WHERE ${valida} AND o.canal IS NOT NULL
			GROUP BY 1 ORDER BY n DESC, clave LIMIT 1`,
			[tel],
		),
		consultar<{clave: string; n: number}>(
			`WITH mias AS (${FACTURAS_DEL_CLIENTE})
			SELECT op.tamano AS clave, SUM(op.cantidad)::float8 AS n
			FROM mias f JOIN ordenes o ON o.factura_id = f.factura_id
			JOIN ordenes_productos op ON op.orden_id = o.orden_id
			WHERE ${valida} AND o.estado_orden IS DISTINCT FROM 'cancelado' AND op.tamano IS NOT NULL
			GROUP BY 1 ORDER BY n DESC, clave LIMIT 1`,
			[tel],
		),
	]);

	// Favoritos: el producto se agrupa por su nombre estructurado (producto + variante), no por el texto con
	// sabores, que fragmentaba una misma pizza en decenas de líneas.
	const productosTop = await consultar<{nombre: string; cantidad: number; gasto: number}>(
		`WITH mias AS (${FACTURAS_DEL_CLIENTE})
		SELECT COALESCE(NULLIF(op.producto_base, '') || COALESCE(' - ' || NULLIF(op.variante_nombre, ''), ''), op.producto, 'Producto') AS nombre,
			SUM(op.cantidad)::float8 AS cantidad,
			SUM(op.cantidad * op.precio_unitario)::float8 AS gasto
		FROM mias f JOIN ordenes o ON o.factura_id = f.factura_id
		JOIN ordenes_productos op ON op.orden_id = o.orden_id
		WHERE ${valida} AND o.estado_orden IS DISTINCT FROM 'cancelado'
		GROUP BY 1 ORDER BY cantidad DESC, gasto DESC LIMIT 15`,
		[tel],
	);
	const saboresTop = await consultar<{nombre: string; pizzas: number}>(
		`WITH mias AS (${FACTURAS_DEL_CLIENTE})
		SELECT s.sabor_nombre AS nombre, SUM(op.cantidad)::float8 AS pizzas
		FROM mias f JOIN ordenes o ON o.factura_id = f.factura_id
		JOIN ordenes_productos op ON op.orden_id = o.orden_id
		JOIN ordenes_productos_sabores s ON s.orden_producto_id = op.id
		WHERE ${valida} AND o.estado_orden IS DISTINCT FROM 'cancelado' AND s.sabor_nombre IS NOT NULL
		GROUP BY 1 ORDER BY pizzas DESC, nombre LIMIT 8`,
		[tel],
	);

	// Listado: una fila por factura (con su primera orden), las más recientes primero.
	const filas = await consultar<{
		factura_id: number;
		fecha: Date | string;
		total: number;
		cobrado: number;
		por_cobrar: number;
		metodo: string | null;
		estado_factura: string | null;
		orden_id: number | null;
		estado_orden: string | null;
		tipo_pedido: string | null;
		canal: string | null;
		observaciones: string | null;
	}>(
		`WITH mias AS (${FACTURAS_DEL_CLIENTE})
		SELECT f.factura_id, f."fechaFactura" AS fecha, COALESCE(f.total, 0)::float8 AS total,
			${sqlCobrado('f')}::float8 AS cobrado, ${sqlPorCobrar('f')}::float8 AS por_cobrar,
			f.metodo, f.estado AS estado_factura,
			o.orden_id, o.estado_orden, o.tipo_pedido, o.canal, o.observaciones
		FROM mias f
		LEFT JOIN LATERAL (SELECT * FROM ordenes o2 WHERE o2.factura_id = f.factura_id ORDER BY o2.orden_id LIMIT 1) o ON true
		ORDER BY f."fechaFactura" DESC, f.factura_id DESC
		LIMIT $2`,
		[tel, limiteOrdenes],
	);

	const idsOrden = filas.map((f) => f.orden_id).filter((id): id is number => id != null);
	const lineas = idsOrden.length
		? await consultar<{
				orden_id: number;
				id: string;
				nombre: string;
				cantidad: number;
				precio: number;
				tamano: string | null;
				categoria: string | null;
			}>(
				`SELECT op.orden_id, op.id::text AS id, COALESCE(op.producto, 'Producto') AS nombre, COALESCE(op.cantidad, 0)::float8 AS cantidad,
					COALESCE(op.precio_unitario, 0)::float8 AS precio, op.tamano, op.categoria
				FROM ordenes_productos op WHERE op.orden_id = ANY($1::int[]) ORDER BY op.id`,
				[idsOrden],
			)
		: [];
	const porOrden = new Map<number, typeof lineas>();
	for (const l of lineas) {
		const lista = porOrden.get(Number(l.orden_id)) ?? [];
		lista.push(l);
		porOrden.set(Number(l.orden_id), lista);
	}

	return {
		totalOrdenes: facturas,
		completadas: validas,
		canceladas: facturas - validas,
		gastoTotal,
		cobrado: num(resumen?.cobrado),
		porCobrar: num(resumen?.por_cobrar),
		ticketPromedio: validas > 0 ? Math.round(gastoTotal / validas) : 0,
		pedidoMaximo: num(resumen?.maximo),
		primeraVisita: primera,
		ultimaVisita: ultima,
		diasEntrePedidos: validas >= 2 ? Math.max(1, Math.round(dias / (validas - 1))) : null,
		tipoPedidoFavorito: tipoRows[0]?.clave ?? null,
		canalFavorito: canalRows[0]?.clave ?? null,
		tamanoHabitual: tamanoRows[0]?.clave ?? null,
		productosTop: productosTop.map((p) => ({nombre: p.nombre, cantidad: num(p.cantidad), gastoTotal: num(p.gasto)})),
		saboresTop: saboresTop.map((s) => ({nombre: s.nombre, pizzas: num(s.pizzas)})),
		hayMasOrdenes: facturas > filas.length,
		ordenes: filas.map((f) => ({
			ordenId: f.orden_id == null ? null : Number(f.orden_id),
			fechaOrden: iso(f.fecha) ?? '',
			// Sin orden (factura importada) se usa el estado de la factura.
			estadoOrden: f.estado_orden ?? f.estado_factura,
			tipoPedido: f.tipo_pedido,
			canal: f.canal,
			total: num(f.total),
			cobrado: num(f.cobrado),
			porCobrar: num(f.por_cobrar),
			facturaId: Number(f.factura_id),
			metodo: f.metodo,
			estadoFactura: f.estado_factura,
			observaciones: f.observaciones,
			productos: (porOrden.get(Number(f.orden_id)) ?? []).map((l) => ({
				id: Number(l.id) || 0,
				nombre: l.nombre,
				cantidad: num(l.cantidad),
				precioUnitario: num(l.precio),
				subtotal: num(l.cantidad) * num(l.precio),
				tamano: l.tamano,
				categoria: l.categoria,
			})),
		})),
	};
}
