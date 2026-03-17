import { useCallback, useState } from 'react';
import { useApi } from '../contexts/ApiContext';
import type { Cliente } from '../types/models';

export function useClientByPhone() {
  const api = useApi();
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
  }, [api]);

  return { client, loading, error, fetchClient };
}
