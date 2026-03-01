import { useCallback, useState } from 'react';
import { api } from '../services/api';
import type { Producto, ProductoVariante } from '../types/models';

// Re-export for backward compat
export type { Producto, ProductoVariante };

export function useProductos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProductos = useCallback(async (categoria?: string, activo?: boolean) => {
    setLoading(true);
    setError(null);
    try {
      setProductos(await api.productos.getAll({ categoria, activo }));
    } catch (e: any) {
      setError(e.message || 'Error cargando productos');
    } finally {
      setLoading(false);
    }
  }, []);

  return { productos, loading, error, fetchProductos };
}

export function useProductOperations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrap = async <T>(fn: () => Promise<T>, errMsg: string): Promise<T> => {
    setLoading(true); setError(null);
    try {
      return await fn();
    } catch (e: any) {
      setError(e.message || errMsg);
      throw e;
    } finally { setLoading(false); }
  };

  return {
    loading, error,
    createProducto: (data: any) => wrap(() => api.productos.create(data), 'Error creando producto'),
    updateProducto: (id: number, data: any) => wrap(() => api.productos.update(id, data), 'Error actualizando producto'),
    deleteProducto: (id: number) => wrap(() => api.productos.delete(id), 'Error eliminando producto'),
    createVariante: (productoId: number, data: any) => wrap(() => api.productos.createVariante(productoId, data), 'Error creando variante'),
    updateVariante: (varianteId: number, data: any) => wrap(() => api.productos.updateVariante(varianteId, data), 'Error actualizando variante'),
    deleteVariante: (varianteId: number) => wrap(() => api.productos.deleteVariante(varianteId), 'Error eliminando variante'),
  };
}
