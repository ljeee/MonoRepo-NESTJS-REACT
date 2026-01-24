import axios from 'axios';
import { useCallback, useState } from 'react';
import { API_BASE_URL } from '../constants/api';

export interface ProductoVariante {
  varianteId: number;
  nombre: string;
  precio: number;
  descripcion?: string;
  activo: boolean;
}

export interface Producto {
  productoId: number;
  productoNombre: string;
  categoria: string;
  descripcion?: string;
  activo: boolean;
  variantes: ProductoVariante[];
}

export function useProductos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProductos = useCallback(async (categoria?: string, activo?: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (categoria) params.append('categoria', categoria);
      if (activo !== undefined) params.append('activo', String(activo));
      
      const url = params.toString() 
        ? `${API_BASE_URL}/productos?${params.toString()}`
        : `${API_BASE_URL}/productos`;
      
      const res = await axios.get(url);
      setProductos(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e.message || 'Error cargando productos');
    } finally {
      setLoading(false);
    }
  }, []);

  return { productos, loading, error, fetchProductos };
}

export function useProductosPorCategoria() {
  const [categorias, setCategorias] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategorias = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/productos/categorias`);
      setCategorias(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e.message || 'Error cargando categorías');
    } finally {
      setLoading(false);
    }
  }, []);

  return { categorias, loading, error, fetchCategorias };
}

export function useProductoVariantes(productoId: number) {
  const [variantes, setVariantes] = useState<ProductoVariante[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVariantes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/productos/${productoId}/variantes`);
      setVariantes(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e.message || 'Error cargando variantes');
    } finally {
      setLoading(false);
    }
  }, [productoId]);

  return { variantes, loading, error, fetchVariantes };
}

export function useProductOperations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProducto = async (data: any) => {
    setLoading(true); setError(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/productos`, data);
      return res.data;
    } catch (e: any) {
      setError(e.message || 'Error creando producto');
      throw e;
    } finally { setLoading(false); }
  };

  const updateProducto = async (id: number, data: any) => {
    setLoading(true); setError(null);
    try {
      const res = await axios.patch(`${API_BASE_URL}/productos/${id}`, data);
      return res.data;
    } catch (e: any) {
      setError(e.message || 'Error actualizando producto');
      throw e;
    } finally { setLoading(false); }
  };

  const deleteProducto = async (id: number) => {
    setLoading(true); setError(null);
    try {
      await axios.delete(`${API_BASE_URL}/productos/${id}`);
      return true;
    } catch (e: any) {
      setError(e.message || 'Error eliminando producto');
      throw e;
    } finally { setLoading(false); }
  };

  const createVariante = async (productoId: number, data: any) => {
    setLoading(true); setError(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/productos/${productoId}/variantes`, data);
      return res.data;
    } catch (e: any) {
      setError(e.message || 'Error creando variante');
      throw e;
    } finally { setLoading(false); }
  };

  const updateVariante = async (varianteId: number, data: any) => {
    setLoading(true); setError(null);
    try {
      const res = await axios.patch(`${API_BASE_URL}/productos/variantes/${varianteId}`, data);
      return res.data;
    } catch (e: any) {
      setError(e.message || 'Error actualizando variante');
      throw e;
    } finally { setLoading(false); }
  };

  const deleteVariante = async (varianteId: number) => {
    setLoading(true); setError(null);
    try {
      await axios.delete(`${API_BASE_URL}/productos/variantes/${varianteId}`);
      return true;
    } catch (e: any) {
      setError(e.message || 'Error eliminando variante');
      throw e;
    } finally { setLoading(false); }
  };

  return { 
    loading, 
    error, 
    createProducto, 
    updateProducto, 
    deleteProducto,
    createVariante,
    updateVariante,
    deleteVariante
  };
}
