import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { FacturaVenta, FacturaStats } from '../types/models';

// Re-export for backward compat
export type Factura = FacturaVenta;
export type DayStats = FacturaStats;

// ─── Map raw API response ─────────────────────────────────────────────────────

function mapFactura(f: any): FacturaVenta {
  return {
    facturaId: f.facturaId,
    clienteNombre: f.clienteNombre,
    fechaFactura: f.fechaFactura,
    total: Number(f.total) || 0,
    descripcion: f.descripcion,
    estado: f.estado,
    metodo: f.metodo,
    ordenes: f.ordenes?.map((o: any) => ({
      ordenId: o.ordenId,
      tipoPedido: o.tipoPedido,
      productos: o.productos?.map((op: any) => ({
        cantidad: Number(op.cantidad) || 0,
        precioUnitario: Number(op.precioUnitario) || 0,
        subtotal: Number(op.subtotal) || 0,
        productoNombre: typeof op.producto === 'string'
          ? op.producto
          : (op.producto?.nombre || 'Producto'),
      })),
    })),
    domicilios: f.domicilios?.map((d: any) => ({
      costoDomicilio: Number(d.costoDomicilio) || 0,
      direccionEntrega: d.direccionEntrega,
    })),
  };
}

function calcStats(list: FacturaVenta[]): FacturaStats {
  const total = list.reduce((s, f) => s + (Number(f.total) || 0), 0);
  const pagado = list.filter((f) => f.estado === 'pagado').reduce((s, f) => s + (Number(f.total) || 0), 0);
  return { totalDia: total, totalPagado: pagado, totalPendiente: total - pagado, count: list.length };
}

// ─── Facturas del Día ─────────────────────────────────────────────────────────

export function useFacturasDia() {
  const [data, setData] = useState<FacturaVenta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<FacturaStats>({ totalDia: 0, totalPagado: 0, totalPendiente: 0, count: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await api.facturas.getDay();
      const mapped = raw.map(mapFactura);
      setData(mapped);
      try {
        setStats(await api.facturas.getDayStats());
      } catch {
        setStats(calcStats(mapped));
      }
    } catch (e: any) {
      setError(e?.message || 'Error al cargar facturas del día');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateEstado = useCallback(async (facturaId: number, nuevoEstado: string) => {
    try {
      await api.facturas.updateEstado(facturaId, nuevoEstado);
      await fetchData();
    } catch (e: any) {
      setError(e.message || 'Error al actualizar factura');
    }
  }, [fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateFactura = useCallback(async (facturaId: number, data: Partial<FacturaVenta>) => {
    try {
      await api.facturas.update(facturaId, data);
      await fetchData();
    } catch (e: any) {
      setError(e.message || 'Error al actualizar factura');
    }
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData, stats, updateEstado, updateFactura };
}

// ─── Facturas por Rango ───────────────────────────────────────────────────────

export function useFacturasRango() {
  const [data, setData] = useState<FacturaVenta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [stats, setStats] = useState<FacturaStats>({ totalDia: 0, totalPagado: 0, totalPendiente: 0, count: 0 });

  const fetchData = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await api.facturas.getAll({ from, to });
      const mapped = raw.map(mapFactura);
      setData(mapped);
      setStats(calcStats(mapped));
    } catch (e: any) {
      setError(e.message || 'Error al cargar facturas');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const updateEstado = useCallback(async (facturaId: number, nuevoEstado: string) => {
    try {
      await api.facturas.updateEstado(facturaId, nuevoEstado);
      await fetchData();
    } catch (e: any) {
      setError(e.message || 'Error al actualizar factura');
    }
  }, [fetchData]);

  const updateFactura = useCallback(async (facturaId: number, data: Partial<FacturaVenta>) => {
    try {
      await api.facturas.update(facturaId, data);
      await fetchData();
    } catch (e: any) {
      setError(e.message || 'Error al actualizar factura');
    }
  }, [fetchData]);

  return { data, loading, error, from, to, setFrom, setTo, fetchData, stats, updateEstado, updateFactura };
}
