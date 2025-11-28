import axios from 'axios';
import { useCallback, useState } from 'react';
import { API_BASE_URL } from '../constants/api';

export type Domiciliario = { telefono: number; domiciliarioNombre?: string };
export function useDomiciliariosList() {
  const [domiciliarios, setDomiciliarios] = useState<Domiciliario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchDomiciliarios = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_BASE_URL}/domiciliarios`);
      setDomiciliarios(res.data);
    } catch {
      setError('No se pudo cargar domiciliarios');
    } finally {
      setLoading(false);
    }
  }, []);

  return { domiciliarios, loading, error, fetchDomiciliarios };
}
