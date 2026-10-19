import { useApi } from '@/src/shared';
import type { ResumenGeneral } from '@/src/shared';
import type { MethodFilterValue } from '../components/ui';
import { useConsulta } from './use-consulta';

/**
 * Resumen de dinero del rango (`GET /estadisticas/resumen`) con las definiciones únicas
 * del backend. Es la fuente de TODOS los totales de las pantallas de dinero: antes cada
 * una sumaba a su manera (a veces solo la página visible de 50 facturas).
 * Con `from`/`to` vacíos no consulta.
 */
export function useResumenGeneral(from: string, to: string, version = 0) {
  const api = useApi();
  return useConsulta<ResumenGeneral | null>(
    () => (from && to ? api.analitica.resumenGeneral(from, to) : Promise.resolve(null)),
    [api, from, to, version],
  );
}

/**
 * Conteos de los chips de método (MethodFilterChips) desde el resumen. "Efectivo" y
 * "QR" incluyen las mixtas, igual que el filtro del servidor.
 */
export function conteosPorMetodo(resumen: ResumenGeneral | null | undefined): Partial<Record<MethodFilterValue, number>> {
  if (!resumen) return {};
  const metodo = (clave: string) => resumen.ventas.porMetodo.find((m) => m.clave === clave)?.facturas ?? 0;
  const pendientes = resumen.ventas.porEstado.find((e) => e.clave === 'pendiente')?.facturas ?? 0;
  return {
    todos: resumen.ventas.facturas,
    efectivo: metodo('efectivo') + metodo('mixto'),
    transferencia: metodo('transferencia') + metodo('mixto'),
    mixto: metodo('mixto'),
    pendiente: pendientes,
  };
}
