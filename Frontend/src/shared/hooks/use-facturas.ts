import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useApi } from '../contexts/ApiContext';
import type { FacturaVenta, FacturaStats } from '../types/models';

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

export function mapFactura(rawFactura: unknown): FacturaVenta {
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
    pagoEfectivo: typeof factura.pagoEfectivo === 'number' || typeof factura.pagoEfectivo === 'string' ? numberOrZero(factura.pagoEfectivo) : undefined,
    pagoTransferencia: typeof factura.pagoTransferencia === 'number' || typeof factura.pagoTransferencia === 'string' ? numberOrZero(factura.pagoTransferencia) : undefined,
    ordenes: rawOrdenes.map((rawOrden) => {
      const orden = asRecord(rawOrden);
      const rawProductos = asArray(orden.productos);

      return {
        ordenId: typeof orden.ordenId === 'number' ? orden.ordenId : undefined,
        tipoPedido: typeof orden.tipoPedido === 'string' ? orden.tipoPedido : undefined,
        productos: rawProductos.map((rawProducto) => {
          const producto = asRecord(rawProducto);
          const productoRaw = producto.producto;
          const productoObj = asRecord(productoRaw);

          const cantidad = numberOrZero(producto.cantidad) || 1;
          let subtotal = numberOrZero(producto.subtotal);
          let precioUnitario = numberOrZero(producto.precioUnitario);

          // Fallback: calculate from subtotal if precioUnitario is missing
          if (precioUnitario === 0 && subtotal > 0) {
            precioUnitario = subtotal / cantidad;
          }

          // Also check nested variante.precio
          if (precioUnitario === 0) {
            const variante = asRecord(producto.variante);
            const variantePrecio = numberOrZero(variante.precio);
            if (variantePrecio > 0) precioUnitario = variantePrecio;
          }

          // Important: if subtotal is 0 but we have precioUnitario, calculate it
          if (subtotal === 0 && precioUnitario > 0) {
            subtotal = precioUnitario * cantidad;
          }

          return {
            cantidad,
            precioUnitario,
            subtotal,
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

export function calcStats(list: FacturaVenta[]): FacturaStats {
  const total = list.reduce((s, f) => s + (Number(f.total) || 0), 0);
  const pagado = list.filter((f) => f.estado === 'pagado' || f.estado === 'pagada').reduce((s, f) => s + (Number(f.total) || 0), 0);
  return { totalDia: total, totalPagado: pagado, totalPendiente: total - pagado, count: list.length };
}

// ─── Facturas del Día ─────────────────────────────────────────────────────────

export function useFacturasDia() {
  const api = useApi();
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
      setLoading(false);
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al cargar facturas del día'));
      setLoading(false);
    }
  }, [api]);

  const updateEstado = useCallback(async (facturaId: number, nuevoEstado: string) => {
    try {
      await api.facturas.updateEstado(facturaId, nuevoEstado);
      await fetchData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al actualizar factura'));
    }
  }, [api, fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateFactura = useCallback(async (facturaId: number, data: Partial<FacturaVenta>) => {
    try {
      await api.facturas.update(facturaId, data);
      await fetchData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al actualizar factura'));
    }
  }, [api, fetchData]);

  return { data, loading, error, refetch: fetchData, stats, updateEstado, updateFactura };
}

// ─── Facturas por Rango ───────────────────────────────────────────────────────
// NOTE: limit is a primitive number (not an object) to keep it stable across
// renders and prevent infinite re-render loops caused by object reference
// instability in useCallback/useEffect dependency arrays.

export function useFacturasRango(limit: number = 50) {
  const api = useApi();
  const [data, setData] = useState<FacturaVenta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<FacturaStats>({ totalDia: 0, totalPagado: 0, totalPendiente: 0, count: 0 });

  const [estado, setEstado] = useState<string | undefined>(undefined);
  const [clienteNombre, setClienteNombre] = useState<string | undefined>(undefined);

  const fromRef = useRef(from);
  const toRef = useRef(to);
  const pageRef = useRef(page);
  const estadoRef = useRef(estado);
  const clienteNombreRef = useRef(clienteNombre);

  useEffect(() => { fromRef.current = from; }, [from]);
  useEffect(() => { toRef.current = to; }, [to]);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { estadoRef.current = estado; }, [estado]);
  useEffect(() => { clienteNombreRef.current = clienteNombre; }, [clienteNombre]);

  const fetchData = useCallback(async (f?: string, t?: string, p?: number, est?: string, cli?: string) => {
    const finalFrom = f ?? fromRef.current;
    const finalTo = t ?? toRef.current;
    const finalPage = p ?? pageRef.current;
    const finalEstado = est !== undefined ? est : estadoRef.current;
    const finalClienteNombre = cli !== undefined ? cli : clienteNombreRef.current;
    if (!finalFrom || !finalTo) return;

    setLoading(true);
    setError(null);
    try {
      const response = await api.facturas.getAll({
        from: finalFrom,
        to: finalTo,
        page: finalPage,
        limit,
        estado: finalEstado || undefined,
        clienteNombre: finalClienteNombre || undefined,
      });
      const mapped = response.data.map(mapFactura);
      setData(mapped);
      setTotalPages(response.totalPages);
      setTotalCount(response.total);
      setPage(response.page);
      setStats(calcStats(mapped));
      setLoading(false);
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al cargar facturas'));
      setLoading(false);
    }
  }, [api, limit]);

  const updateEstado = useCallback(async (facturaId: number, nuevoEstado: string) => {
    try {
      await api.facturas.updateEstado(facturaId, nuevoEstado);
      await fetchData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al actualizar factura'));
    }
  }, [api, fetchData]);

  const updateFactura = useCallback(async (facturaId: number, data: Partial<FacturaVenta>) => {
    try {
      await api.facturas.update(facturaId, data);
      await fetchData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al actualizar factura'));
    }
  }, [api, fetchData]);

  const deleteFactura = useCallback(async (facturaId: number): Promise<boolean> => {
    try {
      await api.facturas.delete(facturaId);
      await fetchData();
      return true;
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al eliminar factura'));
      return false;
    }
  }, [api, fetchData]);

  const goToPage = useCallback((p: number) => {
    setPage(p);
    pageRef.current = p;
    fetchData(undefined, undefined, p);
  }, [fetchData]);

  // Reset page to 1 when doing a brand-new search
  const search = useCallback((f: string, t: string, est?: string, cli?: string) => {
    setPage(1);
    pageRef.current = 1;
    if (est !== undefined) {
      setEstado(est);
      estadoRef.current = est;
    }
    if (cli !== undefined) {
      setClienteNombre(cli);
      clienteNombreRef.current = cli;
    }
    fetchData(f, t, 1, est, cli);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    from,
    to,
    setFrom,
    setTo,
    estado,
    setEstado,
    clienteNombre,
    setClienteNombre,
    fetchData,
    search,
    stats,
    updateEstado,
    updateFactura,
    deleteFactura,
    page,
    totalPages,
    total: totalCount,
    goToPage,
    limit,
  };
}
