import type {EntityManager} from 'typeorm';

/**
 * true si la tabla (y opcionalmente la columna) existe. Los pasos lo verifican antes
 * de leer, para no romper en instalaciones nuevas o después de una limpieza.
 */
export async function existeColumna(manager: EntityManager, tabla: string, columna?: string): Promise<boolean> {
	if (!columna) {
		const [fila]: {existe: boolean}[] = await manager.query('SELECT to_regclass($1) IS NOT NULL AS existe', [
			`public.${tabla}`,
		]);
		return Boolean(fila?.existe);
	}
	const [fila]: {existe: boolean}[] = await manager.query(
		`SELECT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
		) AS existe`,
		[tabla, columna],
	);
	return Boolean(fila?.existe);
}

/**
 * Ejecuta un UPDATE/DELETE con `RETURNING 1` y devuelve cuántas filas tocó. `manager.query` de TypeORM devuelve
 * `[filas, cantidad]` para UPDATE/DELETE (aunque lleven RETURNING) y solo las filas para SELECT: envolverlo en una CTE
 * lo vuelve siempre un SELECT, igual en TypeORM que en las pruebas con PGlite.
 */
export async function contarActualizadas(manager: EntityManager, sentenciaConReturning: string): Promise<number> {
	const [fila]: {n: number}[] = await manager.query(
		`WITH accion AS (${sentenciaConReturning}) SELECT COUNT(*)::int AS n FROM accion`,
	);
	return Number(fila?.n) || 0;
}

/** Suma conteos de un lote al acumulado (in place). */
export function acumularConteos(
	acumulado: Record<string, number>,
	lote: Record<string, number>,
): Record<string, number> {
	for (const [clave, valor] of Object.entries(lote)) {
		acumulado[clave] = (acumulado[clave] ?? 0) + (Number(valor) || 0);
	}
	return acumulado;
}
