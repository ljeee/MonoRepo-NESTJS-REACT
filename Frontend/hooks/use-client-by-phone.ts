import axios from 'axios';
import { useCallback, useState } from 'react';
import { API_BASE_URL } from '../constants/api';

export type Cliente = {
  clienteNombre?: string;
  direccion?: string;
  direccionDos?: string;
  direccionTres?: string;
};
export function useClientByPhone() {
  const [client, setClient] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchClient = useCallback(async (telefono: string) => {
    setLoading(true);
    setError('');
    try {
      const url = `${API_BASE_URL}/clientes/${telefono}`;
      const res = await axios.get(url);
      setClient(res.data);
    } catch {
      setClient(null);
      setError('No encontrado');
    } finally {
      setLoading(false);
    }
  }, []);

  return { client, loading, error, fetchClient };
}
