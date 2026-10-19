import { useEffect, useState } from 'react';

/** Devuelve `valor` solo cuando deja de cambiar durante `ms` (búsquedas que consultan al servidor). */
export function useDebouncedValue<T>(valor: T, ms = 300): T {
  const [estable, setEstable] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setEstable(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return estable;
}
