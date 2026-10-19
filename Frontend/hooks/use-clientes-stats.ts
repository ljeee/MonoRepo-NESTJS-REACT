import { useCallback, useMemo } from 'react';
import { useApi, bogotaToday, shiftISO, presetRange, normalizePhone } from '@/src/shared';
import type { ClientesAnalitica, Cliente, PresetRango } from '@/src/shared';
import { useConsulta } from './use-consulta';

export type EstadisticaCliente = ClientesAnalitica['filas'][number];

interface OpcionesClientesStats {
  /** Teléfonos de los clientes que se ven en pantalla (la página actual): sus cifras se piden por separado. */
  telefonos: string[];
  /** Período del podio de mejores clientes. */
  periodoTop?: PresetRango;
  topLimit?: number;
  /**
   * Cualquier valor cuyo cambio debe volver a pedir las cifras (p. ej. un contador que sube al guardar o
   * refrescar). NO pasar la lista de clientes: cambia con cada tanda de la carga progresiva.
   */
  recargarCon?: unknown;
}

/**
 * Estadísticas de clientes desde la analítica (agrupa por TELÉFONO normalizado, "último año" = hasta 366 días):
 *  - cifras de los clientes VISIBLES (`telefonos`), sin depender de un top: antes se pedían los 200 mejores y
 *    del 201 en adelante la tarjeta salía sin estadísticas;
 *  - podio del período elegido;
 *  - totales del último año para el resumen de arriba (del servidor, no sumados de una lista parcial).
 */
export function useClientesStats({ telefonos, periodoTop = 'mes', topLimit = 5, recargarCon }: OpcionesClientesStats) {
  const api = useApi();
  const hoy = bogotaToday();
  const rangoTop = useMemo(() => presetRange(periodoTop, hoy), [periodoTop, hoy]);
  const desdeAnio = useMemo(() => shiftISO(hoy, -365), [hoy]);
  // Clave estable: la misma página con los mismos clientes no vuelve a consultar.
  const clavePagina = useMemo(() => telefonos.map(normalizePhone).filter(Boolean).sort().join(','), [telefonos]);

  const visibles = useConsulta(
    () =>
      clavePagina
        ? api.analitica.clientes({ from: desdeAnio, to: hoy, telefonos: clavePagina.split(',') })
        : Promise.resolve(null),
    [api, desdeAnio, hoy, clavePagina, recargarCon],
  );
  const rankingTop = useConsulta(
    () => api.analitica.clientes({ from: rangoTop.from, to: rangoTop.to, limit: topLimit }),
    [api, rangoTop.from, rangoTop.to, topLimit, recargarCon],
  );
  const anio = useConsulta(() => api.analitica.resumen({ from: desdeAnio, to: hoy }), [api, desdeAnio, hoy, recargarCon]);

  const porTelefono = useMemo(() => {
    const mapa = new Map<string, EstadisticaCliente>();
    for (const f of visibles.data?.filas ?? []) if (f.telefono) mapa.set(normalizePhone(f.telefono), f);
    return mapa;
  }, [visibles.data]);

  const deCliente = useCallback(
    (c: Cliente) => (c.telefono ? porTelefono.get(normalizePhone(c.telefono)) : undefined),
    [porTelefono],
  );

  return {
    mejoresRanking: rankingTop.data?.filas ?? [],
    cargandoTop: rankingTop.loading,
    rangoTop,
    /** Facturado y ticket de TODOS los clientes en el último año. */
    resumenAnio: anio.data?.actual ?? null,
    deCliente,
  };
}
