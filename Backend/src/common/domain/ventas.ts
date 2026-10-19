/**
 * Definiciones ÚNICAS de las métricas de venta. Toda la analítica (y las pantallas de
 * dinero cuando migren) deben usar estas funciones/fragmentos en vez de reescribir
 * su propia versión de "cobrado", "venta válida", etc.
 *
 * Espejo en el frontend: Frontend/src/shared/domain/factura.ts (mantener alineados).
 */

export const ESTADOS_FACTURA_COBRADA = ['pagado', 'pagada'] as const;
export const ESTADO_ANULADO = 'cancelado';
/** Estados de domicilio que cuentan como entregado (mismo criterio que RiderApp). */
export const ESTADOS_DOMICILIO_ENTREGADO = ['entregado', 'completado', 'completada'] as const;

export type MetodoPagoNormalizado = 'efectivo' | 'transferencia' | 'mixto' | 'sin_metodo' | 'otro';

/** Campos de una factura que intervienen en las métricas de dinero. */
export interface FacturaMontos {
	estado?: string | null;
	total?: number | string | null;
	montoPagado?: number | string | null;
	metodo?: string | null;
	pagoEfectivo?: number | string | null;
	pagoTransferencia?: number | string | null;
}

const num = (v: number | string | null | undefined): number => {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
};

const estadoDe = (f: FacturaMontos) => (f.estado ?? '').toLowerCase();

export function esCobrada(f: FacturaMontos): boolean {
	return (ESTADOS_FACTURA_COBRADA as readonly string[]).includes(estadoDe(f));
}

export function esAnulada(f: FacturaMontos): boolean {
	return estadoDe(f) === ESTADO_ANULADO;
}

export function esParcial(f: FacturaMontos): boolean {
	return estadoDe(f) === 'parcial';
}

/** Pendiente = ni cobrada ni anulada. `incluirParcial` decide si las abonadas cuentan. */
export function esPendiente(f: FacturaMontos, {incluirParcial = false}: {incluirParcial?: boolean} = {}): boolean {
	if (esCobrada(f) || esAnulada(f)) return false;
	return incluirParcial || !esParcial(f);
}

/**
 * Lo efectivamente cobrado de una factura. Topado al total: `monto_pagado` puede quedar
 * desfasado (p. ej. tras "revertir") y las importadas por CSV lo traen NULL.
 */
export function cobrado(f: FacturaMontos): number {
	const total = num(f.total);
	if (esCobrada(f)) return Math.min(f.montoPagado == null ? total : num(f.montoPagado), total);
	if (esParcial(f)) return Math.min(num(f.montoPagado), total);
	return 0;
}

export function porCobrar(f: FacturaMontos): number {
	if (esAnulada(f)) return 0;
	return Math.max(0, num(f.total) - cobrado(f));
}

export function normalizarMetodo(metodo?: string | null): MetodoPagoNormalizado {
	const m = (metodo ?? '').toLowerCase().trim();
	if (!m) return 'sin_metodo';
	if (m === 'efectivo_transferencia') return 'mixto';
	if (m === 'transferencia' || m === 'qr') return 'transferencia';
	if (m === 'efectivo') return 'efectivo';
	return 'otro';
}

/** Método final de una factura saldada por abonos, según lo que entró por cada vía. */
export function metodoSegunPagos(efectivo: number, transferencia: number): 'efectivo' | 'transferencia' | 'efectivo_transferencia' {
	if (efectivo > 0 && transferencia > 0) return 'efectivo_transferencia';
	return transferencia > 0 ? 'transferencia' : 'efectivo';
}

/** Parte cobrada en efectivo. Mixtas y parciales (abonos) llevan el desglose en sus campos. */
export function montoEfectivo(f: FacturaMontos): number {
	return desglosePorMetodo(f).efectivo;
}

/** Parte cobrada por transferencia/QR. */
export function montoTransferencia(f: FacturaMontos): number {
	return desglosePorMetodo(f).transferencia;
}

/**
 * Reparte lo COBRADO entre efectivo y transferencia. Solo reparten cobradas y parciales
 * (una pendiente o anulada puede conservar un desglose viejo tras "revertir"). Mixtas, y
 * parciales con desglose, usan pagoEfectivo/pagoTransferencia; el resto va todo a su método.
 */
function desglosePorMetodo(f: FacturaMontos): {efectivo: number; transferencia: number} {
	if (!(esCobrada(f) || esParcial(f))) return {efectivo: 0, transferencia: 0};
	const metodo = normalizarMetodo(f.metodo);
	const tieneDesglose = f.pagoEfectivo != null || f.pagoTransferencia != null;
	if (metodo === 'mixto' || (esParcial(f) && tieneDesglose)) {
		return {efectivo: num(f.pagoEfectivo), transferencia: num(f.pagoTransferencia)};
	}
	const total = cobrado(f);
	if (metodo === 'efectivo') return {efectivo: total, transferencia: 0};
	if (metodo === 'transferencia') return {efectivo: 0, transferencia: total};
	return {efectivo: 0, transferencia: 0};
}

// ─── Fragmentos SQL (PostgreSQL) ─────────────────────────────────────────────
// `f` = alias de facturas_ventas. Columnas reales: "fechaFactura" (camelCase, sin
// name explícito en la entidad), monto_pagado, pago_efectivo, pago_transferencia.

/** Venta válida: factura no anulada cuya orden (si tiene) no está cancelada. Las
 *  facturas importadas por CSV no tienen orden y cuentan. `IS DISTINCT FROM` mantiene
 *  las filas con estado NULL (un `!=` las descartaría en silencio). */
export function sqlFacturaValida(f = 'f'): string {
	return `(${f}.estado IS DISTINCT FROM '${ESTADO_ANULADO}' AND (
		NOT EXISTS (SELECT 1 FROM ordenes o_v WHERE o_v.factura_id = ${f}.factura_id)
		OR EXISTS (SELECT 1 FROM ordenes o_v WHERE o_v.factura_id = ${f}.factura_id AND o_v.estado_orden IS DISTINCT FROM '${ESTADO_ANULADO}')
	))`;
}

export function sqlCobrado(f = 'f'): string {
	return `(CASE
		WHEN ${f}.estado IN ('pagado', 'pagada') THEN LEAST(COALESCE(${f}.monto_pagado, ${f}.total, 0), COALESCE(${f}.total, 0))
		WHEN ${f}.estado = 'parcial' THEN LEAST(COALESCE(${f}.monto_pagado, 0), COALESCE(${f}.total, 0))
		ELSE 0 END)`;
}

export function sqlPorCobrar(f = 'f'): string {
	return `(CASE WHEN ${f}.estado = '${ESTADO_ANULADO}' THEN 0 ELSE GREATEST(COALESCE(${f}.total, 0) - ${sqlCobrado(f)}, 0) END)`;
}

/** Timestamp de la factura en hora de Bogotá (para agrupar por día/hora/día de semana). */
export function sqlFechaBogota(f = 'f'): string {
	return `(${f}."fechaFactura" AT TIME ZONE 'America/Bogota')`;
}

export function sqlMetodoNormalizado(f = 'f'): string {
	return `(CASE
		WHEN ${f}.metodo = 'efectivo_transferencia' THEN 'mixto'
		WHEN ${f}.metodo IN ('transferencia', 'qr') THEN 'transferencia'
		WHEN ${f}.metodo = 'efectivo' THEN 'efectivo'
		WHEN ${f}.metodo IS NULL OR ${f}.metodo = '' THEN 'sin_metodo'
		ELSE 'otro' END)`;
}

/** Misma regla que desglosePorMetodo(): solo cobradas y parciales reparten. */
function sqlMontoPorMetodo(f: string, columnaDesglose: string, condicionMetodo: string): string {
	return `(CASE
		WHEN ${f}.estado IS NULL OR ${f}.estado NOT IN ('pagado', 'pagada', 'parcial') THEN 0
		WHEN ${f}.metodo = 'efectivo_transferencia'
			OR (${f}.estado = 'parcial' AND (${f}.pago_efectivo IS NOT NULL OR ${f}.pago_transferencia IS NOT NULL))
			THEN COALESCE(${f}.${columnaDesglose}, 0)
		WHEN ${condicionMetodo} THEN ${sqlCobrado(f)}
		ELSE 0 END)`;
}

export function sqlMontoEfectivo(f = 'f'): string {
	return sqlMontoPorMetodo(f, 'pago_efectivo', `${f}.metodo = 'efectivo'`);
}

export function sqlMontoTransferencia(f = 'f'): string {
	return sqlMontoPorMetodo(f, 'pago_transferencia', `${f}.metodo IN ('transferencia', 'qr')`);
}

// ─── Cuentas de transferencia ────────────────────────────────────────────────

/**
 * Parte de una transferencia que entró a una cuenta. Una factura con abonos por QR a
 * cuentas distintas lleva una entrada por cuenta en `desglose_transferencia`; sin
 * desglose, todo lo cobrado por transferencia pertenece a la cuenta de la factura.
 */
export interface DesgloseTransferencia {
	cuentaId: number | null;
	cuenta: string | null;
	monto: number;
}

/** Suma `monto` a la entrada de la misma cuenta (por id, o por nombre si no hay id) o crea una nueva. */
export function acumularDesglose(
	actual: DesgloseTransferencia[] | null | undefined,
	cuentaId: number | null | undefined,
	cuenta: string | null | undefined,
	monto: number,
): DesgloseTransferencia[] {
	const lista = (actual ?? []).map((e) => ({...e}));
	const id = cuentaId ?? null;
	const nombre = cuenta?.trim() || null;
	const existente = lista.find((e) => (id != null ? e.cuentaId === id : e.cuentaId == null && e.cuenta === nombre));
	if (existente) existente.monto += monto;
	else lista.push({cuentaId: id, cuenta: nombre, monto});
	return lista;
}

/**
 * LATERAL que resuelve la cuenta de transferencia vigente de una fila: por id, o, en filas
 * viejas que solo guardaron el nombre, por nombre. Así un renombre (o una fila sin id) no
 * parte los totales de una misma cuenta en dos.
 */
export function sqlJoinCuenta(rawId: string, rawNombre: string, alias = 'ct'): string {
	return `LEFT JOIN LATERAL (
		SELECT c_.id, c_.nombre FROM cuentas_transferencia c_
		WHERE c_.id = ${rawId} OR (${rawId} IS NULL AND c_.nombre = ${rawNombre})
		ORDER BY (c_.id = ${rawId}) DESC NULLS LAST, c_.id LIMIT 1
	) ${alias} ON TRUE`;
}

/**
 * Filas (factura, cuenta, monto) de lo cobrado por transferencia, una por cuenta, para las
 * facturas que cumplen `dondeFacturas` (alias `f` de facturas_ventas). Una factura sin
 * desglose aporta una fila con todo su monto por transferencia; con desglose, una por cuenta.
 * Columnas: factura_id, cuenta_id (null = sin asignar), cuenta (nombre vigente), monto.
 */
export function sqlTransferenciasPorCuenta(dondeFacturas: string): string {
	return `SELECT t.factura_id, COALESCE(ct.id, t.cuenta_id_raw) AS cuenta_id,
			COALESCE(ct.nombre, t.nombre_raw) AS cuenta, t.monto
		FROM (
			SELECT f.factura_id, f.cuenta_transferencia_id AS cuenta_id_raw,
				NULLIF(f.cuenta_transferencia_nombre, '') AS nombre_raw,
				${sqlMontoTransferencia('f')} AS monto
			FROM facturas_ventas f
			WHERE ${dondeFacturas} AND f.desglose_transferencia IS NULL
			UNION ALL
			SELECT f.factura_id, NULLIF(e.item->>'cuentaId', '')::int, NULLIF(e.item->>'cuenta', ''),
				COALESCE((e.item->>'monto')::numeric, 0)
			FROM facturas_ventas f
			CROSS JOIN LATERAL jsonb_array_elements(f.desglose_transferencia) AS e(item)
			WHERE ${dondeFacturas} AND f.desglose_transferencia IS NOT NULL
		) t
		${sqlJoinCuenta('t.cuenta_id_raw', 't.nombre_raw')}
		WHERE t.monto > 0`;
}

/**
 * Condición para listar las facturas cuya transferencia fue a una cuenta. `cuentaParam` es el
 * placeholder del id (p. ej. ':cuentaId'); `null` = las SIN cuenta asignada. Contempla el
 * desglose por cuenta y las filas viejas que solo guardaron el nombre.
 */
/**
 * Lo cobrado por transferencia que entró a UNA cuenta: con desglose, solo la parte de esa cuenta; sin desglose,
 * todo lo transferido si la factura es de esa cuenta. Mismo criterio de coincidencia que `sqlCoincideCuenta`
 * (por id, o por nombre en las filas viejas que solo lo guardaron); `cuentaParam` null = lo que quedó sin cuenta.
 * Sirve para que un reporte "de Nequi" no sume la parte de Bancolombia de una factura abonada a las dos.
 */
export function sqlMontoEnCuenta(cuentaParam: string | null, f = 'f'): string {
	const nombre = cuentaParam == null ? '' : `(SELECT nombre FROM cuentas_transferencia WHERE id = ${cuentaParam})`;
	const itemCoincide =
		cuentaParam == null
			? `NULLIF(e.item->>'cuentaId', '') IS NULL AND NULLIF(e.item->>'cuenta', '') IS NULL`
			: `NULLIF(e.item->>'cuentaId', '')::int = ${cuentaParam} OR (NULLIF(e.item->>'cuentaId', '') IS NULL AND e.item->>'cuenta' = ${nombre})`;
	const facturaCoincide =
		cuentaParam == null
			? `${f}.cuenta_transferencia_id IS NULL AND NULLIF(${f}.cuenta_transferencia_nombre, '') IS NULL`
			: `${f}.cuenta_transferencia_id = ${cuentaParam} OR (${f}.cuenta_transferencia_id IS NULL AND ${f}.cuenta_transferencia_nombre = ${nombre})`;
	return `(CASE WHEN ${f}.desglose_transferencia IS NOT NULL
		THEN (SELECT COALESCE(SUM(COALESCE((e.item->>'monto')::numeric, 0)), 0)
			FROM jsonb_array_elements(${f}.desglose_transferencia) AS e(item) WHERE (${itemCoincide}))
		WHEN (${facturaCoincide}) THEN ${sqlMontoTransferencia(f)}
		ELSE 0 END)`;
}

export function sqlCoincideCuenta(cuentaParam: string | null, f = 'f'): string {
	if (cuentaParam == null) {
		return `((${f}.desglose_transferencia IS NULL AND ${f}.cuenta_transferencia_id IS NULL AND NULLIF(${f}.cuenta_transferencia_nombre, '') IS NULL)
			OR EXISTS (SELECT 1 FROM jsonb_array_elements(${f}.desglose_transferencia) AS e(item)
				WHERE NULLIF(e.item->>'cuentaId', '') IS NULL AND NULLIF(e.item->>'cuenta', '') IS NULL))`;
	}
	const nombre = `(SELECT nombre FROM cuentas_transferencia WHERE id = ${cuentaParam})`;
	return `((${f}.desglose_transferencia IS NULL AND (${f}.cuenta_transferencia_id = ${cuentaParam}
				OR (${f}.cuenta_transferencia_id IS NULL AND ${f}.cuenta_transferencia_nombre = ${nombre})))
			OR EXISTS (SELECT 1 FROM jsonb_array_elements(${f}.desglose_transferencia) AS e(item)
				WHERE NULLIF(e.item->>'cuentaId', '')::int = ${cuentaParam}
					OR (NULLIF(e.item->>'cuentaId', '') IS NULL AND e.item->>'cuenta' = ${nombre})))`;
}
