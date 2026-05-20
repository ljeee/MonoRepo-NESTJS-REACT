import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../contexts/ApiContext';
import type { PizzaSabor } from '../types/models';

export type { PizzaSabor };

export function usePizzaSabores() {
  const api = useApi();
  const [sabores, setSabores] = useState<PizzaSabor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSabores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.pizzaSabores.getAll();
      setSabores(data);
      setLoading(false);
    } catch {
      setError('No se pudieron cargar los sabores');
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchSabores(); }, [fetchSabores]);

  return { sabores, loading, error, fetchSabores };
}

export function useUpdatePizzaSabor() {
  const api = useApi();
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
      setLoading(false);
      return updated;
    } catch {
      setError('No se pudo actualizar el sabor');
      setLoading(false);
      throw new Error('update failed');
    }
  }, [api]);

  return { updateSabor, loading, error };
}

export function useCreatePizzaSabor() {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSabor = useCallback(async (
    data: Partial<PizzaSabor>,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const created = await api.pizzaSabores.create(data);
      setLoading(false);
      return created;
    } catch {
      setError('No se pudo crear el sabor');
      setLoading(false);
      throw new Error('create failed');
    }
  }, [api]);

  return { createSabor, loading, error };
}

export function useDeletePizzaSabor() {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteSabor = useCallback(async (
    saborId: number,
  ) => {
    setLoading(true);
    setError(null);
    try {
      await api.pizzaSabores.delete(saborId);
      setLoading(false);
    } catch {
      setError('No se pudo eliminar el sabor');
      setLoading(false);
      throw new Error('delete failed');
    }
  }, [api]);

  return { deleteSabor, loading, error };
}
