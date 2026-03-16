import { useCallback, useState } from 'react';
import { useApi } from '../contexts/ApiContext';
import type { Producto, ProductoVariante } from '../types/models';

export type { Producto, ProductoVariante };

export function useProductos() {
  const api = useApi();
  const [state, setState] = useState<{ productos: Producto[]; loading: boolean; error: string | null }>({
    productos: [],
    loading: false,
    error: null,
  });
  const { productos, loading, error } = state;

  const fetchProductos = useCallback(async (categoria?: string, activo?: boolean) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const productosData = await api.productos.getAll({ categoria, activo });
      setState({ productos: productosData, loading: false, error: null });
    } catch (e: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: e.message || 'Error cargando productos',
      }));
    }
  }, [api]);

  return { productos, loading, error, fetchProductos };
}

export function useProductOperations() {
  const api = useApi();
  const [state, setState] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });
  const { loading, error } = state;

  const wrap = async <T>(fn: () => Promise<T>, errMsg: string): Promise<T> => {
    setState({ loading: true, error: null });
    try {
      const result = await fn();
      setState({ loading: false, error: null });
      return result;
    } catch (e: any) {
      setState({ loading: false, error: e.message || errMsg });
      throw e;
    }
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
