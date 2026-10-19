import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { consultarConCooldown } from '@/src/shared';

export interface EstadoConsulta<T> {
  data: T | undefined;
  /** Primera carga (sin datos previos): mostrar esqueleto/spinner. */
  loading: boolean;
  /** Recarga con datos ya visibles (pull-to-refresh, tiempo real): no ocultar el contenido. */
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
}

function mensajeError(error: unknown): string {
  if (isAxiosError(error)) {
    const msg = error.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg) && msg.length) return String(msg[0]);
    if (error.response?.status === 403) return 'No tienes permiso para ver esta información';
    return error.message;
  }
  return error instanceof Error ? error.message : 'No se pudo cargar la información';
}

export interface OpcionesConsulta {
  /**
   * Clave de la búsqueda (`claveConsulta(endpoint, params)`). Con clave, repetir la MISMA búsqueda dentro del
   * cooldown (30 s) no vuelve a pedirla, y dos pantallas que piden lo mismo comparten la petición. Quien
   * necesite datos frescos (tiempo real, recargar) llama `invalidarConsultas(prefijo)` antes.
   */
  clave?: string;
  cooldownMs?: number;
}

/**
 * Ejecuta `fetcher` cada vez que cambian `deps` y descarta respuestas viejas: si el
 * usuario toca varios filtros seguidos, solo se pinta la última respuesta (antes una
 * respuesta lenta de un rango anterior podía pisar la nueva). `refresh()` se salta el cooldown.
 */
export function useConsulta<T>(fetcher: () => Promise<T>, deps: DependencyList, { clave, cooldownMs }: OpcionesConsulta = {}): EstadoConsulta<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(0);
  const tieneDatosRef = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ejecutar = useCallback(fetcher, deps);

  const correr = useCallback(
    async (modo: 'carga' | 'refresco') => {
      const id = ++idRef.current;
      if (modo === 'carga' && !tieneDatosRef.current) setLoading(true);
      else setRefreshing(true);
      try {
        const resultado = clave
          ? (await consultarConCooldown(clave, ejecutar, { cooldownMs, forzar: modo === 'refresco' })).valor
          : await ejecutar();
        if (id !== idRef.current) return;
        setData(resultado);
        tieneDatosRef.current = true;
        setError(null);
      } catch (e) {
        if (id !== idRef.current) return;
        setError(mensajeError(e));
      } finally {
        if (id === idRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [ejecutar, clave, cooldownMs],
  );

  useEffect(() => {
    void correr('carga');
  }, [correr]);

  const refresh = useCallback(() => void correr('refresco'), [correr]);

  return { data, loading, refreshing, error, refresh };
}
