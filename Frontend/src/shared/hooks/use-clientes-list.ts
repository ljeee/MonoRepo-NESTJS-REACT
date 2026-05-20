import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../contexts/ApiContext';
import type { Cliente } from '../types/models';

export type ClienteItem = Cliente;

export function useClientesList() {
  const api = useApi();
  const [data, setData] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.clientes.getAll());
    } catch (e: any) {
      if (e.response?.status === 404) {
        setData([]);
      } else {
        setError('Error cargando clientes');
        setData([]);
      }
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { data, loading, error, refetch: fetchAll };
}
