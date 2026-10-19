import type { PizzaSabor, SaborGrupo, TamanoPizza } from '../types/models';

export type TamanoVariante = TamanoPizza;

/** Lo mínimo de una variante para saber su tamaño. */
type VarianteConTamano = { nombre?: string | null; tamano?: string | null };

function tamanoDeNombre(nombre?: string | null): TamanoVariante | null {
  const v = (nombre ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (/pequen|personal/.test(v)) return 'pequena';
  if (/median/.test(v)) return 'mediana';
  if (/grande/.test(v)) return 'grande';
  return null;
}

/**
 * Tamaño de una variante: el explícito (`variante.tamano`) o el que dice su nombre. Sin tamaño reconocible
 * → 'grande' (misma regla que el backend para cobrar). Acepta solo el nombre por compatibilidad.
 */
export function tamanoDeVariante(variante?: VarianteConTamano | string | null): TamanoVariante {
  if (typeof variante === 'string') return tamanoDeNombre(variante) ?? 'grande';
  // El cast evita depender del estrechamiento de tipos (RiderApp compila con otra versión de TS).
  const v = variante as VarianteConTamano | null | undefined;
  const explicito = v?.tamano;
  if (explicito === 'pequena' || explicito === 'mediana' || explicito === 'grande') return explicito;
  return tamanoDeNombre(v?.nombre) ?? 'grande';
}

type ClaveTamano = 'Pequena' | 'Mediana' | 'Grande';

/** Columna de recargo que aplica: un grupo sin tamaños usa siempre la "grande". */
function claveTamano(grupo: Pick<SaborGrupo, 'usaTamano'> | null | undefined, variante?: VarianteConTamano | string | null): ClaveTamano {
  if (!grupo?.usaTamano) return 'Grande';
  const t = tamanoDeVariante(variante);
  return t === 'pequena' ? 'Pequena' : t === 'mediana' ? 'Mediana' : 'Grande';
}

/** Recargo de un sabor para la variante (0 = no cobra). Con grupo sin tamaños siempre cuenta la columna "grande". */
export function getRecargoSabor(
  sabor: Pick<PizzaSabor, 'recargoPequena' | 'recargoMediana' | 'recargoGrande'>,
  variante?: VarianteConTamano | string | null,
  grupo?: Pick<SaborGrupo, 'usaTamano'> | null,
): number {
  // Sin grupo informado (undefined) se asume un producto con tamaños.
  const clave = claveTamano(grupo === undefined ? { usaTamano: true } : grupo, variante);
  return Number(sabor[`recargo${clave}` as 'recargoGrande']) || 0;
}

/** Recargo por pedir varios sabores (pizza: desde 3). */
export function getRecargoPorCantidad(
  grupo: SaborGrupo | null | undefined,
  cantidad: number,
  variante?: VarianteConTamano | string | null,
): number {
  if (!grupo || grupo.recargoExtraDesde == null || cantidad < grupo.recargoExtraDesde) return 0;
  return Number(grupo[`recargoExtra${claveTamano(grupo, variante)}` as 'recargoExtraGrande']) || 0;
}

/**
 * Recargo de una unidad con sabores. Espejo de `calcularRecargoSabores` del backend (`ordenes/utils`):
 * el mayor recargo entre los sabores pedidos (no se suman) + el extra por cantidad del grupo.
 */
export function calcularRecargoSabores(
  grupo: SaborGrupo | null | undefined,
  saboresCatalogo: PizzaSabor[],
  nombresElegidos: string[],
  variante?: VarianteConTamano | string | null,
): { porSabor: number; porCantidad: number; total: number } {
  if (!grupo) return { porSabor: 0, porCantidad: 0, total: 0 };
  const porSabor = nombresElegidos.reduce((max, nombre) => {
    const sabor = saboresCatalogo.find((s) => s.grupoId === grupo.id && s.nombre === nombre);
    return sabor ? Math.max(max, getRecargoSabor(sabor, variante, grupo)) : max;
  }, 0);
  const porCantidad = getRecargoPorCantidad(grupo, nombresElegidos.length, variante);
  return { porSabor, porCantidad, total: porSabor + porCantidad };
}
