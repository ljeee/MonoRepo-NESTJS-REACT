/** Cuántos registros se piden por tanda cuando se trae un rango completo. */
export const LOTE_PAGINA = 500;

interface PaginaServidor<T> {
  data: T[];
  total: number;
  totalPages: number;
}

interface TandaServidor<T> {
  data: T[];
  total: number;
  totalPages?: number;
  /** id para la tanda siguiente (null = no hay más; ausente = servidor sin cursor). */
  siguiente?: string | null;
}

/**
 * Trae TODO un rango por tandas con paginación POR CLAVE: cada tanda continúa exactamente donde quedó la
 * anterior (`id < cursor`), así una venta que entra o se borra mientras se descarga no duplica ni salta filas
 * (con `page/offset` la llegada de una factura corría las páginas y una salía dos veces en el libro diario).
 * Además se descarta cualquier id repetido. Si el servidor no conoce el cursor (no devuelve `siguiente`), sigue
 * por páginas con `pagina` en vez de quedarse con la primera tanda.
 * Devuelve las filas en el orden del servidor (id descendente) y `total` = filas recibidas.
 */
export async function traerPorCursor<T>(
  pedirTanda: (p: { cursor: string; limite: number; pagina: number }) => Promise<TandaServidor<T>>,
  idDe: (fila: T) => string | number,
  { lote = LOTE_PAGINA, onProgreso }: { lote?: number; onProgreso?: (cargados: number, total: number) => void } = {},
): Promise<{ data: T[]; total: number }> {
  const vistos = new Set<string>();
  const data: T[] = [];
  let cursor = 'inicio';
  let totalServidor = 0;

  // Tope de seguridad por si el servidor no avanzara nunca.
  for (let pagina = 1; pagina <= 1000; pagina++) {
    const tanda = await pedirTanda({ cursor, limite: lote, pagina });
    if (pagina === 1) totalServidor = tanda.total;
    for (const fila of tanda.data) {
      const id = String(idDe(fila) ?? '');
      // Sin id no se puede deduplicar: se conserva (si no, todas las filas sin id colapsarían en una).
      if (id && vistos.has(id)) continue;
      if (id) vistos.add(id);
      data.push(fila);
    }
    onProgreso?.(data.length, Math.max(totalServidor, data.length));

    if (tanda.siguiente === undefined) {
      // Servidor sin paginación por cursor: por páginas.
      if (pagina >= (tanda.totalPages ?? 1) || tanda.data.length === 0) break;
      continue;
    }
    if (!tanda.siguiente || tanda.siguiente === cursor) break;
    cursor = tanda.siguiente;
  }
  return { data, total: data.length };
}

/** Más reciente primero (fecha y luego id): el orden que muestran las pantallas. `traerPorCursor` llega por id. */
export function ordenarRecientesPrimero<T>(filas: T[], fechaDe: (fila: T) => string | Date | null | undefined, idDe: (fila: T) => string | number): T[] {
  const tiempo = (f: T) => {
    const v = fechaDe(f);
    const t = v ? new Date(v).getTime() : NaN;
    return Number.isFinite(t) ? t : 0;
  };
  return filas
    .map((fila) => ({ fila, t: tiempo(fila), id: Number(idDe(fila)) || 0 }))
    .sort((a, b) => b.t - a.t || b.id - a.id)
    .map((x) => x.fila);
}

/**
 * Trae TODO un rango en tandas de `lote` registros, una tras otra, y devuelve el conjunto completo.
 * Sirve para no pedir miles de facturas en una sola respuesta (pesada para el servidor y el celular)
 * sin volver a cortar la lista: la contabilidad necesita ver y sumar todo el rango.
 * `onProgreso(cargados, total)` permite mostrar "Cargando 1.500 de 4.000…".
 */
export async function traerTodasLasPaginas<T>(
  pedirPagina: (pagina: number, limite: number) => Promise<PaginaServidor<T>>,
  { lote = LOTE_PAGINA, onProgreso }: { lote?: number; onProgreso?: (cargados: number, total: number) => void } = {},
): Promise<{ data: T[]; total: number }> {
  const primera = await pedirPagina(1, lote);
  const data: T[] = [...primera.data];
  onProgreso?.(data.length, primera.total);

  // Tope de seguridad por si el servidor devolviera un totalPages absurdo.
  const paginas = Math.min(primera.totalPages, 1000);
  for (let pagina = 2; pagina <= paginas; pagina++) {
    const siguiente = await pedirPagina(pagina, lote);
    data.push(...siguiente.data);
    onProgreso?.(data.length, primera.total);
  }
  return { data, total: primera.total };
}
