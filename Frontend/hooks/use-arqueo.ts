import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@/src/shared';
import type { CajaMovimiento } from '@/src/shared';

/**
 * Interruptor del arqueo (`empresa_config.arqueo_caja`). Lo enciende o apaga SOLO el admin
 * (PATCH /empresa). Apagado: se cobra y se da cambio sin desglosar billetes y el backend no
 * valida las salidas contra el conteo. Encendido: el comportamiento de siempre.
 *
 * Al volver a encenderlo se guarda `arqueoDesde`: un arqueo solo cuenta como hecho si su conteo
 * es POSTERIOR (`aperturaVigente`), así que hay que contar la caja a mano y el conteo pasa a ser
 * lo esperado.
 *
 * Caché compartida y suscripción: el modal de cobro, el balance y el switch ven el mismo valor
 * y un cambio se refleja al instante en todos. Si la configuración no carga, se asume
 * encendido (lo seguro: ante la duda se controla la caja).
 */
interface EstadoArqueo {
  activo: boolean;
  /** ISO del último "apagado → encendido"; null si nunca se apagó. */
  desde: string | null;
}

const TTL_MS = 30_000;
let cache: (EstadoArqueo & { en: number }) | null = null;
const oyentes = new Set<(estado: EstadoArqueo) => void>();

function publicar(estado: EstadoArqueo) {
  cache = { ...estado, en: Date.now() };
  oyentes.forEach((fn) => fn(estado));
}

/**
 * Última apertura (arqueo) del día que sigue vigente: la más reciente y, si el arqueo se volvió a
 * encender, posterior a ese momento. Undefined = hay que contar la caja.
 */
export function aperturaVigente(movimientos: CajaMovimiento[] | undefined | null, desde: string | null): CajaMovimiento | undefined {
  const aperturas = (movimientos ?? []).filter((m) => m.tipo === 'apertura');
  const ultima = aperturas[aperturas.length - 1];
  if (!ultima) return undefined;
  if (desde && new Date(ultima.createdAt).getTime() < new Date(desde).getTime()) return undefined;
  return ultima;
}

export function useArqueoActivo() {
  const api = useApi();
  const [estado, setEstado] = useState<EstadoArqueo>({ activo: cache?.activo ?? true, desde: cache?.desde ?? null });
  const [cargando, setCargando] = useState(!cache);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    oyentes.add(setEstado);
    return () => {
      oyentes.delete(setEstado);
    };
  }, []);

  const recargar = useCallback(
    async (forzar = false) => {
      if (!forzar && cache && Date.now() - cache.en < TTL_MS) return cache.activo;
      setCargando(true);
      try {
        const config = await api.empresa.get();
        publicar({ activo: config?.arqueoCaja ?? true, desde: config?.arqueoDesde ?? null });
      } catch {
        /* se conserva el último valor conocido */
      } finally {
        setCargando(false);
      }
      return cache?.activo ?? true;
    },
    [api],
  );

  useEffect(() => {
    void recargar();
  }, [recargar]);

  /** Cambia el interruptor (el backend solo lo permite al admin). Devuelve si se guardó. */
  const cambiar = useCallback(
    async (valor: boolean) => {
      setGuardando(true);
      try {
        const config = await api.empresa.update({ arqueoCaja: valor });
        publicar({ activo: config?.arqueoCaja ?? valor, desde: config?.arqueoDesde ?? null });
        return true;
      } catch {
        return false;
      } finally {
        setGuardando(false);
      }
    },
    [api],
  );

  return { arqueoActivo: estado.activo, arqueoDesde: estado.desde, cargando, guardando, recargar, cambiar };
}
