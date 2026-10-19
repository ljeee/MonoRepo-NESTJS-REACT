/**
 * Cooldown de búsquedas: repetir la MISMA búsqueda (mismo endpoint y mismos filtros) dentro de
 * `COOLDOWN_BUSQUEDA_MS` no vuelve a pedirla al servidor, y dos pedidos idénticos simultáneos
 * comparten una sola petición. Reemplaza al viejo tope de 50 registros: los rangos se traen
 * COMPLETOS (por tandas), lo que se limita es cuántas veces se descarga lo mismo.
 *
 * - Cualquier escritura (POST/PATCH/PUT/DELETE por el cliente http compartido) invalida todo:
 *   después de cobrar, editar o borrar, la siguiente búsqueda siempre trae datos frescos.
 * - `forzar` (deslizar para recargar, botón recargar) se salta el cooldown, pero no más de una
 *   vez cada `MINIMO_RECARGA_MS` por búsqueda.
 * - TS puro (sin React ni RN): lo usan el POS y RiderApp, y se prueba desde el Jest del backend.
 */

/** Cuánto tiempo vale el resultado de una búsqueda antes de volver a pedirla. */
export const COOLDOWN_BUSQUEDA_MS = 30_000;
/** Mínimo entre recargas forzadas de la misma búsqueda. */
export const MINIMO_RECARGA_MS = 5_000;
/** Búsquedas guardadas como máximo (se descartan las más viejas: un mes de facturas pesa). */
const MAXIMO_ENTRADAS = 12;

export interface ResultadoConsulta<T> {
  valor: T;
  /** Instante (ms) en que el servidor devolvió este resultado. */
  obtenidoEn: number;
  /** true = no hubo petición: salió del cooldown. */
  desdeCache: boolean;
}

interface Entrada {
  valor?: unknown;
  obtenidoEn?: number;
  forzadaEn?: number;
  enCurso?: Promise<ResultadoConsulta<unknown>>;
}

const entradas = new Map<string, Entrada>();

function normalizar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(normalizar);
  if (valor && typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const clave of Object.keys(valor as Record<string, unknown>).sort()) {
      const v = (valor as Record<string, unknown>)[clave];
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
      salida[clave] = normalizar(v);
    }
    return salida;
  }
  return valor;
}

/** Clave estable de una búsqueda: el orden de los filtros y los vacíos no cuentan. */
export function claveConsulta(nombre: string, params?: unknown): string {
  return `${nombre}:${JSON.stringify(normalizar(params ?? {}))}`;
}

function recortar() {
  if (entradas.size <= MAXIMO_ENTRADAS) return;
  const viejas = [...entradas.entries()]
    .filter(([, e]) => !e.enCurso)
    .sort((a, b) => (a[1].obtenidoEn ?? 0) - (b[1].obtenidoEn ?? 0));
  for (const [clave] of viejas.slice(0, entradas.size - MAXIMO_ENTRADAS)) entradas.delete(clave);
}

/**
 * Hace la búsqueda solo si hace falta: si hay una idéntica en curso devuelve esa misma promesa, y si
 * se completó hace menos de `cooldownMs` devuelve el resultado guardado sin pedir nada.
 */
export function consultarConCooldown<T>(
  clave: string,
  pedir: () => Promise<T>,
  { cooldownMs = COOLDOWN_BUSQUEDA_MS, forzar = false }: { cooldownMs?: number; forzar?: boolean } = {},
): Promise<ResultadoConsulta<T>> {
  const ahora = Date.now();
  const previa = entradas.get(clave);
  if (previa?.enCurso) return previa.enCurso as Promise<ResultadoConsulta<T>>;

  const tieneValor = previa?.obtenidoEn != null && 'valor' in previa;
  if (tieneValor && previa) {
    const vigente = ahora - (previa.obtenidoEn as number) < cooldownMs;
    const recargaMuySeguida = previa.forzadaEn != null && ahora - previa.forzadaEn < MINIMO_RECARGA_MS;
    if ((!forzar && vigente) || (forzar && recargaMuySeguida)) {
      return Promise.resolve({ valor: previa.valor as T, obtenidoEn: previa.obtenidoEn as number, desdeCache: true });
    }
  }

  const enCurso: Promise<ResultadoConsulta<T>> = pedir().then(
    (valor) => {
      const obtenidoEn = Date.now();
      // Solo se guarda si nadie invalidó mientras volaba (el resultado podría ser de antes de un cambio).
      if (entradas.get(clave)?.enCurso === enCurso) {
        entradas.set(clave, { valor, obtenidoEn, forzadaEn: forzar ? obtenidoEn : previa?.forzadaEn });
        recortar();
      }
      return { valor, obtenidoEn, desdeCache: false };
    },
    (error: unknown) => {
      // Un error no se guarda: se conserva lo anterior (si había) y el próximo intento vuelve a pedir.
      if (entradas.get(clave)?.enCurso === enCurso) {
        if (tieneValor && previa) entradas.set(clave, { valor: previa.valor, obtenidoEn: previa.obtenidoEn, forzadaEn: previa.forzadaEn });
        else entradas.delete(clave);
      }
      throw error;
    },
  );
  entradas.set(clave, { ...(previa ?? {}), enCurso: enCurso as Promise<ResultadoConsulta<unknown>> });
  return enCurso;
}

/** Olvida las búsquedas guardadas (todas, o las que empiezan por `prefijo`), incluidas las que van en camino. */
export function invalidarConsultas(prefijo?: string): void {
  for (const clave of [...entradas.keys()]) {
    if (!prefijo || clave.startsWith(prefijo)) entradas.delete(clave);
  }
}
