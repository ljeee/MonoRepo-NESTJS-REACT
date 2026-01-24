import axios from 'axios';
import { useCallback, useState } from 'react';
import { API_BASE_URL } from '../constants/api';

export interface CreateFacturaPagoDto {
  total?: number;
  nombreGasto?: string;
  descripcion?: string;
  estado?: string;
  fechaFactura?: string; // YYYY-MM-DD
  metodo?: string;
}

export function useCreateFacturaPago() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const createPago = async (data: CreateFacturaPagoDto) => {
    // Validaciones mínimas antes de enviar
    if (data.total == null || isNaN(data.total) || data.total <= 0) {
      setError('Total inválido');
      return null;
    }
    if (!data.nombreGasto || !data.nombreGasto.trim()) {
      setError('Nombre gasto requerido');
      return null;
    }
    setLoading(true); setError(null); setSuccess(false);
    try {
      await axios.post(`${API_BASE_URL}/facturas-pagos`, data);
      setSuccess(true);
      return true;
    } catch (e: any) {
      setError(e.message || 'Error creando pago');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createPago, loading, error, success };
}

export interface FacturaPagoItem {
  pagosId?: number;
  total?: number;
  nombreGasto?: string;
  descripcion?: string;
  estado?: string;
  fechaFactura?: string;
  metodo?: string;
}

export function useFacturasPagosDia() {
  const [data, setData] = useState<FacturaPagoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/facturas-pagos/dia`);
      const arr = Array.isArray(res.data) ? res.data : [];
      // Filtra elementos vacíos y ordena por pagosId desc
      const cleaned = arr.filter(p => p && Object.keys(p).length > 0).sort((a: any, b: any) => (b.pagosId || 0) - (a.pagosId || 0));
      setData(cleaned);
    } catch (e: any) {
      // If 404, just means no data for today
      if (e.response?.status === 404) {
        setData([]);
      } else {
        setError(e.message || 'Error cargando pagos del día');
      }
    } finally { setLoading(false); }
  }, []);

  return { data, loading, error, fetchData };
}

export function useFacturasPagosRango() {
  const [data, setData] = useState<FacturaPagoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  const fetchData = useCallback(async () => {
    if (!from || !to) return;
    if (isNaN(new Date(from).getTime()) || isNaN(new Date(to).getTime())) {
      setError('Fechas inválidas');
      return;
    }
    setLoading(true); setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/facturas-pagos?from=${from}&to=${to}`);
      setData(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      // If 404, just means no data in range
      if (e.response?.status === 404) {
        setData([]);
      } else {
        setError(e.message || 'Error cargando pagos');
      }
    } finally { setLoading(false); }
  }, [from, to]);

  return { data, loading, error, from, to, setFrom, setTo, fetchData };
}

export function useUpdateFacturaPago() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const updatePago = async (id: number, data: Partial<CreateFacturaPagoDto>) => {
    setLoading(true); setError(null); setSuccess(false);
    try {
      await axios.patch(`${API_BASE_URL}/facturas-pagos/${id}`, data);
      setSuccess(true);
      return true;
    } catch (e: any) {
      setError(e.message || 'Error actualizando pago');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { updatePago, loading, error, success };
}

export function useDeleteFacturaPago() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deletePago = async (id: number) => {
    setLoading(true); setError(null);
    try {
      await axios.delete(`${API_BASE_URL}/facturas-pagos/${id}`);
      return true;
    } catch (e: any) {
      setError(e.message || 'Error eliminando pago');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { deletePago, loading, error };
}