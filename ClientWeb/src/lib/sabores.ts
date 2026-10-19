import type { PizzaSabor, ProductoVariante, SaborGrupo } from './types';

// Espejo reducido de `Frontend/src/shared/utils/sabores.ts` y `Backend/src/ordenes/utils/recargos-sabores.ts`
// (ClientWeb no importa del Frontend). El backend recalcula el precio al crear la orden: esto es solo para
// mostrarle al cliente lo que va a pagar.

type ClaveTamano = 'Pequena' | 'Mediana' | 'Grande';

function tamanoDeNombre(nombre: string): 'pequena' | 'mediana' | 'grande' | null {
  const v = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (/pequen|personal/.test(v)) return 'pequena';
  if (/median/.test(v)) return 'mediana';
  if (/grande/.test(v)) return 'grande';
  return null;
}

/** Columna de recargo que aplica: un grupo sin tamaños usa siempre la "grande". */
function claveTamano(grupo: SaborGrupo, variante: ProductoVariante): ClaveTamano {
  if (!grupo.usaTamano) return 'Grande';
  const t = variante.tamano ?? tamanoDeNombre(variante.nombre);
  return t === 'pequena' ? 'Pequena' : t === 'mediana' ? 'Mediana' : 'Grande';
}

export function recargoDeSabor(sabor: PizzaSabor, grupo: SaborGrupo, variante: ProductoVariante): number {
  return Number(sabor[`recargo${claveTamano(grupo, variante)}`]) || 0;
}

/** Recargo de una unidad: el mayor entre los sabores elegidos + el extra del grupo por pedir varios. */
export function recargoTotal(
  grupo: SaborGrupo,
  sabores: PizzaSabor[],
  elegidos: string[],
  variante: ProductoVariante,
): number {
  const porSabor = elegidos.reduce((max, nombre) => {
    const sabor = sabores.find((s) => s.grupoId === grupo.id && s.nombre === nombre);
    return sabor ? Math.max(max, recargoDeSabor(sabor, grupo, variante)) : max;
  }, 0);
  const desde = grupo.recargoExtraDesde;
  const porCantidad =
    desde != null && elegidos.length >= desde ? Number(grupo[`recargoExtra${claveTamano(grupo, variante)}`]) || 0 : 0;
  return porSabor + porCantidad;
}
