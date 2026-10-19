import { useCallback, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { useApi } from '@/src/shared';
import type { ActualizarItemInventarioDto, CrearItemInventarioDto, InventarioItem, InventarioRegla } from '@/src/shared';
import { useConsulta } from './use-consulta';

function mensaje(error: unknown, porDefecto: string): string {
  if (isAxiosError(error)) {
    const msg = error.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg) && msg.length) return String(msg[0]);
  }
  return porDefecto;
}

/** Estado y acciones de la pantalla de inventario (ítems, migración, sugerencias). */
export function useInventario() {
  const api = useApi();
  const [version, setVersion] = useState(0);
  const [verInactivos, setVerInactivos] = useState(false);
  const [lista, setLista] = useState<InventarioItem[]>([]);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [error, setError] = useState('');

  const estado = useConsulta(() => api.inventario.estado(), [api, version]);
  const listo = estado.data?.listo ?? false;
  const items = useConsulta(
    () => (listo ? api.inventario.items({ inactivos: verInactivos }) : Promise.resolve([] as InventarioItem[])),
    [api, listo, verInactivos, version],
  );
  const sugerencias = useConsulta(() => (listo ? api.inventario.sugerencias() : Promise.resolve([])), [api, listo, version]);
  const reglas = useConsulta(
    () => (listo ? api.inventario.reglas() : Promise.resolve([] as InventarioRegla[])),
    [api, listo, version],
  );

  useEffect(() => {
    if (items.data) setLista(items.data);
  }, [items.data]);

  const reemplazar = useCallback(
    (nuevo: InventarioItem) =>
      setLista((prev) =>
        !nuevo.activo && !verInactivos ? prev.filter((i) => i.id !== nuevo.id) : prev.map((i) => (i.id === nuevo.id ? nuevo : i)),
      ),
    [verInactivos],
  );

  const mover = useCallback(
    async (item: InventarioItem, delta: number) => {
      if (!delta) return;
      setOcupado(item.id);
      try {
        reemplazar(await api.inventario.mover(item.id, { tipo: delta > 0 ? 'entrada' : 'salida', cantidad: Math.abs(delta) }));
        setError('');
      } catch (e) {
        setError(mensaje(e, 'No se pudo registrar el movimiento.'));
      } finally {
        setOcupado(null);
      }
    },
    [api, reemplazar],
  );

  const contar = useCallback(
    async (item: InventarioItem, contado: number) => {
      setOcupado(item.id);
      try {
        reemplazar(await api.inventario.mover(item.id, { tipo: 'conteo', cantidad: contado, nota: 'Conteo físico' }));
        setError('');
      } catch (e) {
        setError(mensaje(e, 'No se pudo registrar el conteo.'));
      } finally {
        setOcupado(null);
      }
    },
    [api, reemplazar],
  );

  const guardar = useCallback(
    async (item: InventarioItem, dto: ActualizarItemInventarioDto) => {
      try {
        reemplazar(await api.inventario.actualizarItem(item.id, dto));
        setError('');
        return true;
      } catch (e) {
        setError(mensaje(e, 'No se pudo guardar.'));
        return false;
      }
    },
    [api, reemplazar],
  );

  const crear = useCallback(
    async (dto: CrearItemInventarioDto) => {
      try {
        await api.inventario.crearItem(dto);
        setError('');
        setVersion((v) => v + 1);
        return true;
      } catch (e) {
        setError(mensaje(e, 'No se pudo crear.'));
        return false;
      }
    },
    [api],
  );

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  const cajas = useMemo(() => lista.filter((i) => i.tipo === 'caja'), [lista]);
  const bebidas = useMemo(() => lista.filter((i) => i.tipo === 'bebida'), [lista]);
  /** Variantes que ya descuentan alguna bebida: no se ofrecen al crear otra. */
  const variantesConBebida = useMemo(
    () => new Set((reglas.data ?? []).filter((r) => r.itemTipo === 'bebida').map((r) => r.varianteId)),
    [reglas.data],
  );

  return {
    version,
    recargar,
    listo,
    cargandoEstado: estado.loading,
    loading: items.loading || estado.loading,
    refreshing: items.refreshing,
    errorCarga: items.error ?? estado.error,
    error,
    setError,
    cajas,
    bebidas,
    sugerencias: sugerencias.data ?? [],
    reglas: reglas.data ?? [],
    errorReglas: reglas.error,
    variantesConBebida,
    verInactivos,
    setVerInactivos,
    ocupado,
    mover,
    contar,
    guardar,
    crear,
  };
}
