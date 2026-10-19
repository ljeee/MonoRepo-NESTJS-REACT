import { useCallback, useMemo, useState } from 'react';
import { SIN_LIMITE, useFacturasRango, validateFlexibleDateRange } from '@/src/shared';
import type { MethodFilterValue } from '../components/ui';
import { conteosPorMetodo, useResumenGeneral } from './use-resumen-general';
import { useFacturaActions } from './use-factura-actions';
import { useDebouncedValue } from './use-debounced-value';

/** Sin tildes ni mayúsculas: «José» encuentra a «jose». */
const normalizarNombre = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export interface OpcionesFacturasRango {
  /**
   * Solo las ventas con dinero cobrado por QR/transferencia (qr-transferencias): mixtas y abonos QR
   * incluidos, igual que el desglose por cuenta del resumen. Se ignoran los chips de método.
   */
  soloTransferencias?: boolean;
  /**
   * Búsquedas extra al buscar/refrescar (p. ej. los gastos en balance-fechas). Al deslizar para recargar llega
   * `{ forzar: true }`: pásalo a la búsqueda para saltarse su cooldown.
   */
  alBuscar?: (from: string, to: string, opciones?: { forzar?: boolean }) => void | Promise<unknown>;
}

/** Cuenta de transferencia elegida; -1 = facturas sin cuenta asignada. */
export type CuentaFiltro = number | undefined;

/**
 * Estado y acciones de las pantallas de facturas por rango (balance-fechas,
 * facturación neta, QR/transferencias). Antes cada una copiaba ~150 líneas de
 * handlers. Los totales vienen de `useResumenGeneral` (rango completo, servidor),
 * nunca de sumar la página visible.
 */
export function useFacturasRangoScreen({ soloTransferencias = false, alBuscar }: OpcionesFacturasRango = {}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchedFrom, setSearchedFrom] = useState('');
  const [searchedTo, setSearchedTo] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [metodoFilter, setMetodoFilter] = useState<MethodFilterValue>('todos');
  const [nombreFilter, setNombreFilter] = useState('');
  const [cuentaId, setCuentaId] = useState<CuentaFiltro>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [versionResumen, setVersionResumen] = useState(0);

  // Sin tope: el servidor devuelve TODO el rango. Si la pantalla reparte lo que dibuja en páginas
  // (`usePaginaLocal`), lo hace sobre este conjunto completo.
  const rango = useFacturasRango(SIN_LIMITE, { conTransferencia: soloTransferencias });
  const { search: searchF, updateEstado, updateFactura, deleteFactura, fetchData: fetchFacturas, setFrom: setFromF, setTo: setToF } = rango;
  const { data: resumen } = useResumenGeneral(searchedFrom, searchedTo, versionResumen);
  const recargarResumen = useCallback(() => setVersionResumen((v) => v + 1), []);

  /** estado/metodo para el API a partir del chip (o del método fijo de la pantalla). */
  const filtrosApi = useCallback(
    (clave: MethodFilterValue) => {
      if (soloTransferencias) return { est: undefined, met: undefined };
      if (clave === 'pendiente') return { est: 'pendiente', met: undefined };
      // Sin forzar estado='pagado': una factura pendiente puede tener método asignado.
      return { est: undefined, met: clave === 'todos' ? undefined : clave };
    },
    [soloTransferencias],
  );

  // El nombre NO va al servidor: se filtra abajo sobre el rango ya cargado (escribir no pide nada).
  const buscarCon = useCallback(
    (f: string, t: string, clave: MethodFilterValue, cuenta: CuentaFiltro) => {
      const { est, met } = filtrosApi(clave);
      return searchF(f, t, est, undefined, met, cuenta);
    },
    [filtrosApi, searchF],
  );

  const handleSearch = useCallback(
    (fromInput: string = from, toInput: string = to) => {
      const { from: fp, to: tp, error } = validateFlexibleDateRange(fromInput, toInput);
      if (error) return;
      setFrom(fromInput);
      setTo(toInput);
      setSearchedFrom(fp);
      setSearchedTo(tp);
      setFromF(fp);
      setToF(tp);
      void buscarCon(fp, tp, metodoFilter, cuentaId);
      void alBuscar?.(fp, tp);
      setHasSearched(true);
    },
    [from, to, setFromF, setToF, buscarCon, metodoFilter, cuentaId, alBuscar],
  );

  const handleRefresh = useCallback(async () => {
    if (!hasSearched) return;
    setRefreshing(true);
    try {
      recargarResumen();
      // Recarga forzada (se salta el cooldown de la búsqueda repetida, con un mínimo de 5 s).
      await Promise.all([rango.recargar(), alBuscar?.(searchedFrom, searchedTo, { forzar: true })]);
    } catch {
      /* el error queda en el hook de datos */
    }
    setRefreshing(false);
  }, [hasSearched, recargarResumen, rango, searchedFrom, searchedTo, alBuscar]);

  const handleSelectMetodo = useCallback(
    (clave: MethodFilterValue) => {
      setMetodoFilter(clave);
      if (hasSearched) void buscarCon(searchedFrom, searchedTo, clave, cuentaId);
    },
    [hasSearched, buscarCon, searchedFrom, searchedTo, cuentaId],
  );

  const handleSelectCuenta = useCallback(
    (cuenta: CuentaFiltro) => {
      setCuentaId(cuenta);
      if (hasSearched) void buscarCon(searchedFrom, searchedTo, metodoFilter, cuenta);
    },
    [hasSearched, buscarCon, searchedFrom, searchedTo, metodoFilter],
  );

  // Antes, además de la búsqueda directa, un efecto con espera volvía a lanzar la MISMA consulta 400 ms
  // después (cambiaban searchedFrom/metodo/cuenta): cada búsqueda descargaba el rango dos veces. Ahora hay un
  // solo camino, y el nombre se filtra en memoria sobre el rango completo.
  const nombreBuscado = normalizarNombre(useDebouncedValue(nombreFilter, 150));
  const facturasVisibles = useMemo(
    () => (nombreBuscado ? rango.data.filter((f) => normalizarNombre(f.clienteNombre ?? '').includes(nombreBuscado)) : rango.data),
    [rango.data, nombreBuscado],
  );

  // ── Acciones de FacturaCard (todas refrescan el resumen) ──
  const { updatingId, accionesFactura, onUpdate } = useFacturaActions({
    updateEstado,
    updateFactura,
    deleteFactura,
    recargar: fetchFacturas,
    alCambiar: recargarResumen,
  });

  return {
    // fechas
    from,
    setFrom,
    to,
    setTo,
    searchedFrom,
    searchedTo,
    hasSearched,
    // filtros
    metodoFilter,
    nombreFilter,
    setNombreFilter,
    cuentaId,
    filtrosApi,
    // datos
    /** TODAS las facturas del rango que coinciden con el nombre buscado (para mostrar, exportar o sumar). */
    facturas: facturasVisibles,
    loadingFacturas: rango.loading,
    errorFacturas: rango.error,
    total: facturasVisibles.length,
    /** Avance de la carga por tandas ("Cargando 1.500 de 4.000…"). */
    progreso: rango.progreso,
    /** Cuándo llegaron los datos y si salieron del cooldown (búsqueda repetida, sin petición). */
    actualizadoEn: rango.actualizadoEn,
    desdeCache: rango.desdeCache,
    /** Texto corto para la barra de resultados cuando la búsqueda repetida salió del cooldown ('' si no). */
    notaCooldown:
      rango.desdeCache && rango.actualizadoEn
        ? `misma búsqueda: datos de hace ${Math.max(1, Math.round((Date.now() - rango.actualizadoEn) / 1000))} s · desliza para recargar`
        : '',
    resumen,
    metodoCounts: conteosPorMetodo(resumen),
    recargarResumen,
    // acciones
    handleSearch,
    handleRefresh,
    handleSelectMetodo,
    handleSelectCuenta,
    refreshing,
    updatingId,
    accionesFactura,
    onUpdate,
  };
}
