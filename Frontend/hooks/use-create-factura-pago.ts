import { useCallback, useState } from 'react';
import axios from 'axios';
import { api } from '../services/api';
import type { CreateFacturaPagoDto, FacturaPago } from '../types/models';

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage;
    }
    return error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

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
      setLoading(false);
      return true;
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error creando pago'));
      setLoading(false);
      return null;
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
      setLoading(false);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setData([]);
      } else {
        setError(getErrorMessage(error, 'Error cargando pagos del día'));
      }
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

  const fetchData = useCallback(async (f?: string, t?: string) => {
    const finalFrom = f || from;
    const finalTo = t || to;

    if (!finalFrom || !finalTo) return;
    if (isNaN(new Date(finalFrom).getTime()) || isNaN(new Date(finalTo).getTime())) {
      setError('Fechas inválidas');
      return;
    }
    setLoading(true); setError(null);
    try {
      setData(await api.pagos.getAll({ from: finalFrom, to: finalTo }));
      setLoading(false);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setData([]);
      } else {
        setError(getErrorMessage(error, 'Error cargando pagos'));
      }
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
      setLoading(false);
      return true;
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error actualizando pago'));
      setLoading(false);
      return null;
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
      setLoading(false);
      return true;
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error eliminando pago'));
      setLoading(false);
      return null;
    }
  };

  return { deletePago, loading, error };
}