import { useCallback, useEffect, useState, useRef } from 'react';
import { useApi } from '../contexts/ApiContext';
import type { Cliente } from '../types/models';
import { LOTE_PAGINA } from '../utils/paginas';

export type ClienteItem = Cliente;

export function useClientesList(options?: { batchSize?: number }) {
  const api = useApi();
  const [data, setData] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [progreso, setProgreso] = useState<{ cargados: number; total: number } | null>(null);
  const [error, setError] = useState('');

  const abortRef = useRef(false);

  const fetchAll = useCallback(async () => {
    abortRef.current = false;
    setLoading(true);
    setError('');
    setProgreso(null);

    try {
      const lote = options?.batchSize || LOTE_PAGINA; // 500
      // 1. Pedir primera tanda
      const primera = await api.clientes.getPage(1, lote);
      if (abortRef.current) return;

      const primeraData = Array.isArray(primera?.data) ? primera.data : [];
      setData(primeraData);
      setLoading(false); // La UI muestra los primeros datos de inmediato sin bloquear

      const total = primera?.total ?? primeraData.length;
      const totalPages = primera?.totalPages ?? 1;

      // 2. Si hay más registros (> 500), traer las siguientes páginas progresivamente
      if (totalPages > 1) {
        setLoadingMore(true);
        setProgreso({ cargados: primeraData.length, total });

        let acumulados = [...primeraData];
        for (let p = 2; p <= totalPages; p++) {
          if (abortRef.current) break;
          const sig = await api.clientes.getPage(p, lote);
          if (abortRef.current) break;

          const sigData = Array.isArray(sig?.data) ? sig.data : [];
          if (sigData.length > 0) {
            acumulados = [...acumulados, ...sigData];
            setData([...acumulados]);
            setProgreso({ cargados: acumulados.length, total });
          }
        }
      }
    } catch (e: any) {
      if (e.response?.status === 404) {
        setData([]);
      } else {
        setError('Error cargando clientes');
        setData([]);
      }
    } finally {
      if (!abortRef.current) {
        setLoading(false);
        setLoadingMore(false);
        setProgreso(null);
      }
    }
  }, [api, options?.batchSize]);

  useEffect(() => {
    abortRef.current = false;
    fetchAll();
    return () => {
      abortRef.current = true;
    };
  }, [fetchAll]);

  return {
    data,
    loading,
    loadingMore,
    progreso,
    error,
    refetch: fetchAll,
  };
}
