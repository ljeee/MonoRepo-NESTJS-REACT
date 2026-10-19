import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '../contexts/ApiContext';
import type { SaborGrupo } from '../types/models';

/** Grupos de sabores (Pizza, Calzone…) con sus reglas. `porId` sirve para resolver el grupo de un producto. */
export function useSaborGrupos() {
  const api = useApi();
  const [grupos, setGrupos] = useState<SaborGrupo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGrupos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGrupos(await api.saborGrupos.getAll());
    } catch {
      setError('No se pudieron cargar los grupos de sabores');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void fetchGrupos();
  }, [fetchGrupos]);

  const porId = useMemo(() => new Map(grupos.map((g) => [g.id, g])), [grupos]);

  return { grupos, porId, loading, error, fetchGrupos };
}
