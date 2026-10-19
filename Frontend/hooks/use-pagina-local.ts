import { useEffect, useMemo, useState } from 'react';

/**
 * Paginación en el CLIENTE sobre un conjunto ya completo. Las pantallas de contabilidad traen
 * TODO el rango del servidor (sin tope de 50) y solo reparten lo que se dibuja: los totales y
 * las exportaciones siempre usan el conjunto completo, nunca la página visible.
 *
 * `verTodo` dibuja todo de una vez (útil para revisar/imprimir; en listas muy largas pesa más).
 */
export function usePaginaLocal<T>(items: readonly T[], porPagina: number) {
  const [page, setPage] = useState(1);
  const [verTodo, setVerTodo] = useState(false);
  const total = items.length;
  const totalPages = verTodo ? 1 : Math.max(1, Math.ceil(total / porPagina));

  // Datos nuevos (otra búsqueda, un cobro…) → de vuelta a la primera página.
  useEffect(() => {
    setPage(1);
  }, [items]);

  const actual = Math.min(page, totalPages);
  const desde = verTodo ? 0 : (actual - 1) * porPagina;
  const visibles = useMemo(() => (verTodo ? items : items.slice(desde, desde + porPagina)), [items, verTodo, desde, porPagina]);

  return {
    /** Lo que se dibuja ahora. */
    items: visibles as T[],
    page: actual,
    totalPages,
    setPage,
    total,
    /** Posición (desde 1) del primer y último elemento mostrados. */
    desde: total === 0 ? 0 : desde + 1,
    hasta: Math.min(total, desde + visibles.length),
    verTodo,
    setVerTodo,
    puedeAlternar: total > porPagina,
  };
}

export type PaginaLocal<T> = ReturnType<typeof usePaginaLocal<T>>;
