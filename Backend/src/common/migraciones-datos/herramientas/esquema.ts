/** Ejecuta SQL parametrizado y devuelve las filas (`pg` en el comando; PGlite en las pruebas). SOLO LECTURA en las herramientas. */
export type Ejecutar = (sql: string, params?: unknown[]) => Promise<any[]>;

/** Qué tablas y columnas tiene la base AHORA: las herramientas se adaptan a cualquier versión del esquema. */
export interface Esquema {
	tiene(tabla: string, columna?: string): boolean;
}

export async function leerEsquema(q: Ejecutar): Promise<Esquema> {
	const filas = await q(
		`SELECT table_name AS tabla, column_name AS columna
		 FROM information_schema.columns WHERE table_schema = 'public'`,
	);
	const tablas = new Map<string, Set<string>>();
	for (const f of filas) {
		const columnas = tablas.get(f.tabla) ?? new Set<string>();
		columnas.add(f.columna);
		tablas.set(f.tabla, columnas);
	}
	return {
		tiene: (tabla, columna) => {
			const columnas = tablas.get(tabla);
			if (!columnas) return false;
			return columna === undefined ? true : columnas.has(columna);
		},
	};
}

/** Primer valor numérico de la primera fila (0 si no hay). */
export async function numero(q: Ejecutar, sql: string, params: unknown[] = []): Promise<number> {
	const [fila] = await q(sql, params);
	const valor = fila ? Object.values(fila)[0] : 0;
	const n = Number(valor);
	return Number.isFinite(n) ? n : 0;
}

/**
 * `facturas_ventas f` con las columnas nuevas que aún no existan expuestas como NULL, para poder usar los fragmentos
 * SQL de `common/domain/ventas.ts` (que leen `monto_pagado`) también ANTES de que `synchronize` las cree.
 */
export function fuenteFacturas(esq: Esquema): string {
	const faltantes: string[] = [];
	if (!esq.tiene('facturas_ventas', 'monto_pagado')) faltantes.push('NULL::numeric AS monto_pagado');
	if (!esq.tiene('facturas_ventas', 'cuenta_transferencia_id'))
		faltantes.push('NULL::int AS cuenta_transferencia_id');
	if (!esq.tiene('facturas_ventas', 'cuenta_transferencia_nombre'))
		faltantes.push('NULL::text AS cuenta_transferencia_nombre');
	if (!esq.tiene('facturas_ventas', 'desglose_transferencia'))
		faltantes.push('NULL::jsonb AS desglose_transferencia');
	return faltantes.length ? `(SELECT ff.*, ${faltantes.join(', ')} FROM facturas_ventas ff) f` : 'facturas_ventas f';
}

/** Mes (yyyy-mm) de una fecha con hora, en hora de Bogotá. */
export const SQL_MES_BOGOTA = (columna: string) => `to_char(${columna} AT TIME ZONE 'America/Bogota', 'YYYY-MM')`;
