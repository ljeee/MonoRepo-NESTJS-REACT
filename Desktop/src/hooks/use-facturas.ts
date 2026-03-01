import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { api } from '../services/api';
import type { FacturaVenta, FacturaStats } from '../types/models';

// Re-export for backward compat
export type Factura = FacturaVenta;
export type DayStats = FacturaStats;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const apiMessage = error.response?.data?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage;
    }
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

// ─── Map raw API response ─────────────────────────────────────────────────────

function mapFactura(rawFactura: unknown): FacturaVenta {
  const factura = asRecord(rawFactura);
  const rawOrdenes = asArray(factura.ordenes);
  const rawDomicilios = asArray(factura.domicilios);

  return {
    facturaId: typeof factura.facturaId === 'number' ? factura.facturaId : undefined,
    clienteNombre: typeof factura.clienteNombre === 'string' ? factura.clienteNombre : undefined,
    fechaFactura: typeof factura.fechaFactura === 'string' ? factura.fechaFactura : undefined,
    total: numberOrZero(factura.total),
    descripcion: typeof factura.descripcion === 'string' ? factura.descripcion : undefined,
    estado: typeof factura.estado === 'string' ? factura.estado : undefined,
    metodo: typeof factura.metodo === 'string' ? factura.metodo : undefined,
    ordenes: rawOrdenes.map((rawOrden) => {
      const orden = asRecord(rawOrden);
      const rawProductos = asArray(orden.productos);

      return {
        ordenId: typeof orden.ordenId === 'number' ? orden.ordenId : undefined,
        productos: rawProductos.map((rawProducto) => {
          const producto = asRecord(rawProducto);
          const productoRaw = producto.producto;
          const productoObj = asRecord(productoRaw);

          return {
            cantidad: numberOrZero(producto.cantidad),
            precioUnitario: numberOrZero(producto.precioUnitario),
            subtotal: numberOrZero(producto.subtotal),
            productoNombre:
              typeof productoRaw === 'string'
                ? productoRaw
                : (typeof productoObj.nombre === 'string' ? productoObj.nombre : 'Producto'),
          };
        }),
      };
    }),
    domicilios: rawDomicilios.map((rawDomicilio) => {
      const domicilio = asRecord(rawDomicilio);
      return {
        costoDomicilio: numberOrZero(domicilio.costoDomicilio),
        direccionEntrega: typeof domicilio.direccionEntrega === 'string' ? domicilio.direccionEntrega : undefined,
      };
    }),
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
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al cargar facturas del día'));
    } finally {
      setLoading(false);
    }
  }, []);

  const updateEstado = useCallback(async (facturaId: number, nuevoEstado: string) => {
    try {
      await api.facturas.updateEstado(facturaId, nuevoEstado);
      await fetchData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al actualizar factura'));
    }
  }, [fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateFactura = useCallback(async (facturaId: number, data: Partial<FacturaVenta>) => {
    try {
      await api.facturas.update(facturaId, data);
      await fetchData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al actualizar factura'));
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

  const fetchData = useCallback(async (f?: string, t?: string) => {
    const finalFrom = f || from;
    const finalTo = t || to;
    if (!finalFrom || !finalTo) return;
    
    setLoading(true);
    setError(null);
    try {
      const raw = await api.facturas.getAll({ from: finalFrom, to: finalTo });
      const mapped = raw.map(mapFactura);
      setData(mapped);
      setStats(calcStats(mapped));
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al cargar facturas'));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const updateEstado = useCallback(async (facturaId: number, nuevoEstado: string) => {
    try {
      await api.facturas.updateEstado(facturaId, nuevoEstado);
      await fetchData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al actualizar factura'));
    }
  }, [fetchData]);

  const updateFactura = useCallback(async (facturaId: number, data: Partial<FacturaVenta>) => {
    try {
      await api.facturas.update(facturaId, data);
      await fetchData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al actualizar factura'));
    }
  }, [fetchData]);

  return { data, loading, error, from, to, setFrom, setTo, fetchData, stats, updateEstado, updateFactura };
}
