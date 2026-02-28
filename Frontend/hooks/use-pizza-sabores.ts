import { useCallback, useEffect, useState } from 'react';
import { api, PizzaSabor } from '../services/api';

export type { PizzaSabor };

export function usePizzaSabores() {
  const [sabores, setSabores] = useState<PizzaSabor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSabores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.pizzaSabores.getAll();
      setSabores(data);
    } catch {
      setError('No se pudieron cargar los sabores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSabores(); }, [fetchSabores]);

  return { sabores, loading, error, fetchSabores };
}

export function useUpdatePizzaSabor() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSabor = useCallback(async (
    saborId: number,
    data: Partial<Omit<PizzaSabor, 'saborId'>>,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.pizzaSabores.update(saborId, data);
      return updated;
    } catch {
      setError('No se pudo actualizar el sabor');
      throw new Error('update failed');
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateSabor, loading, error };
}
