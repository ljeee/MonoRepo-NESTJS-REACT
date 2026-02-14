import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Domiciliario } from '../types/models';

export type DomiciliarioItem = Domiciliario;

export function useDomiciliariosList() {
  const [data, setData] = useState<Domiciliario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.domiciliarios.getAll());
    } catch (e: any) {
      if (e.response?.status === 404) {
        setData([]);
      } else {
        setError('Error cargando domiciliarios');
        setData([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { data, loading, error, refetch: fetchAll };
}
