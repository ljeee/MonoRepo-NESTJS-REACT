import axios, { AxiosInstance } from 'axios';
import type {
  AuthResponse,
  Cliente, CreateClienteDto,
  CreateDomiciliarioDto, CreateFacturaPagoDto,
  CreateOrdenDto, Domiciliario,
  FacturaPago, FacturaStats, FacturaVenta,
  FindOrdenesParams, Orden, PaginatedResponse,
  Producto, ProductoVariante,
} from '../types/models';

// ─── Instancia base ───────────────────────────────────────────────────────────

export function getBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3000';
    return `http://${h}:3000`;
  }
  return 'http://localhost:3000';
}

const http: AxiosInstance = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: log errors
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.message || err.message || 'Error de red';
    console.error('[API]', err.config?.method?.toUpperCase(), err.config?.url, msg);
    return Promise.reject(err);
  },
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function arr<T>(data: unknown): T[] {
  return Array.isArray(data) ? data : [];
}

export function setApiBaseUrl(url: string) {
  http.defaults.baseURL = url;
}

export function setAuthToken(token: string | null) {
  if (token) {
    http.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }
  delete http.defaults.headers.common.Authorization;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

const auth = {
  login: (username: string, password: string) =>
    http.post<AuthResponse>('/auth/login', { username, password }).then((r) => r.data),

  refresh: (refreshToken: string) =>
    http.post<AuthResponse>('/auth/refresh', { refreshToken }).then((r) => r.data),
};

// ─── Ordenes ──────────────────────────────────────────────────────────────────

const ordenes = {
  getAll: (params?: FindOrdenesParams) =>
    http.get<PaginatedResponse<Orden>>('/ordenes', { params }).then((r) => r.data),

  getDay: (estado?: string) =>
    http.get<Orden[]>('/ordenes/dia', { params: estado ? { estado } : undefined }).then((r) => arr<Orden>(r.data)),

  getById: (id: number) =>
    http.get<Orden>(`/ordenes/${id}`).then((r) => r.data),

  create: (data: CreateOrdenDto) =>
    http.post<Orden>('/ordenes', data).then((r) => r.data),

  update: (id: number, data: Partial<Orden>) =>
    http.patch<Orden>(`/ordenes/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    http.delete(`/ordenes/${id}`).then((r) => r.data),

  cancel: (id: number) =>
    http.patch<Orden>(`/ordenes/${id}/cancel`).then((r) => r.data),
};

// ─── Facturas Ventas ──────────────────────────────────────────────────────────

const facturas = {
  getAll: (params?: { from?: string; to?: string }) =>
    http.get<FacturaVenta[]>('/facturas-ventas', { params }).then((r) => arr<FacturaVenta>(r.data)),

  getDay: () =>
    http.get<FacturaVenta[]>('/facturas-ventas/dia').then((r) => arr<FacturaVenta>(r.data)),

  getDayStats: () =>
    http.get<FacturaStats>('/facturas-ventas/dia/stats').then((r) => r.data),

  updateEstado: (id: number, estado: string) =>
    http.patch<FacturaVenta>(`/facturas-ventas/${id}`, { estado }).then((r) => r.data),

  update: (id: number, data: Partial<FacturaVenta>) =>
    http.patch<FacturaVenta>(`/facturas-ventas/${id}`, data).then((r) => r.data),
};

// ─── Facturas Pagos (Gastos) ──────────────────────────────────────────────────

const pagos = {
  getAll: (params?: { from?: string; to?: string }) =>
    http.get<FacturaPago[]>('/facturas-pagos', { params }).then((r) => arr<FacturaPago>(r.data)),

  getDay: () =>
    http.get<FacturaPago[]>('/facturas-pagos/dia').then((r) => arr<FacturaPago>(r.data)),

  create: (data: CreateFacturaPagoDto) =>
    http.post<FacturaPago>('/facturas-pagos', data).then((r) => r.data),

  update: (id: number, data: Partial<CreateFacturaPagoDto>) =>
    http.patch<FacturaPago>(`/facturas-pagos/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    http.delete(`/facturas-pagos/${id}`).then((r) => r.data),
};

// ─── Clientes ─────────────────────────────────────────────────────────────────

const clientes = {
  getAll: () =>
    http.get<Cliente[]>('/clientes').then((r) => arr<Cliente>(r.data)),

  getByPhone: (telefono: string) =>
    http.get<Cliente>(`/clientes/${telefono}`).then((r) => r.data),

  create: (data: CreateClienteDto) =>
    http.post<Cliente>('/clientes', data).then((r) => r.data),

  update: (telefono: string, data: Partial<CreateClienteDto>) =>
    http.patch<Cliente>(`/clientes/${telefono}`, data).then((r) => r.data),

  delete: (telefono: string) =>
    http.delete(`/clientes/${telefono}`).then((r) => r.data),
};

// ─── Domiciliarios ────────────────────────────────────────────────────────────

const domiciliarios = {
  getAll: () =>
    http.get<Domiciliario[]>('/domiciliarios').then((r) => arr<Domiciliario>(r.data)),

  getByPhone: (telefono: string) =>
    http.get<Domiciliario>(`/domiciliarios/${telefono}`).then((r) => r.data),

  create: (data: CreateDomiciliarioDto) =>
    http.post<Domiciliario>('/domiciliarios', data).then((r) => r.data),

  update: (telefono: string, data: Partial<CreateDomiciliarioDto>) =>
    http.patch<Domiciliario>(`/domiciliarios/${telefono}`, data).then((r) => r.data),

  delete: (telefono: string) =>
    http.delete(`/domiciliarios/${telefono}`).then((r) => r.data),
};

// ─── Productos ────────────────────────────────────────────────────────────────

const productos = {
  getAll: (params?: { categoria?: string; activo?: boolean }) =>
    http.get<Producto[]>('/productos', { params }).then((r) => arr<Producto>(r.data)),

  getById: (id: number) =>
    http.get<Producto>(`/productos/${id}`).then((r) => r.data),

  getCategorias: () =>
    http.get<string[]>('/productos/categorias').then((r) => arr<string>(r.data)),

  getVariantes: (productoId: number) =>
    http.get<ProductoVariante[]>(`/productos/${productoId}/variantes`).then((r) => arr<ProductoVariante>(r.data)),

  create: (data: Partial<Producto>) =>
    http.post<Producto>('/productos', data).then((r) => r.data),

  update: (id: number, data: Partial<Producto>) =>
    http.patch<Producto>(`/productos/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    http.delete(`/productos/${id}`).then((r) => r.data),

  createVariante: (productoId: number, data: Partial<ProductoVariante>) =>
    http.post<ProductoVariante>(`/productos/${productoId}/variantes`, data).then((r) => r.data),

  updateVariante: (varianteId: number, data: Partial<ProductoVariante>) =>
    http.patch<ProductoVariante>(`/productos/variantes/${varianteId}`, data).then((r) => r.data),

  deleteVariante: (varianteId: number) =>
    http.delete(`/productos/variantes/${varianteId}`).then((r) => r.data),
};

// ─── Pizza Sabores ────────────────────────────────────────────────────────────

export interface PizzaSabor {
  saborId: number;
  nombre: string;
  tipo: 'tradicional' | 'especial' | 'configuracion';
  recargoPequena: number | string;
  recargoMediana: number;
  recargoGrande: number;
  activo: boolean;
}

const pizzaSabores = {
  getAll: () =>
    http.get<PizzaSabor[]>('/pizza-sabores').then((r) => arr<PizzaSabor>(r.data)),

  update: (id: number, data: Partial<Omit<PizzaSabor, 'saborId'>>) =>
    http.patch<PizzaSabor>(`/pizza-sabores/${id}`, data).then((r) => r.data),
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const api = {
  auth,
  ordenes,
  facturas,
  pagos,
  clientes,
  domiciliarios,
  productos,
  pizzaSabores,
  http, // exposed for edge cases
};
