import { useCallback, useState } from 'react';
import { api } from '../services/api';
import type { CreateFacturaPagoDto, FacturaPago } from '../types/models';

export function useCreateFacturaPago() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const createPago = async (data: CreateFacturaPagoDto) => {
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
      await api.pagos.create(data);
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

export function useFacturasPagosDia() {
  const [data, setData] = useState<FacturaPago[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const arr = await api.pagos.getDay();
      const cleaned = arr
        .filter((p) => p && Object.keys(p).length > 0)
        .sort((a, b) => (b.pagosId || 0) - (a.pagosId || 0));
      setData(cleaned);
    } catch (e: any) {
      if (e.response?.status === 404) {
        setData([]);
      } else {
        setError(e.message || 'Error cargando pagos del día');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchData };
}

export function useFacturasPagosRango() {
  const [data, setData] = useState<FacturaPago[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchData = useCallback(async () => {
    if (!from || !to) return;
    if (isNaN(new Date(from).getTime()) || isNaN(new Date(to).getTime())) {
      setError('Fechas inválidas');
      return;
    }
    setLoading(true); setError(null);
    try {
      setData(await api.pagos.getAll({ from, to }));
    } catch (e: any) {
      if (e.response?.status === 404) {
        setData([]);
      } else {
        setError(e.message || 'Error cargando pagos');
      }
    } finally {
      setLoading(false);
    }
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
      await api.pagos.update(id, data);
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
      await api.pagos.delete(id);
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