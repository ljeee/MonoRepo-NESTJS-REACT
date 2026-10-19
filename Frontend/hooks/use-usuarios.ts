import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { AuthUser } from '@/src/shared';

/** Lista de usuarios del sistema con carga y pull-to-refresh. */
export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Evita actualizar estado tras desmontar.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await api.auth.getUsers()) as AuthUser[];
      if (montado.current) {
        setUsuarios(data);
        setError(null);
      }
    } catch {
      if (montado.current) setError('No se pudieron cargar los usuarios');
    } finally {
      if (montado.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const refrescar = useCallback(() => {
    setRefreshing(true);
    void cargar();
  }, [cargar]);

  return { usuarios, loading, refreshing, error, cargar, refrescar };
}
