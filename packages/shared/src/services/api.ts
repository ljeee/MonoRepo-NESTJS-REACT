import axios, { AxiosInstance } from 'axios';
import type {
  AuthResponse,
  Cliente, ClienteDireccion, CreateClienteDto,
  CreateDomiciliarioDto, CreateFacturaPagoDto,
  CreateOrdenDto, Domiciliario,
  FacturaPago, FacturaStats, FacturaVenta,
  FindOrdenesParams, Orden, PaginatedResponse,
  Producto, ProductoVariante,
  PizzaSabor,
  ProductoTop, SaborTop, VentaHora, VentaDia,
  MetodoPago, ResumenPeriodo, ClienteFrecuente,
  VarianteTop, ClienteHistorial,
  RegisterDto,
  EmpresaConfig, UpdateEmpresaDto,
  InventarioCaja, InventarioCajasMovimiento as InventarioCajasMovimientoModel, AjustarCajasDto as AjustarCajasDtoModel, CrearCajaDto as CrearCajaDtoModel,
} from '../types/models';

// ─── Factory: crea instancia configurada ──────────────────────────────────────

export interface ApiConfig {
  baseURL: string;
  timeout?: number;
}

export function createHttpClient(config: ApiConfig): AxiosInstance {
  const http = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout ?? 15000,
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

  return http;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function arr<T>(data: unknown): T[] {
  return Array.isArray(data) ? data : [];
}

export function setAuthToken(http: AxiosInstance, token: string | null) {
  if (token) {
    http.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }
  delete http.defaults.headers.common.Authorization;
}

export function setApiBaseUrl(http: AxiosInstance, url: string) {
  http.defaults.baseURL = url;
}

// ─── API builder ──────────────────────────────────────────────────────────────

export function createApi(http: AxiosInstance) {
  // ─── Auth ───────────────────────────────────────────────────────────
  const auth = {
    login: (username: string, password: string) =>
      http.post<AuthResponse>('/auth/login', { username, password }).then((r) => r.data),

    refresh: (refreshToken: string) =>
      http.post<AuthResponse>('/auth/refresh', { refreshToken }).then((r) => r.data),

    register: (data: RegisterDto) =>
      http.post<AuthResponse>('/auth/register', data).then((r) => r.data),

    getUsers: () =>
      http.get<any[]>('/auth/users').then((r) => arr<any>(r.data)),
  };

  // ─── Ordenes ────────────────────────────────────────────────────────
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

    cancel: (id: number, reason?: string) =>
      http.patch<Orden>(`/ordenes/${id}/cancel`, { reason }).then((r) => r.data),
    
    completar: (id: number, metodo: string, idempotencyKey?: string, lastUpdatedAt?: string) =>
      http.patch<Orden>(`/ordenes/${id}/completar`, { metodo, idempotencyKey, lastUpdatedAt }).then((r) => r.data),
  };

  // ─── Facturas Ventas ────────────────────────────────────────────────
  const facturas = {
    getAll: (params?: { from?: string; to?: string; page?: number; limit?: number }) =>
      http.get<{ data: FacturaVenta[]; total: number; page: number; limit: number; totalPages: number }>('/facturas-ventas', { params }).then((r) => r.data),

    getDay: () =>
      http.get<FacturaVenta[]>('/facturas-ventas/dia').then((r) => arr<FacturaVenta>(r.data)),

    getDayStats: () =>
      http.get<FacturaStats>('/facturas-ventas/dia/stats').then((r) => r.data),

    updateEstado: (id: number, estado: string) =>
      http.patch<FacturaVenta>(`/facturas-ventas/${id}`, { estado }).then((r) => r.data),

    update: (id: number, data: Partial<FacturaVenta>) =>
      http.patch<FacturaVenta>(`/facturas-ventas/${id}`, data).then((r) => r.data),

    delete: (id: number) =>
      http.delete(`/facturas-ventas/${id}`).then((r) => r.data),
  };

  // ─── Facturas Pagos (Gastos) ────────────────────────────────────────
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

  // ─── Clientes ───────────────────────────────────────────────────────
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

    // ── Direcciones ──
    getDirecciones: (telefono: string) =>
      http.get<ClienteDireccion[]>(`/clientes/${telefono}/direcciones`).then((r) => arr<ClienteDireccion>(r.data)),

    addDireccion: (telefono: string, direccion: string) =>
      http.post<ClienteDireccion>(`/clientes/${telefono}/direcciones`, { direccion }).then((r) => r.data),

    removeDireccion: (id: number) =>
      http.delete(`/clientes/direcciones/${id}`).then((r) => r.data),
  };

  // ─── Domiciliarios ─────────────────────────────────────────────────
  const domiciliarios = {
    getAll: () =>
      http.get<Domiciliario[]>('/domiciliarios').then((r) => arr<Domiciliario>(r.data)),

    getMe: () =>
      http.get<any[]>('/domicilios/me').then((r) => arr<any>(r.data)),

    getByPhone: (telefono: string) =>
      http.get<Domiciliario>(`/domiciliarios/${telefono}`).then((r) => r.data),

    create: (data: CreateDomiciliarioDto) =>
      http.post<Domiciliario>('/domiciliarios', data).then((r) => r.data),

    update: (telefono: string, data: Partial<CreateDomiciliarioDto>) =>
      http.patch<Domiciliario>(`/domiciliarios/${telefono}`, data).then((r) => r.data),

    delete: (telefono: string) =>
      http.delete(`/domiciliarios/${telefono}`).then((r) => r.data),
  };

  // ─── Productos ──────────────────────────────────────────────────────
  const productos = {
    getAll: (params?: { activo?: boolean }) =>
      http.get<Producto[]>('/productos', { params }).then((r) => arr<Producto>(r.data)),

    getById: (id: number) =>
      http.get<Producto>(`/productos/${id}`).then((r) => r.data),


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

  // ─── Pizza Sabores ──────────────────────────────────────────────────
  const pizzaSabores = {
    getAll: () =>
      http.get<PizzaSabor[]>('/pizza-sabores').then((r) => arr<PizzaSabor>(r.data)),

    create: (data: Partial<PizzaSabor>) =>
      http.post<PizzaSabor>('/pizza-sabores', data).then((r) => r.data),

    update: (id: number, data: Partial<Omit<PizzaSabor, 'saborId'>>) =>
      http.patch<PizzaSabor>(`/pizza-sabores/${id}`, data).then((r) => r.data),

    delete: (id: number) =>
      http.delete(`/pizza-sabores/${id}`).then((r) => r.data),
  };

  // ─── Empresa ────────────────────────────────────────────────────────
  const empresa = {
    get: () =>
      http.get<EmpresaConfig>('/empresa').then((r) => r.data),

    update: (data: UpdateEmpresaDto) =>
      http.patch<EmpresaConfig>('/empresa', data).then((r) => r.data),
  };

  // ─── Estadísticas ───────────────────────────────────────────────────
  const estadisticas = {
    productosTop: (from: string, to: string, limit = 10) =>
      http.get<ProductoTop[]>('/estadisticas/productos-top', { params: { from, to, limit } }).then((r) => arr<ProductoTop>(r.data)),

    saboresTop: (from: string, to: string, limit = 10) =>
      http.get<SaborTop[]>('/estadisticas/sabores-top', { params: { from, to, limit } }).then((r) => arr<SaborTop>(r.data)),

    variantesTop: (from: string, to: string, limit = 10) =>
      http.get<VarianteTop[]>('/estadisticas/variantes-top', { params: { from, to, limit } }).then((r) => arr<VarianteTop>(r.data)),

    ventasPorHora: (fecha?: string, from?: string, to?: string) =>
      http.get<VentaHora[]>('/estadisticas/ventas-por-hora', { params: { fecha, from, to } }).then((r) => arr<VentaHora>(r.data)),

    ventasPorDia: (from: string, to: string) =>
      http.get<VentaDia[]>('/estadisticas/ventas-por-dia', { params: { from, to } }).then((r) => arr<VentaDia>(r.data)),

    metodosPago: (from: string, to: string) =>
      http.get<MetodoPago[]>('/estadisticas/metodos-pago', { params: { from, to } }).then((r) => arr<MetodoPago>(r.data)),

    resumenPeriodo: (from: string, to: string) =>
      http.get<ResumenPeriodo>('/estadisticas/resumen-periodo', { params: { from, to } }).then((r) => r.data),

    clientesFrecuentes: (limit = 10) =>
      http.get<ClienteFrecuente[]>('/estadisticas/clientes-frecuentes', { params: { limit } }).then((r) => arr<ClienteFrecuente>(r.data)),

    domiciliariosStats: (from: string, to: string) =>
      http.get<any[]>('/estadisticas/domiciliarios', { params: { from, to } }).then((r) => arr<any>(r.data)),

    clienteHistorial: (telefono: string) =>
      http.get<ClienteHistorial>(`/estadisticas/cliente/${telefono}/historial`).then((r) => r.data),
  };

  // ─── Domicilios ───────────────────────────────────────────────────
  const domicilios = {
    getMe: (all = false) =>
      http.get<any[]>('/domicilios/me', { params: all ? { all: true } : {} }).then((r) => arr<any>(r.data)),

    getAllDay: () =>
      http.get<any[]>('/domicilios/dia').then((r) => arr<any>(r.data)),

    update: (id: number, data: any) =>
      http.patch<any>(`/domicilios/${id}`, data).then((r) => r.data),
  };

  // ─── Cierres de Caja ───────────────────────────────────────────────
  const cierres = {
    ejecutar: (fecha: string, observaciones?: string) =>
      http.post('/cierres', { fecha, observaciones }).then((r) => r.data),

    getHistory: () =>
      http.get<any[]>('/cierres').then((r) => arr<any>(r.data)),

    delete: (id: string | number) =>
      http.delete(`/cierres/${id}`).then((r) => r.data),
  };

  // ─── Inventario Cajas ──────────────────────────────────────────────
  const inventarioCajas = {
    getEstado: () =>
      http.get<InventarioCaja[]>('/inventario-cajas').then((r) => arr<InventarioCaja>(r.data)),

    crear: (data: CrearCajaDtoModel) =>
      http.post<InventarioCaja>('/inventario-cajas', data).then((r) => r.data),

    eliminar: (id: number) =>
      http.delete(`/inventario-cajas/${id}`).then((r) => r.data),

    ajustar: (id: number, data: AjustarCajasDtoModel) =>
      http.post<InventarioCaja>(`/inventario-cajas/${id}/ajustar`, data).then((r) => r.data),

    configurarAlerta: (id: number, alertaMinimo: number) =>
      http.patch<{ alertaMinimo: number }>(`/inventario-cajas/${id}/alerta`, { alertaMinimo }).then((r) => r.data),

    getMovimientos: (limit = 20) =>
      http.get<InventarioCajasMovimientoModel[]>('/inventario-cajas/movimientos', { params: { limit } }).then((r) => arr<InventarioCajasMovimientoModel>(r.data)),
  };

  return {
    auth,
    ordenes,
    facturas,
    pagos,
    clientes,
    domiciliarios,
    domicilios,
    cierres,
    productos,
    pizzaSabores,
    estadisticas,
    empresa,
    inventarioCajas,
    http,
  };
}

export type Api = ReturnType<typeof createApi>;
