import { DENOMINACIONES_COP, type DenominacionesMap } from '../types/models';

/** Billetes COP de mayor a menor (misma lista que DENOMINACIONES_COP). */
export const BILLETES_COP: number[] = DENOMINACIONES_COP.map((d) => d.valor);

/**
 * Total en pesos de un conteo de caja: Σ billete × cantidad + monedas. La clave `'coins'`
 * (la que usa el backend para las monedas sueltas) vale su cantidad en pesos, no se multiplica.
 * `monedas` suma aparte lo escrito en el campo de monedas del formulario.
 */
export function sumDenominaciones(map: DenominacionesMap | null | undefined, monedas: number | string = 0): number {
  let total = Number(monedas) || 0;
  for (const [clave, valor] of Object.entries(map ?? {})) {
    const cantidad = Number(valor) || 0;
    total += clave === 'coins' ? cantidad : (Number(clave) || 0) * cantidad;
  }
  return total;
}
