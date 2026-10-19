import { useCallback, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { bogotaToday, presetRange } from '@/src/shared';
import type { FiltrosAnalitica, PresetRango } from '@/src/shared';

/** Filtros además del rango de fechas (todo lo que va en el panel "Filtros"). */
export type FiltrosExtra = Omit<FiltrosAnalitica, 'from' | 'to' | 'comparar'>;
export type ClaveFiltro = keyof FiltrosExtra;

/** Atajos de la barra de fechas de Analítica (orden = índice del preset activo). */
export const PRESETS_ANALITICA: PresetRango[] = ['hoy', 'ayer', 'semana', '7d', 'mes', 'mesAnterior', '30d', 'anio'];
const PRESET_INICIAL = PRESETS_ANALITICA.indexOf('mes');

const CLAVES_LISTA_TEXTO = ['tipoPedido', 'metodoPago', 'estadoPago', 'canal', 'categoria', 'tamano'] as const;
const CLAVES_LISTA_NUMERO = ['productoId', 'varianteId', 'saborId', 'saborGrupoId', 'diaSemana'] as const;
const CLAVES_TEXTO = ['usuario', 'domiciliario', 'cliente'] as const;
const CLAVES_NUMERO = ['horaDesde', 'horaHasta'] as const;

type Params = Record<string, string | string[] | undefined>;
const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Lee los filtros desde la URL (?tipoPedido=mesa,domicilio&productoId=3…). */
function filtrosDesdeParams(params: Params): FiltrosExtra {
  const f: Record<string, unknown> = {};
  for (const k of CLAVES_LISTA_TEXTO) {
    const v = primero(params[k]);
    if (v) f[k] = v.split(',').filter(Boolean);
  }
  for (const k of CLAVES_LISTA_NUMERO) {
    const v = primero(params[k]);
    if (v) f[k] = v.split(',').map(Number).filter((n) => Number.isInteger(n));
  }
  for (const k of CLAVES_TEXTO) {
    const v = primero(params[k]);
    if (v) f[k] = v;
  }
  for (const k of CLAVES_NUMERO) {
    const v = primero(params[k]);
    if (v !== undefined && v !== '' && Number.isFinite(Number(v))) f[k] = Number(v);
  }
  const pm = primero(params.precioManual);
  if (pm === 'true' || pm === 'false') f.precioManual = pm === 'true';
  return f as FiltrosExtra;
}

function vacio(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

/**
 * Estado de filtros de la pantalla de Analítica, sincronizado con la URL para poder
 * compartir/recargar una vista filtrada (en web; en el APK los params también existen).
 */
export function useAnaliticaFiltros() {
  const params = useLocalSearchParams() as Params;
  const inicial = useMemo(() => {
    const from = primero(params.from);
    const to = primero(params.to);
    const valido = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
    const rango = valido(from) && valido(to) ? { from: from!, to: to! } : presetRange(PRESETS_ANALITICA[PRESET_INICIAL]);
    return {
      ...rango,
      preset: valido(from) && valido(to) ? null : PRESET_INICIAL,
      comparar: primero(params.comparar) === 'true',
      filtros: filtrosDesdeParams(params),
    };
    // Solo al montar: después la URL la escribe este hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [from, setFrom] = useState(inicial.from);
  const [to, setTo] = useState(inicial.to);
  const [preset, setPreset] = useState<number | null>(inicial.preset);
  const [comparar, setCompararState] = useState(inicial.comparar);
  const [filtros, setFiltros] = useState<FiltrosExtra>(inicial.filtros);
  /** Rango confirmado (lo que se consulta); from/to pueden estar a medio escribir. */
  const [rango, setRango] = useState({ from: inicial.from, to: inicial.to });

  const sincronizarUrl = useCallback(
    (r: { from: string; to: string }, c: boolean, f: FiltrosExtra) => {
      const p: Record<string, string> = { from: r.from, to: r.to };
      if (c) p.comparar = 'true';
      for (const [k, v] of Object.entries(f)) {
        if (vacio(v)) continue;
        p[k] = Array.isArray(v) ? v.join(',') : String(v);
      }
      try {
        // Limpia también los filtros quitados (params ausentes = undefined).
        const limpiar: Record<string, undefined> = {};
        for (const k of [...CLAVES_LISTA_TEXTO, ...CLAVES_LISTA_NUMERO, ...CLAVES_TEXTO, ...CLAVES_NUMERO, 'precioManual', 'comparar']) {
          if (!(k in p)) limpiar[k] = undefined;
        }
        router.setParams({ ...limpiar, ...p });
      } catch {
        // Sin router (tests) o pantalla desmontada: la URL es solo una comodidad.
      }
    },
    [],
  );

  const buscar = useCallback(
    (f: string, t: string) => {
      setFrom(f);
      setTo(t);
      // Repetir la MISMA búsqueda no relanza nada: se conserva el objeto del rango (y con él `consulta`),
      // así ninguna pestaña vuelve a pedir lo que ya tiene. Para datos frescos: deslizar para recargar.
      setRango((prev) => (prev.from === f && prev.to === t ? prev : { from: f, to: t }));
      sincronizarUrl({ from: f, to: t }, comparar, filtros);
    },
    [comparar, filtros, sincronizarUrl],
  );

  const setComparar = useCallback(
    (c: boolean) => {
      setCompararState(c);
      sincronizarUrl(rango, c, filtros);
    },
    [rango, filtros, sincronizarUrl],
  );

  const setFiltro = useCallback(
    <K extends ClaveFiltro>(clave: K, valor: FiltrosExtra[K] | undefined) => {
      setFiltros((prev) => {
        const siguiente = { ...prev, [clave]: vacio(valor) ? undefined : valor } as FiltrosExtra;
        sincronizarUrl(rango, comparar, siguiente);
        return siguiente;
      });
    },
    [rango, comparar, sincronizarUrl],
  );

  const reemplazarFiltros = useCallback(
    (nuevos: FiltrosExtra) => {
      setFiltros(nuevos);
      sincronizarUrl(rango, comparar, nuevos);
    },
    [rango, comparar, sincronizarUrl],
  );

  const limpiarFiltros = useCallback(() => reemplazarFiltros({}), [reemplazarFiltros]);

  const consulta: FiltrosAnalitica = useMemo(
    () => ({ ...filtros, from: rango.from, to: rango.to, comparar }),
    [filtros, rango, comparar],
  );

  const cantidadActivos = useMemo(() => Object.values(filtros).filter((v) => !vacio(v)).length, [filtros]);
  const incluyeHoy = rango.to >= bogotaToday() && rango.from <= bogotaToday();

  return {
    from,
    to,
    setFrom,
    setTo,
    preset,
    setPreset,
    comparar,
    setComparar,
    filtros,
    setFiltro,
    reemplazarFiltros,
    limpiarFiltros,
    buscar,
    consulta,
    cantidadActivos,
    incluyeHoy,
  };
}
