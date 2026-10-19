/** Tanda por defecto y máxima de la paginación por cursor. */
export const LOTE_CURSOR = 500;
export const LOTE_CURSOR_MAX = 1000;

/** `cursor` válido: 'inicio' (primera tanda) o el id de la última fila recibida. */
export const PATRON_CURSOR = /^(inicio|\d+)$/;

export interface Cursor {
	/** Se pidió paginación por cursor (si no, la ruta pagina como siempre). */
	activo: boolean;
	/** Traer filas con id MENOR que este (null = desde la más nueva). */
	despuesDe: string | null;
	limite: number;
}

/**
 * Paginación por CLAVE (id descendente) para traer un rango completo por tandas sin duplicar ni perder filas
 * aunque entren o se borren registros mientras tanto: con `page/offset`, una venta nueva corría las páginas y
 * una fila salía dos veces (y se sumaba dos veces en el libro diario). Con `id < cursor` cada tanda continúa
 * exactamente donde quedó la anterior. El orden por id es el de la exportación CSV; quien muestre por fecha
 * reordena al final.
 */
export function leerCursor(cursor: string | undefined | null, limit?: number | string | null): Cursor {
	const texto = cursor == null ? '' : String(cursor).trim();
	if (!texto || !PATRON_CURSOR.test(texto)) return {activo: false, despuesDe: null, limite: 0};
	const pedido = Number(limit);
	const limite = Number.isFinite(pedido) && pedido > 0 ? Math.min(Math.floor(pedido), LOTE_CURSOR_MAX) : LOTE_CURSOR;
	return {activo: true, despuesDe: texto === 'inicio' ? null : texto, limite};
}

/** Cursor de la tanda siguiente: el id de la última fila si la tanda vino llena; null = no hay más. */
export function siguienteCursor<T>(filas: T[], limite: number, idDe: (fila: T) => number | string): string | null {
	return filas.length >= limite && filas.length > 0 ? String(idDe(filas[filas.length - 1])) : null;
}
