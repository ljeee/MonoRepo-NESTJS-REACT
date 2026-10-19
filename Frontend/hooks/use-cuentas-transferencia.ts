import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '@/src/shared';
import type { Api, CuentaTransferencia } from '@/src/shared';

/**
 * Cuentas de transferencia (Nequi, Bancolombia…) con caché compartida. Antes siete
 * pantallas/modales las pedían por separado, cada vez que se abrían.
 */
const TTL_MS = 60_000;
let cache: { cuentas: CuentaTransferencia[]; en: number } | null = null;
let enCurso: Promise<CuentaTransferencia[]> | null = null;

/** Llamar tras crear/editar/borrar cuentas (ajustes del negocio). */
export function invalidarCuentasTransferencia() {
  cache = null;
}

/** Todas las cuentas (activas e inactivas), desde la caché si está fresca. */
export async function obtenerCuentasTransferencia(api: Api, forzar = false): Promise<CuentaTransferencia[]> {
  if (!forzar && cache && Date.now() - cache.en < TTL_MS) return cache.cuentas;
  if (!enCurso) {
    enCurso = api.empresa.cuentasTransferencia
      .getAll()
      .then((cuentas) => {
        cache = { cuentas: cuentas ?? [], en: Date.now() };
        return cache.cuentas;
      })
      .finally(() => {
        enCurso = null;
      });
  }
  return enCurso;
}

/** Cuentas ACTIVAS por defecto (lo que se ofrece al cobrar o filtrar). */
export function useCuentasTransferencia({ incluirInactivas = false }: { incluirInactivas?: boolean } = {}) {
  const api = useApi();
  const [todas, setTodas] = useState<CuentaTransferencia[]>(() => cache?.cuentas ?? []);
  const [cargando, setCargando] = useState(!cache);

  const recargar = useCallback(
    async (forzar = false) => {
      setCargando(true);
      try {
        const cuentas = await obtenerCuentasTransferencia(api, forzar);
        setTodas(cuentas);
        return cuentas;
      } catch {
        return [] as CuentaTransferencia[];
      } finally {
        setCargando(false);
      }
    },
    [api],
  );

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const cuentas = useMemo(() => (incluirInactivas ? todas : todas.filter((c) => c.activa)), [todas, incluirInactivas]);
  return { cuentas, cargando, recargar };
}
