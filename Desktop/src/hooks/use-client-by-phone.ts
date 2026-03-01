import { useCallback, useState } from 'react';
import { api } from '../services/api';
import type { Cliente } from '../types/models';

export function useClientByPhone() {
  const [client, setClient] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchClient = useCallback(async (telefono: string) => {
    setLoading(true);
    setError('');
    try {
      setClient(await api.clientes.getByPhone(telefono));
    } catch {
      setClient(null);
      setError('No encontrado');
    } finally {
      setLoading(false);
    }
  }, []);

  return { client, loading, error, fetchClient };
}
