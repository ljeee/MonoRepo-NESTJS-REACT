import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../constants/api';

export type ClienteItem = {
  telefono?: string;
  clienteNombre?: string;
  direccion?: string;
  direccionDos?: string;
  direccionTres?: string;
};

export function useClientesList() {
  const [data, setData] = useState<ClienteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_BASE_URL}/clientes`);
      setData(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      // If 404, just means no clients yet
      if (e.response?.status === 404) {
        setData([]);
      } else {
        setError('Error cargando clientes');
        setData([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { data, loading, error, refetch: fetchAll };
}