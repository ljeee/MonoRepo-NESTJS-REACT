import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../constants/api';

export interface Factura {
  facturaId?: number;
  clienteNombre?: string;
  fechaFactura?: string;
  total?: number;
  descripcion?: string;
  estado?: string;
  metodo?: string;
}

export function useFacturasDia() {
  const [data, setData] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Endpoint correcto en backend: /facturas-ventas/dia
      const direct = await axios.get(`${API_BASE_URL}/facturas-ventas/dia`);
      const arr = Array.isArray(direct.data) ? direct.data : [];
      setData(arr.map((f: any) => ({
        facturaId: f.facturaId,
        clienteNombre: f.clienteNombre,
        fechaFactura: f.fechaFactura,
        total: f.total,
        descripcion: f.descripcion,
        estado: f.estado,
        metodo: f.metodo,
      })));
    } catch (e: any) {
      // Fallback: derivar desde ordenes/dia si existe factura embebida
      try {
        const ordersRes = await axios.get(`${API_BASE_URL}/ordenes/dia`);
        const orders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
        const facturas: Factura[] = orders
          .filter(o => !!o.factura)
          .map(o => ({
            facturaId: o.factura?.facturaId,
            clienteNombre: o.factura?.clienteNombre || o.nombreCliente,
            fechaFactura: o.factura?.fechaFactura || o.fechaOrden,
            total: o.factura?.total,
            descripcion: o.factura?.descripcion,
            estado: o.factura?.estado,
            metodo: o.factura?.metodo,
          }));
        setData(facturas);
      } catch (fallbackErr: any) {
        // If 404 on fallback, clearly no data
        if (fallbackErr.response?.status === 404) {
          setData([]);
        } else {
          setError(fallbackErr?.message || e?.message || 'Error al cargar facturas del día');
        }
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useFacturasRango() {
  const [data, setData] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  const fetchData = useCallback(async () => {
    if (!from || !to) return;
    // Validar formato simple YYYY-MM-DD
    const fromDate = new Date(from + 'T00:00:00');
    const toDate = new Date(to + 'T23:59:59');
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      setError('Fechas inválidas');
      return;
    }
    setLoading(true); setError(null);
    try {
      // Backend no expone /facturas con rango, usamos /facturas-ventas y filtramos localmente
      const res = await axios.get(`${API_BASE_URL}/facturas-ventas`);
      const all = Array.isArray(res.data) ? res.data : [];
      const filtered = all.filter((f: any) => {
        const d = new Date(f.fechaFactura || f.fechaOrden);
        if (isNaN(d.getTime())) return false;
        return d >= fromDate && d <= toDate;
      }).map((f: any) => ({
        facturaId: f.facturaId,
        clienteNombre: f.clienteNombre,
        fechaFactura: f.fechaFactura,
        total: f.total,
        descripcion: f.descripcion,
        estado: f.estado,
        metodo: f.metodo,
      }));
      setData(filtered);
    } catch (e: any) {
      setError(e.message || 'Error al cargar facturas');
    } finally { setLoading(false); }
  }, [from, to]);

  return { data, loading, error, from, to, setFrom, setTo, fetchData };
}
