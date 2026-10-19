import {Role} from '../../../auth/roles.enum';
import {IDS_CATEGORIA_GASTO} from '../../utils/gastos.util';
import {normalizarTamano} from '../../utils/catalogo.util';
import {resolverPersonalizacion} from '../../utils/personalizacion.util';
import {sqlMontoTransferencia} from '../../domain/ventas';
import {type Ejecutar, type Esquema, SQL_MES_BOGOTA, fuenteFacturas, leerEsquema, numero} from './esquema';

/**
 * Auditoría PREVIA a la migración. SOLO LEE. Se corre contra una copia restaurada de producción (o contra producción
 * misma: son consultas de lectura) y dice, antes de desplegar:
 *  - qué haría `synchronize` y qué datos suyos podrían romper el arranque o perderse (BLOQUEANTE);
 *  - qué datos antiguos se verán distinto con la facturación nueva y quién los debe revisar (ATENCIÓN);
 *  - el tamaño de lo que se migra (INFO).
 * Cada hallazgo trae el SQL o el paso concreto para resolverlo. Se adapta a cualquier versión del esquema anterior.
 */

export type Severidad = 'bloqueante' | 'atencion' | 'info';

export interface Hallazgo {
	id: string;
	titulo: string;
	severidad: Severidad;
	/** Registros afectados (0 = sin problema). */
	cantidad: number;
	/** Texto breve con el contexto (montos, rangos…). */
	detalle?: string;
	/** Hasta 10 filas de ejemplo. */
	muestra?: Record<string, unknown>[];
	/** Qué hacer. */
	accion?: string;
}

export interface ResultadoAuditoria {
	generadaEn: string;
	hallazgos: Hallazgo[];
	bloqueantes: number;
	atenciones: number;
}

type Verificacion = (ctx: Contexto) => Promise<Hallazgo | null>;

interface Contexto {
	q: Ejecutar;
	esq: Esquema;
	facturas: string;
}

const ESTADOS_FACTURA = ['pendiente', 'pagado', 'pagada', 'parcial', 'cancelado'];
const METODOS_FACTURA = ['efectivo', 'transferencia', 'qr', 'efectivo_transferencia'];
const METODOS_EGRESO = ['efectivo', 'qr', 'efectivo_no_caja'];
const PAGADA = `f.estado IN ('pagado', 'pagada')`;
const TELEFONO_CANONICO = '^[0-9]{10}$';

/** Teléfonos y nombres que sembraba el seeder de pruebas anterior (`seed-orders`): si están en producción, son basura. */
const TELEFONOS_SEMILLA = [
	'3100001111',
	'3100002222',
	'3100003333',
	'3100004444',
	'3100005555',
	'3100006666',
	'3100007777',
	'3100008888',
	'3100009999',
	'3101001010',
];

const hallazgo = (h: Omit<Hallazgo, 'severidad'> & {severidad?: Severidad}): Hallazgo => ({severidad: 'info', ...h});

const SQL_VENTA_CON_ORDEN_CANCELADA = `EXISTS (SELECT 1 FROM ordenes o WHERE o.factura_id = f.factura_id)
	AND NOT EXISTS (SELECT 1 FROM ordenes o WHERE o.factura_id = f.factura_id AND o.estado_orden IS DISTINCT FROM 'cancelado')`;

// ── Esquema y volumen ───────────────────────────────────────────────────────

const volumen: Verificacion = async ({q, esq}) => {
	const tablas = [
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
	].filter((t) => esq.tiene(t));
	const conteos: Record<string, unknown>[] = [];
	for (const t of tablas) conteos.push({tabla: t, filas: await numero(q, `SELECT COUNT(*)::int FROM ${t}`)});
	let detalle = '';
	if (esq.tiene('facturas_ventas')) {
		const [r] = await q(`SELECT MIN("fechaFactura") AS desde, MAX("fechaFactura") AS hasta FROM facturas_ventas`);
		const dia = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);
		if (r?.desde) detalle = `Ventas desde ${dia(r.desde)} hasta ${dia(r.hasta)}.`;
	}
	try {
		const bytes = await numero(q, 'SELECT pg_database_size(current_database())');
		if (bytes) detalle += ` Tamaño de la base: ${(bytes / 1024 / 1024).toFixed(1)} MB.`;
	} catch {
		/* PGlite u otro motor sin la función */
	}
	return hallazgo({
		id: 'volumen',
		titulo: 'Volumen de datos a migrar',
		cantidad: 0,
		detalle: detalle.trim(),
		muestra: conteos,
	});
};

/** Lo que `synchronize` CREARÁ (si falta, la base es más antigua que el código). */
export const ESQUEMA_NUEVO: {tabla: string; columna?: string}[] = [
	{tabla: 'cuentas_transferencia'},
	{tabla: 'sabor_grupos'},
	{tabla: 'ordenes_productos_sabores'},
	{tabla: 'inventario_items'},
	{tabla: 'inventario_consumos'},
	{tabla: 'inventario_movimientos'},
	{tabla: 'migraciones_datos'},
	{tabla: 'facturas_ventas', columna: 'monto_pagado'},
	{tabla: 'facturas_ventas', columna: 'cuenta_transferencia_id'},
	{tabla: 'facturas_ventas', columna: 'cuenta_transferencia_nombre'},
	{tabla: 'facturas_ventas', columna: 'desglose_transferencia'},
	{tabla: 'ordenes', columna: 'canal'},
	{tabla: 'ordenes', columna: 'usuario_creacion_id'},
	{tabla: 'ordenes_productos', columna: 'producto_base'},
	{tabla: 'ordenes_productos', columna: 'detalle_version'},
	{tabla: 'productos', columna: 'categoria'},
	{tabla: 'productos', columna: 'sabor_grupo_id'},
	{tabla: 'producto_variantes', columna: 'tamano'},
	{tabla: 'pizza_sabores', columna: 'grupo_id'},
	{tabla: 'facturas_pagos', columna: 'tipo_gasto'},
	{tabla: 'facturas_pagos', columna: 'cuenta_origen_id'},
	{tabla: 'empresa_config', columna: 'arqueo_caja'},
	{tabla: 'cierres_caja', columna: 'resumen'},
];

const esquemaPorActualizar: Verificacion = async ({esq}) => {
	const faltan = ESQUEMA_NUEVO.filter((e) => !esq.tiene(e.tabla, e.columna)).map((e) => ({
		falta: e.columna ? `${e.tabla}.${e.columna}` : `tabla ${e.tabla}`,
	}));
	return hallazgo({
		id: 'esquema-por-actualizar',
		titulo: 'Tablas y columnas que creará synchronize',
		cantidad: faltan.length,
		detalle: faltan.length
			? 'Todo es aditivo (columnas nuevas nulas o con DEFAULT, tablas nuevas). Confírmalo con `npm run schema:preview`.'
			: 'El esquema ya tiene todo lo nuevo (la base es reciente).',
		muestra: faltan.slice(0, 10),
	});
};

const columnasQueSeBorran: Verificacion = async ({q, esq}) => {
	if (!esq.tiene('domicilios', 'domiciliarioTelefono')) return null;
	const conDatos = await numero(q, `SELECT COUNT(*)::int FROM domicilios WHERE "domiciliarioTelefono" IS NOT NULL`);
	return hallazgo({
		id: 'columna-domiciliarioTelefono',
		titulo: 'Columna heredada domicilios."domiciliarioTelefono" (synchronize la BORRA)',
		severidad: 'info',
		cantidad: conDatos,
		detalle:
			'La entidad ya no la mapea (usa telefono_domiciliario_asignado). Se revisa abajo que no tenga datos únicos.',
	});
};

// ── Bloqueantes ─────────────────────────────────────────────────────────────

const domiciliarioHuerfano: Verificacion = async ({q, esq}) => {
	if (!esq.tiene('domicilios', 'telefono_domiciliario_asignado') || !esq.tiene('domiciliarios')) return null;
	const donde = `d.telefono_domiciliario_asignado IS NOT NULL
		AND NOT EXISTS (SELECT 1 FROM domiciliarios m WHERE m.telefono = d.telefono_domiciliario_asignado)`;
	const cantidad = await numero(q, `SELECT COUNT(*)::int FROM domicilios d WHERE ${donde}`);
	const muestra = cantidad
		? await q(
				`SELECT d.telefono_domiciliario_asignado AS telefono, COUNT(*)::int AS domicilios
				 FROM domicilios d WHERE ${donde} GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
			)
		: undefined;
	return hallazgo({
		id: 'domiciliario-huerfano',
		titulo: 'Domicilios asignados a un teléfono que no es un domiciliario registrado',
		severidad: cantidad ? 'bloqueante' : 'info',
		cantidad,
		detalle: cantidad
			? 'synchronize agrega una llave foránea domicilios → domiciliarios: con estos datos FALLA y el backend queda reiniciándose.'
			: undefined,
		muestra,
		accion: cantidad
			? `Antes de desplegar: UPDATE domicilios SET telefono_domiciliario_asignado = NULL WHERE telefono_domiciliario_asignado = ''; ` +
				`y para cada teléfono de la muestra, o se crea el domiciliario (INSERT INTO domiciliarios (telefono, domiciliario_nombre) VALUES (...)) ` +
				`o se corrige el teléfono del domicilio (si solo difiere en +57/espacios, normalizarlo).`
			: undefined,
	});
};

const domiciliarioTelefonoConDatos: Verificacion = async ({q, esq}) => {
	if (!esq.tiene('domicilios', 'domiciliarioTelefono') || !esq.tiene('domicilios', 'telefono_domiciliario_asignado'))
		return null;
	const cantidad = await numero(
		q,
		`SELECT COUNT(*)::int FROM domicilios
		 WHERE "domiciliarioTelefono" IS NOT NULL AND telefono_domiciliario_asignado IS DISTINCT FROM "domiciliarioTelefono"`,
	);
	if (!cantidad) return null;
	return hallazgo({
		id: 'domiciliarioTelefono-con-datos',
		titulo: 'Domicilios cuyo repartidor solo consta en la columna heredada "domiciliarioTelefono"',
		severidad: 'bloqueante',
		cantidad,
		detalle: 'synchronize borra esa columna: se perdería quién hizo esas entregas.',
		muestra: await q(
			`SELECT domicilio_id, "domiciliarioTelefono" AS heredado, telefono_domiciliario_asignado AS actual
			 FROM domicilios
			 WHERE "domiciliarioTelefono" IS NOT NULL AND telefono_domiciliario_asignado IS DISTINCT FROM "domiciliarioTelefono" LIMIT 10`,
		),
		accion:
			`Antes de desplegar: UPDATE domicilios SET telefono_domiciliario_asignado = "domiciliarioTelefono" ` +
			`WHERE telefono_domiciliario_asignado IS NULL AND "domiciliarioTelefono" IS NOT NULL; y revisar a mano los que difieren.`,
	});
};

// ── Facturación: datos que se verán distinto o necesitan arreglo ─────────────

const distribucion = async (q: Ejecutar, columna: string, conocidos: string[], fuente: string): Promise<Hallazgo> => {
	const filas = await q(
		`SELECT COALESCE(NULLIF(btrim(f.${columna}), ''), '(vacío)') AS valor, COUNT(*)::int AS filas
		 FROM ${fuente} GROUP BY 1 ORDER BY 2 DESC`,
	);
	const raros = filas.filter((f) => f.valor !== '(vacío)' && !conocidos.includes(String(f.valor)));
	return hallazgo({
		id: columna === 'estado' ? 'estados-factura' : 'metodos-factura',
		titulo: columna === 'estado' ? 'Estados de las facturas' : 'Métodos de pago de las facturas',
		severidad: raros.length ? 'atencion' : 'info',
		cantidad: raros.reduce((s, r) => s + Number(r.filas), 0),
		detalle: raros.length
			? `Valores que el sistema nuevo no reconoce: ${raros.map((r) => r.valor).join(', ')}. Se reportan como "otro".`
			: 'Todos los valores son conocidos.',
		muestra: filas.slice(0, 10),
		accion: raros.length
			? 'Corregirlos a un valor válido (p. ej. UPDATE facturas_ventas SET metodo = ... WHERE metodo = ...) o aceptar que cuenten como "otro".'
			: undefined,
	});
};

const estadosFactura: Verificacion = async ({q, facturas}) => distribucion(q, 'estado', ESTADOS_FACTURA, facturas);
const metodosFactura: Verificacion = async ({q, facturas}) => distribucion(q, 'metodo', METODOS_FACTURA, facturas);

const pagadasSinMetodo: Verificacion = async ({q, facturas}) => {
	const donde = `${PAGADA} AND NULLIF(btrim(f.metodo), '') IS NULL`;
	const [r] = await q(
		`SELECT COUNT(*)::int AS n, COALESCE(SUM(f.total), 0)::float8 AS total FROM ${facturas} WHERE ${donde}`,
	);
	if (!Number(r?.n)) return null;
	return hallazgo({
		id: 'pagadas-sin-metodo',
		titulo: 'Facturas pagadas sin método de pago',
		severidad: 'atencion',
		cantidad: Number(r.n),
		detalle: `Suman $${Math.round(r.total).toLocaleString('es-CO')}. En los reportes por método quedan como "sin método".`,
		accion: 'Asignarles el método real (UPDATE facturas_ventas SET metodo = ... WHERE factura_id IN (...)) si se conoce.',
	});
};

const mixtasSinDesglose: Verificacion = async ({q, facturas}) => {
	const donde = `${PAGADA} AND f.metodo = 'efectivo_transferencia'
		AND (f.pago_efectivo IS NULL OR f.pago_transferencia IS NULL OR ABS(f.pago_efectivo + f.pago_transferencia - f.total) > 1)`;
	const [r] = await q(
		`SELECT COUNT(*)::int AS n, COALESCE(SUM(f.total), 0)::float8 AS total FROM ${facturas} WHERE ${donde}`,
	);
	if (!Number(r?.n)) return null;
	return hallazgo({
		id: 'mixtas-sin-desglose',
		titulo: 'Pagos mixtos cuyo desglose efectivo/QR no cuadra con el total',
		severidad: 'atencion',
		cantidad: Number(r.n),
		detalle:
			`Suman $${Math.round(r.total).toLocaleString('es-CO')}. En los reportes por método esa plata desaparece de "efectivo" y de ` +
			`"transferencia" (solo aparece en el total cobrado). La migración completa las que tienen UNA parte conocida.`,
		muestra: await q(
			`SELECT f.factura_id, f.total, f.pago_efectivo, f.pago_transferencia FROM ${facturas} WHERE ${donde} ORDER BY f.factura_id DESC LIMIT 10`,
		),
		accion: 'Corregir pago_efectivo y pago_transferencia de las que sigan sin cuadrar (deben sumar el total).',
	});
};

const montosPorCompletar: Verificacion = async ({q, facturas}) => {
	const cantidad = await numero(
		q,
		`SELECT COUNT(*)::int FROM ${facturas}
		 WHERE ${PAGADA} AND f.total IS NOT NULL AND (f.monto_pagado IS NULL OR f.pago_efectivo IS NULL OR f.pago_transferencia IS NULL)`,
	);
	return hallazgo({
		id: 'pagadas-montos-nulos',
		titulo: 'Facturas pagadas con montos sin registrar (monto_pagado o desglose en NULL)',
		cantidad,
		detalle:
			'El paso facturas-montos-v1 las completa solo: facturado, cobrado y por cobrar no cambian (solo se reparte mejor entre efectivo y QR en las mixtas con una parte conocida).',
	});
};

const transferenciasSinCuenta: Verificacion = async ({q, esq, facturas}) => {
	const sinCuentaCol = !esq.tiene('facturas_ventas', 'cuenta_transferencia_id');
	const donde = `(${PAGADA} OR f.estado = 'parcial') AND ${sqlMontoTransferencia('f')} > 0
		AND f.cuenta_transferencia_id IS NULL AND NULLIF(btrim(f.cuenta_transferencia_nombre), '') IS NULL AND f.desglose_transferencia IS NULL`;
	const [r] = await q(
		`SELECT COUNT(*)::int AS n, COALESCE(SUM(${sqlMontoTransferencia('f')}), 0)::float8 AS monto FROM ${facturas} WHERE ${donde}`,
	);
	const cantidad = Number(r?.n) || 0;
	if (!cantidad) return null;
	return hallazgo({
		id: 'transferencias-sin-cuenta',
		titulo: 'Cobros por QR / transferencia sin cuenta asignada',
		severidad: 'atencion',
		cantidad,
		detalle:
			`$${Math.round(r.monto).toLocaleString('es-CO')} cobrados por QR no dicen a qué cuenta entraron: aparecen como "Sin asignar" en ` +
			`QR / Transferencias y en el saldo por cuenta.${sinCuentaCol ? ' (La base aún no tiene el concepto de cuenta: es todo el histórico QR.)' : ''}`,
		muestra: await q(
			`SELECT ${SQL_MES_BOGOTA('f."fechaFactura"')} AS mes, COUNT(*)::int AS facturas, ROUND(SUM(${sqlMontoTransferencia('f')}))::float8 AS monto
			 FROM ${facturas} WHERE ${donde} GROUP BY 1 ORDER BY 1 DESC LIMIT 12`,
		),
		accion:
			'Asignarlas desde la pantalla QR / Transferencias (una a una) o, si hasta cierta fecha todo entraba a una misma cuenta, en bloque: ' +
			"UPDATE facturas_ventas SET cuenta_transferencia_id = <id>, cuenta_transferencia_nombre = '<nombre>' WHERE <mismo filtro> AND \"fechaFactura\" < '<fecha>' (primero como SELECT).",
	});
};

const cuentasSoloNombre: Verificacion = async ({q, esq}) => {
	if (!esq.tiene('facturas_ventas', 'cuenta_transferencia_nombre')) return null;
	const hayTabla = esq.tiene('cuentas_transferencia');
	const filas = await q(
		`SELECT btrim(f.cuenta_transferencia_nombre) AS nombre, COUNT(*)::int AS facturas,
			${
				hayTabla
					? `(SELECT COUNT(*)::int FROM cuentas_transferencia c WHERE lower(btrim(c.nombre)) = lower(btrim(f.cuenta_transferencia_nombre)))`
					: '0'
			} AS coincidencias
		 FROM facturas_ventas f
		 WHERE ${esq.tiene('facturas_ventas', 'cuenta_transferencia_id') ? 'f.cuenta_transferencia_id IS NULL AND' : ''}
			NULLIF(btrim(f.cuenta_transferencia_nombre), '') IS NOT NULL
		 GROUP BY 1, 3 ORDER BY 2 DESC`,
	);
	if (!filas.length) return null;
	const sinCoincidencia = filas.filter((f) => Number(f.coincidencias) !== 1);
	return hallazgo({
		id: 'cuentas-solo-nombre',
		titulo: 'Facturas que guardaron el NOMBRE de la cuenta pero no su id',
		severidad: sinCoincidencia.length ? 'atencion' : 'info',
		cantidad: filas.reduce((s, f) => s + Number(f.facturas), 0),
		detalle: sinCoincidencia.length
			? `${sinCoincidencia.length} nombre(s) no coinciden con una sola cuenta de la tabla: quedarán como están (se unen por nombre exacto).`
			: 'Todos coinciden con una cuenta: el paso cuentas-factura-id-v1 les pone el id.',
		muestra: filas.slice(0, 10),
		accion: sinCoincidencia.length
			? 'Crear la cuenta que falta en Ajustes del negocio, o corregir el nombre de esas facturas, y volver a correr el paso (borrar su fila de migraciones_datos).'
			: undefined,
	});
};

const cuentasDuplicadas: Verificacion = async ({q, esq}) => {
	if (!esq.tiene('cuentas_transferencia')) return null;
	const filas = await q(
		`SELECT lower(btrim(nombre)) AS nombre, COUNT(*)::int AS cuentas FROM cuentas_transferencia GROUP BY 1 HAVING COUNT(*) > 1`,
	);
	if (!filas.length) return null;
	return hallazgo({
		id: 'cuentas-duplicadas',
		titulo: 'Cuentas de transferencia con el mismo nombre',
		severidad: 'atencion',
		cantidad: filas.length,
		muestra: filas,
		accion: 'Desactivar o renombrar las repetidas: los reportes unen por nombre y elegirían siempre la de menor id.',
	});
};

const ventasConOrdenCancelada: Verificacion = async ({q, facturas}) => {
	const donde = `f.estado IS DISTINCT FROM 'cancelado' AND ${SQL_VENTA_CON_ORDEN_CANCELADA}`;
	const [r] = await q(
		`SELECT COUNT(*)::int AS n, COALESCE(SUM(f.total), 0)::float8 AS total FROM ${facturas} WHERE ${donde}`,
	);
	if (!Number(r?.n)) return null;
	return hallazgo({
		id: 'ventas-orden-cancelada',
		titulo: 'Facturas NO canceladas cuya orden SÍ está cancelada',
		severidad: 'atencion',
		cantidad: Number(r.n),
		detalle:
			`$${Math.round(r.total).toLocaleString('es-CO')}. La facturación nueva NO las cuenta como venta (venta válida = factura no cancelada ` +
			`con alguna orden viva); las pantallas antiguas sí las sumaban. Es la causa principal de que los totales históricos bajen un poco.`,
		muestra: await q(
			`SELECT ${SQL_MES_BOGOTA('f."fechaFactura"')} AS mes, COUNT(*)::int AS facturas, ROUND(SUM(f.total))::float8 AS total
			 FROM ${facturas} WHERE ${donde} GROUP BY 1 ORDER BY 1 DESC LIMIT 12`,
		),
		accion: 'Revisar si realmente se cobraron. Si no, cancelar la factura (queda coherente). No requiere tocar nada para migrar.',
	});
};

const huerfanos: Verificacion = async ({q, esq}) => {
	if (!esq.tiene('ordenes') || !esq.tiene('facturas_ventas')) return null;
	const ordenesSinFactura = await numero(
		q,
		`SELECT COUNT(*)::int FROM ordenes o WHERE o.factura_id IS NULL OR NOT EXISTS (SELECT 1 FROM facturas_ventas f WHERE f.factura_id = o.factura_id)`,
	);
	const facturasSinOrden = await numero(
		q,
		`SELECT COUNT(*)::int FROM facturas_ventas f WHERE NOT EXISTS (SELECT 1 FROM ordenes o WHERE o.factura_id = f.factura_id)`,
	);
	const facturasSinLineas = await numero(
		q,
		`SELECT COUNT(*)::int FROM facturas_ventas f WHERE COALESCE(f.total, 0) > 0 AND EXISTS (SELECT 1 FROM ordenes o WHERE o.factura_id = f.factura_id)
		   AND NOT EXISTS (SELECT 1 FROM ordenes o JOIN ordenes_productos op ON op.orden_id = o.orden_id WHERE o.factura_id = f.factura_id)`,
	);
	return hallazgo({
		id: 'huerfanos',
		titulo: 'Órdenes sin factura, facturas sin orden y facturas sin líneas',
		severidad: ordenesSinFactura ? 'atencion' : 'info',
		cantidad: ordenesSinFactura + facturasSinOrden + facturasSinLineas,
		detalle:
			`Órdenes sin factura: ${ordenesSinFactura} (no cuentan como venta). Facturas sin orden: ${facturasSinOrden} (importadas por CSV: SÍ cuentan). ` +
			`Facturas con orden pero sin líneas: ${facturasSinLineas} (cuentan en dinero, no aparecen en las tablas de productos).`,
	});
};

const lineasSinVariante: Verificacion = async ({q, esq}) => {
	if (!esq.tiene('ordenes_productos')) return null;
	const sinVariante = await numero(q, `SELECT COUNT(*)::int FROM ordenes_productos WHERE variante_id IS NULL`);
	const total = await numero(q, `SELECT COUNT(*)::int FROM ordenes_productos`);
	const raras = await numero(
		q,
		`SELECT COUNT(*)::int FROM ordenes_productos WHERE COALESCE(precio_unitario, 0) <= 0 OR COALESCE(cantidad, 0) <= 0`,
	);
	return hallazgo({
		id: 'lineas',
		titulo: 'Líneas de venta sin variante o con precio/cantidad en cero',
		severidad: 'info',
		cantidad: sinVariante + raras,
		detalle:
			`${sinVariante} de ${total} líneas no tienen variante_id: el detalle estructurado (producto, tamaño, sabores) se deduce de su TEXTO ` +
			`y las que no se reconozcan quedan "sin producto" en la analítica. Con precio o cantidad ≤ 0: ${raras}.`,
		muestra: sinVariante
			? await q(
					`SELECT producto, COUNT(*)::int AS lineas FROM ordenes_productos WHERE variante_id IS NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
				)
			: undefined,
	});
};

const datosDePrueba: Verificacion = async ({q, esq}) => {
	let facturas = 0;
	let clientes = 0;
	if (esq.tiene('facturas_ventas', 'descripcion')) {
		facturas = await numero(
			q,
			`SELECT COUNT(*)::int FROM facturas_ventas
			 WHERE descripcion IN ('Consumo en local', 'Para llevar') OR descripcion ~ '^Domicilio #[0-9]+$' OR cliente_nombre ~ '^Cliente Paso [0-9]+$'
			    OR ${esq.tiene('facturas_ventas', 'idempotency_key') ? `idempotency_key LIKE 'demo-%'` : 'FALSE'}`,
		);
	}
	if (esq.tiene('clientes')) {
		clientes = await numero(
			q,
			`SELECT COUNT(*)::int FROM clientes WHERE telefono = ANY($1::text[]) OR telefono LIKE '3102%'`,
			[TELEFONOS_SEMILLA],
		);
	}
	if (!facturas && !clientes) return null;
	return hallazgo({
		id: 'datos-de-prueba',
		titulo: 'Posibles datos de PRUEBA sembrados (seed-orders / seed:demo) mezclados con los reales',
		severidad: 'atencion',
		cantidad: facturas + clientes,
		detalle: `${facturas} facturas y ${clientes} clientes tienen el patrón de los seeders de prueba (Consumo en local, Para llevar, Domicilio #N, teléfonos 31000…/3102…).`,
		accion: 'Si son de prueba, borrarlos ANTES de migrar (inflan ventas y estadísticas): primero SELECT para confirmar; las facturas se borran en cascada con sus órdenes y líneas.',
	});
};

const telefonos: Verificacion = async ({q, esq}) => {
	const revisar: [string, string][] = [
		['clientes', 'telefono'],
		['facturas_ventas', 'telefono_cliente'],
		['domicilios', 'telefono'],
		['domicilios', 'telefono_domiciliario_asignado'],
		['domiciliarios', 'telefono'],
	];
	const filas: Record<string, unknown>[] = [];
	let total = 0;
	for (const [tabla, columna] of revisar) {
		if (!esq.tiene(tabla, columna)) continue;
		const n = await numero(
			q,
			`SELECT COUNT(*)::int FROM ${tabla} WHERE NULLIF(btrim(${columna}), '') IS NOT NULL AND ${columna} !~ '${TELEFONO_CANONICO}'`,
		);
		if (n) filas.push({campo: `${tabla}.${columna}`, noCanonicos: n});
		total += n;
	}
	let colisiones = 0;
	if (esq.tiene('clientes')) {
		colisiones = await numero(
			q,
			`SELECT COUNT(*)::int FROM (SELECT right(regexp_replace(telefono, '\\D', '', 'g'), 10) AS n FROM clientes GROUP BY 1 HAVING COUNT(*) > 1) x`,
		);
	}
	if (!total && !colisiones) return null;
	return hallazgo({
		id: 'telefonos',
		titulo: 'Teléfonos que no están en formato local de 10 dígitos',
		severidad: 'atencion',
		cantidad: total + colisiones,
		detalle:
			`El sistema compara teléfonos normalizados (últimos 10 dígitos) en perfil de cliente y analítica, pero GET /domicilios/me y el ` +
			`login del domiciliario comparan el texto exacto. Clientes que serían el mismo número al normalizar: ${colisiones}.`,
		muestra: filas,
		accion: 'No bloquea la migración. Normalizar a mano (sin +57 ni espacios) los de domiciliarios; los de clientes pueden esperar.',
	});
};

const domiciliariosYUsuarios: Verificacion = async ({q, esq}) => {
	if (!esq.tiene('users') || !esq.tiene('domiciliarios')) return null;
	const sinUsuario = await numero(
		q,
		`SELECT COUNT(*)::int FROM domiciliarios m WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.username = m.telefono)`,
	);
	const usuarioSinFila = await numero(
		q,
		`SELECT COUNT(*)::int FROM users u WHERE 'domiciliario' = ANY(u.roles) AND NOT EXISTS (SELECT 1 FROM domiciliarios m WHERE m.telefono = u.username)`,
	);
	if (!sinUsuario && !usuarioSinFila) return null;
	return hallazgo({
		id: 'domiciliarios-usuarios',
		titulo: 'Domiciliarios y usuarios que no se corresponden (username = teléfono)',
		severidad: 'atencion',
		cantidad: sinUsuario + usuarioSinFila,
		detalle:
			`Domiciliarios sin usuario con su teléfono: ${sinUsuario}. Usuarios domiciliario sin fila en domiciliarios: ${usuarioSinFila}. ` +
			`Ese usuario no ve sus entregas y la ubicación GPS responde 404.`,
	});
};

const usuariosYRoles: Verificacion = async ({q, esq}) => {
	if (!esq.tiene('users')) return null;
	const conocidos = Object.values(Role);
	const sinRol = await numero(q, `SELECT COUNT(*)::int FROM users WHERE cardinality(roles) = 0`);
	const raros = await numero(
		q,
		`SELECT COUNT(*)::int FROM users u WHERE EXISTS (SELECT 1 FROM unnest(u.roles) r WHERE r <> ALL($1::text[]))`,
		[conocidos],
	);
	const admins = await numero(q, `SELECT COUNT(*)::int FROM users WHERE 'admin' = ANY(roles)`);
	return hallazgo({
		id: 'usuarios-roles',
		titulo: 'Usuarios sin rol o con roles desconocidos',
		severidad: sinRol || raros || !admins ? 'atencion' : 'info',
		cantidad: sinRol + raros + (admins ? 0 : 1),
		detalle:
			`Sin ningún rol: ${sinRol}. Con rol desconocido: ${raros}. Administradores: ${admins}. La API nueva exige rol en TODA operación de ` +
			`escritura: un usuario sin rol podía hacer casi todo antes y ahora recibirá 403.`,
		muestra: await q(
			`SELECT username, roles FROM users u
			 WHERE cardinality(roles) = 0 OR EXISTS (SELECT 1 FROM unnest(u.roles) r WHERE r <> ALL($1::text[])) ORDER BY username LIMIT 10`,
			[conocidos],
		),
	});
};

const cajaHuerfana: Verificacion = async ({q, esq}) => {
	if (!esq.tiene('caja_movimientos') || !esq.tiene('facturas_ventas')) return null;
	const sql = `
		WITH mov AS (
			SELECT COALESCE(m.factura_venta_id, NULLIF(substring(m.descripcion from '^Cambio (?:abono )?factura #([0-9]+)'), '')::bigint) AS fid,
				CASE m.tipo WHEN 'entrada' THEN m.total WHEN 'salida' THEN -m.total ELSE 0 END AS neto
			FROM caja_movimientos m WHERE m.tipo IN ('entrada', 'salida')
		), por_factura AS (SELECT fid, SUM(neto) AS neto FROM mov WHERE fid IS NOT NULL GROUP BY 1)
		SELECT p.fid AS factura_id, p.neto::float8 AS neto, f.estado
		FROM por_factura p JOIN facturas_ventas f ON f.factura_id = p.fid
		WHERE p.neto > 0 AND f.estado IN ('pendiente', 'cancelado')`;
	const filas = await q(sql);
	if (!filas.length) return null;
	return hallazgo({
		id: 'caja-huerfana',
		titulo: 'Efectivo que quedó en caja de facturas que HOY no están cobradas',
		severidad: 'atencion',
		cantidad: filas.length,
		detalle:
			`$${Math.round(filas.reduce((s, f) => s + Number(f.neto), 0)).toLocaleString('es-CO')} entraron a caja y la factura se revirtió o canceló ` +
			`sin sacar el dinero (la facturación nueva ya lo compensa, el histórico no). Si se vuelve a cobrar una de ellas, entra otra vez a caja.`,
		muestra: filas.slice(0, 10),
		accion: 'Informativo: el saldo de caja sigue partiendo del último arqueo. Si una de estas se va a volver a cobrar, hacer antes un ajuste de caja por esa suma.',
	});
};

const egresos: Verificacion = async ({q, esq}) => {
	if (!esq.tiene('facturas_pagos')) return null;
	const total = await numero(q, `SELECT COUNT(*)::int FROM facturas_pagos`);
	if (!total) return null;
	const sinTipo = esq.tiene('facturas_pagos', 'tipo_gasto')
		? await numero(q, `SELECT COUNT(*)::int FROM facturas_pagos WHERE NULLIF(btrim(tipo_gasto), '') IS NULL`)
		: total;
	const qrSinCuenta = esq.tiene('facturas_pagos', 'cuenta_origen_id')
		? await numero(q, `SELECT COUNT(*)::int FROM facturas_pagos WHERE metodo = 'qr' AND cuenta_origen_id IS NULL`)
		: await numero(q, `SELECT COUNT(*)::int FROM facturas_pagos WHERE metodo = 'qr'`);
	const categoriaRara = await numero(
		q,
		`SELECT COUNT(*)::int FROM facturas_pagos WHERE categoria IS NOT NULL AND categoria <> ALL($1::text[])`,
		[IDS_CATEGORIA_GASTO],
	);
	const metodoRaro = await numero(
		q,
		`SELECT COUNT(*)::int FROM facturas_pagos WHERE NULLIF(btrim(metodo), '') IS NOT NULL AND metodo <> ALL($1::text[])`,
		[METODOS_EGRESO],
	);
	return hallazgo({
		id: 'egresos',
		titulo: 'Egresos por clasificar y asignar a cuenta',
		severidad: categoriaRara || metodoRaro ? 'atencion' : 'info',
		cantidad: sinTipo + qrSinCuenta + categoriaRara + metodoRaro,
		detalle:
			`De ${total} egresos: ${sinTipo} sin tipo (costo/gasto) → saldrán como "sin clasificar"; ${qrSinCuenta} pagados por QR sin la cuenta de la que salieron; ` +
			`${categoriaRara} con categoría fuera del catálogo; ${metodoRaro} con método desconocido.`,
		muestra: await q(
			`SELECT COALESCE(categoria, '(vacío)') AS categoria, COUNT(*)::int AS egresos FROM facturas_pagos GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
		),
		accion: 'Se clasifican tocando cada egreso en Contabilidad › Egresos. No bloquea la migración.',
	});
};

// ── Catálogo, sabores e inventario ──────────────────────────────────────────

const saboresRepetidos: Verificacion = async ({q, esq}) => {
	if (!esq.tiene('pizza_sabores', 'tipo')) return null;
	const repetidos = await q(
		`SELECT lower(btrim(nombre)) AS nombre, string_agg(tipo, ', ' ORDER BY tipo) AS tipos, COUNT(*)::int AS filas
		 FROM pizza_sabores WHERE tipo IS DISTINCT FROM 'configuracion' GROUP BY 1 HAVING COUNT(*) > 1 ORDER BY 1`,
	);
	const tradicionalesConRecargo = await numero(
		q,
		`SELECT COUNT(*)::int FROM pizza_sabores WHERE tipo = 'tradicional' AND (recargo_pequena > 0 OR recargo_mediana > 0 OR recargo_grande > 0)`,
	);
	const [config] = await q(
		`SELECT recargo_pequena AS pequena, recargo_mediana AS mediana, recargo_grande AS grande FROM pizza_sabores WHERE nombre = 'RECARGO_3_SABORES' AND tipo = 'configuracion' LIMIT 1`,
	);
	const dentroDePizza = repetidos.filter((r) => /tradicional/.test(r.tipos) && /especial/.test(r.tipos));
	return hallazgo({
		id: 'sabores',
		titulo: 'Sabores: repetidos, recargos heredados y recargo por 3 sabores',
		severidad: 'info',
		cantidad: repetidos.length,
		detalle:
			`Repetidos entre tradicional y especial (el especial gana, el tradicional queda inactivo): ${dentroDePizza.length}. ` +
			`Repetidos entre pizza y calzone (se conservan, son de otro grupo): ${repetidos.length - dentroDePizza.length}. ` +
			`Tradicionales con recargo (se ponen en 0, nunca lo cobraron): ${tradicionalesConRecargo}. ` +
			(config
				? `Recargo por 3 sabores: pequeña ${config.pequena}, mediana ${config.mediana}, grande ${config.grande} (donde esté en 0 se cobraba 3000).`
				: 'No existe la fila RECARGO_3_SABORES: el recargo por 3 sabores será 3000 en todos los tamaños.'),
		muestra: repetidos.slice(0, 10),
	});
};

const calzoneSinSabores: Verificacion = async ({q, esq}) => {
	if (!esq.tiene('productos') || !esq.tiene('producto_variantes')) return null;
	const productos = await q(
		`SELECT producto_id AS id, producto_nombre AS nombre, ${esq.tiene('productos', 'personalizacion') ? 'personalizacion' : 'NULL'} AS personalizacion FROM productos`,
	);
	const calzones = productos
		.filter((p) => resolverPersonalizacion(p.nombre, p.personalizacion) === 'calzone')
		.map((p) => Number(p.id));
	if (!calzones.length) return null;
	const variantes = await q(
		`SELECT DISTINCT nombre FROM producto_variantes WHERE producto_id = ANY($1::int[]) ORDER BY nombre`,
		[calzones],
	);
	const sabores = variantes.map((v) => String(v.nombre)).filter((n) => !/\bunidad\b|dos sabores/i.test(n));
	const yaTiene = esq.tiene('pizza_sabores', 'tipo')
		? await numero(q, `SELECT COUNT(*)::int FROM pizza_sabores WHERE tipo = 'calzone'`)
		: 0;
	return hallazgo({
		id: 'calzone-sabores',
		titulo: 'Sabores del Calzone (hoy son los nombres de sus variantes)',
		severidad: 'info',
		cantidad: yaTiene ? 0 : sabores.length,
		detalle: yaTiene
			? `Ya hay ${yaTiene} sabores de calzone en el catálogo.`
			: `La carta nueva elige sabores del GRUPO: la migración crea ${sabores.length} sabores en el grupo Calzone a partir de las variantes (sin recargo): ${sabores.join(', ') || '(ninguno)'}. Revisa que no sobre ni falte alguno en Gestión de sabores.`,
	});
};

const variantesDePizza: Verificacion = async ({q, esq}) => {
	if (!esq.tiene('productos') || !esq.tiene('producto_variantes')) return null;
	const productos = await q(
		`SELECT producto_id AS id, producto_nombre AS nombre, ${esq.tiene('productos', 'personalizacion') ? 'personalizacion' : 'NULL'} AS personalizacion FROM productos`,
	);
	const ids = productos
		.filter((p) => resolverPersonalizacion(p.nombre, p.personalizacion) === 'pizza')
		.map((p) => Number(p.id));
	if (!ids.length) return null;
	const variantes = await q(
		`SELECT nombre FROM producto_variantes WHERE producto_id = ANY($1::int[]) ORDER BY nombre`,
		[ids],
	);
	const sinTamano = variantes.map((v) => String(v.nombre)).filter((n) => !normalizarTamano(n));
	return hallazgo({
		id: 'variantes-pizza',
		titulo: 'Variantes de pizza cuyo tamaño no se reconoce por el nombre',
		severidad: sinTamano.length ? 'atencion' : 'info',
		cantidad: sinTamano.length,
		detalle: sinTamano.length
			? `Se cobrarán como GRANDE (igual que antes): ${sinTamano.join(', ')}. Si alguna es otro tamaño, fijarlo en la variante.`
			: 'Todas las variantes tienen un tamaño reconocible.',
	});
};

const inventarioAnterior: Verificacion = async ({q, esq}) => {
	const partes: string[] = [];
	let negativos = 0;
	if (esq.tiene('inventario_cajas')) {
		const n = await numero(q, `SELECT COUNT(*)::int FROM inventario_cajas`);
		negativos += await numero(q, `SELECT COUNT(*)::int FROM inventario_cajas WHERE cantidad < 0`);
		partes.push(`${n} tipos de caja`);
	}
	if (esq.tiene('producto_variantes', 'stock_bebida')) {
		const n = await numero(q, `SELECT COUNT(*)::int FROM producto_variantes WHERE COALESCE(stock_bebida, 0) <> 0`);
		negativos += await numero(q, `SELECT COUNT(*)::int FROM producto_variantes WHERE stock_bebida < 0`);
		partes.push(`${n} variantes con stock de bebida`);
	}
	if (esq.tiene('ingredientes_bebidas'))
		partes.push(`${await numero(q, `SELECT COUNT(*)::int FROM ingredientes_bebidas`)} pulpas (NO se migran)`);
	if (!partes.length) return null;
	return hallazgo({
		id: 'inventario-anterior',
		titulo: 'Inventario anterior que pasa al inventario unificado',
		severidad: negativos ? 'atencion' : 'info',
		cantidad: negativos,
		detalle: `${partes.join('; ')}. Existencias negativas (se migran como 0): ${negativos}. El historial de movimientos viejo no se copia: queda en sus tablas.`,
	});
};

// ── Arranque ────────────────────────────────────────────────────────────────

const cierreDeAyer: Verificacion = async ({q, esq}) => {
	if (!esq.tiene('cierres_caja')) return null;
	const hay = await numero(
		q,
		`SELECT COUNT(*)::int FROM cierres_caja WHERE fecha = ((now() AT TIME ZONE 'America/Bogota')::date - 1)`,
	);
	return hallazgo({
		id: 'cierre-de-ayer',
		titulo: 'Cierre de caja de AYER',
		severidad: hay ? 'info' : 'atencion',
		cantidad: hay ? 0 : 1,
		detalle: hay
			? 'Ya existe: al arrancar el backend no generará (ni enviará por correo) ningún cierre.'
			: 'NO existe. Al arrancar, el backend generará y ENVIARÁ POR CORREO el cierre de ayer, con las migraciones de datos aún en curso. Despliega después de que exista (el cron de las 00:05 lo crea) o genéralo antes desde la app.',
	});
};

const configuracionBase: Verificacion = async ({q, esq}) => {
	const empresa = esq.tiene('empresa_config') ? await numero(q, `SELECT COUNT(*)::int FROM empresa_config`) : 0;
	const cuentas = esq.tiene('cuentas_transferencia')
		? await numero(q, `SELECT COUNT(*)::int FROM cuentas_transferencia`)
		: 0;
	return hallazgo({
		id: 'configuracion-base',
		titulo: 'Datos del negocio y cuentas de transferencia',
		severidad: empresa && cuentas ? 'info' : 'atencion',
		cantidad: empresa && cuentas ? 0 : 1,
		detalle:
			`Filas en empresa_config: ${empresa}. Cuentas de transferencia: ${cuentas}. ` +
			(cuentas
				? 'Las cuentas existentes se conservan.'
				: 'Sin cuentas, el backend crea al arrancar tres de ejemplo (Jeferson, Diana, Firu): crea las reales ANTES del primer cobro por QR.'),
	});
};

const VERIFICACIONES: Verificacion[] = [
	volumen,
	esquemaPorActualizar,
	columnasQueSeBorran,
	domiciliarioHuerfano,
	domiciliarioTelefonoConDatos,
	estadosFactura,
	metodosFactura,
	pagadasSinMetodo,
	mixtasSinDesglose,
	montosPorCompletar,
	transferenciasSinCuenta,
	cuentasSoloNombre,
	cuentasDuplicadas,
	ventasConOrdenCancelada,
	huerfanos,
	lineasSinVariante,
	datosDePrueba,
	telefonos,
	domiciliariosYUsuarios,
	usuariosYRoles,
	cajaHuerfana,
	egresos,
	saboresRepetidos,
	calzoneSinSabores,
	variantesDePizza,
	inventarioAnterior,
	cierreDeAyer,
	configuracionBase,
];

/** Corre todas las verificaciones. Una que falle por una particularidad de la base NO tumba las demás: queda como atención. */
export async function auditarBase(q: Ejecutar): Promise<ResultadoAuditoria> {
	const esq = await leerEsquema(q);
	const ctx: Contexto = {q, esq, facturas: esq.tiene('facturas_ventas') ? fuenteFacturas(esq) : 'facturas_ventas f'};
	const hallazgos: Hallazgo[] = [];
	for (const verificar of VERIFICACIONES) {
		try {
			const h = await verificar(ctx);
			if (h) hallazgos.push(h);
		} catch (error) {
			hallazgos.push({
				id: `error-${verificar.name}`,
				titulo: `No se pudo correr la verificación "${verificar.name}"`,
				severidad: 'atencion',
				cantidad: 1,
				detalle: (error as Error)?.message ?? String(error),
			});
		}
	}
	return {
		generadaEn: new Date().toISOString(),
		hallazgos,
		bloqueantes: hallazgos.filter((h) => h.severidad === 'bloqueante' && h.cantidad > 0).length,
		atenciones: hallazgos.filter((h) => h.severidad === 'atencion' && h.cantidad > 0).length,
	};
}

const ETIQUETA: Record<Severidad, string> = {bloqueante: '⛔ BLOQUEANTE', atencion: '⚠️  ATENCIÓN', info: 'ℹ️  INFO'};

/** Texto legible del informe (consola / archivo). */
export function formatearAuditoria(r: ResultadoAuditoria): string {
	const orden: Severidad[] = ['bloqueante', 'atencion', 'info'];
	const lineas: string[] = [
		`AUDITORÍA PREVIA A LA MIGRACIÓN — ${r.generadaEn}`,
		`Bloqueantes: ${r.bloqueantes} · Para revisar: ${r.atenciones}`,
		r.bloqueantes
			? '>>> NO DESPLEGAR hasta resolver los bloqueantes. <<<'
			: 'Sin bloqueantes: se puede ensayar la migración.',
		'',
	];
	for (const sev of orden) {
		for (const h of r.hallazgos.filter((x) => x.severidad === sev)) {
			if (sev !== 'info' && h.cantidad === 0) continue;
			lineas.push(`${ETIQUETA[sev]} [${h.id}] ${h.titulo}${h.cantidad ? ` — ${h.cantidad}` : ''}`);
			if (h.detalle) lineas.push(`    ${h.detalle}`);
			for (const fila of h.muestra ?? []) lineas.push(`      · ${JSON.stringify(fila)}`);
			if (h.accion) lineas.push(`    → ${h.accion}`);
			lineas.push('');
		}
	}
	return lineas.join('\n');
}
