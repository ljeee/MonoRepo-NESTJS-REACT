import axios, { AxiosInstance } from 'axios';
import { invalidarConsultas } from '../utils/consultas';
import type {
  AuthResponse,
  Cliente, ClienteDireccion, CreateClienteDto,
  CreateDomiciliarioDto, CreateFacturaPagoDto, FindFacturasPagosParams,
  CreateOrdenDto, Domiciliario,
  FacturaPago, FacturaStats, FacturaVenta,
  FindOrdenesParams, Orden, PaginatedResponse,
  Producto, ProductoVariante,
  PizzaSabor,
  SaborGrupo, GuardarSaborGrupoDto,
  ClienteHistorial,
  RegisterDto,
  EmpresaConfig, UpdateEmpresaDto, CuentaTransferencia,
  InventarioItem, MovimientosInventarioPagina, InventarioRegla, SugerenciaReglaCaja, EstadoInventario,
  CrearItemInventarioDto, ActualizarItemInventarioDto, GuardarReglaInventarioDto, TipoItemInventario, TipoMovimientoManual,
  DenominacionesMap, CajaMovimiento, CajaResumen,
} from '../types/models';
import type {
  AgrupacionProductos,
  CalidadDatosAnalitica,
  ClientesAnalitica,
  CombinacionesAnalitica,
  DomiciliariosAnalitica,
  FiltrosAnalitica,
  GranularidadSerie,
  HorariosAnalitica,
  MatrizSaboresAnalitica,
  MetricaSabor,
  MixAnalitica,
  OpcionesAnalitica,
  OrdenProductos,
  OrdenClientesAnalitica,
  ProductosAnalitica,
  ResumenAnalitica,
  ResumenGeneral,
  SaboresAnalitica,
  SerieAnalitica,
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

  // Una escritura (cobrar, editar, borrar, egresos…) deja viejas las búsquedas guardadas por el cooldown
  // (utils/consultas.ts): la siguiente búsqueda se pide de nuevo. También si falla: pudo haberse aplicado.
  const esEscritura = (metodo?: string) => !!metodo && !['get', 'head', 'options'].includes(metodo.toLowerCase());

  // Interceptor: log errors
  http.interceptors.response.use(
    (res) => {
      if (esEscritura(res.config?.method)) invalidarConsultas();
      return res;
    },
    (err) => {
      if (esEscritura(err.config?.method)) invalidarConsultas();
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

    updateUser: (id: string, data: { name?: string; username?: string; password?: string }) =>
      http.patch<any>(`/auth/users/${id}`, data).then((r) => r.data),
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
    
    completar: (id: number, metodo: string, idempotencyKey?: string, lastUpdatedAt?: string, pagoEfectivo?: number, pagoTransferencia?: number, denominaciones?: DenominacionesMap, cuentaTransferenciaId?: number, cuentaTransferenciaNombre?: string) =>
      http.patch<Orden>(`/ordenes/${id}/completar`, { metodo, idempotencyKey, lastUpdatedAt, pagoEfectivo, pagoTransferencia, denominaciones, cuentaTransferenciaId, cuentaTransferenciaNombre }).then((r) => r.data),
  };

  // ─── Facturas Ventas ────────────────────────────────────────────────
  const facturas = {
    /**
     * `limit: 0` (o sin limit, con from+to) = TODO el rango sin paginar. `cuentaTransferenciaId: -1` = sin cuenta.
     * `conTransferencia` = solo ventas con dinero cobrado por QR/transferencia (mixtas y abonos QR incluidos).
     * `cursor` = paginación por clave para traer un rango completo por tandas: 'inicio' y luego el `siguiente`
     * de cada respuesta (null = no hay más). Úsalo con `traerPorCursor` (utils/paginas.ts).
     */
    getAll: (params?: { from?: string; to?: string; page?: number; limit?: number; estado?: string; clienteNombre?: string; metodo?: string; cuentaTransferenciaId?: number; conTransferencia?: boolean; cursor?: string }) =>
      http.get<PaginatedResponse<FacturaVenta>>('/facturas-ventas', { params }).then((r) => r.data),

    /**
     * CSV de TODAS las facturas del rango, generado por el servidor por tandas (sirve para rangos de años sin
     * cargar nada en el celular). Devuelve el archivo como Blob.
     */
    exportarCsv: (params: { from: string; to: string; conTransferencia?: boolean; cuentaTransferenciaId?: number }) =>
      http.get<Blob>('/facturas-ventas/export', { params, responseType: 'blob' }).then((r) => r.data),

    getDay: () =>
      http.get<FacturaVenta[]>('/facturas-ventas/dia').then((r) => arr<FacturaVenta>(r.data)),

    getDayStats: () =>
      http.get<FacturaStats>('/facturas-ventas/dia/stats').then((r) => r.data),

    updateEstado: (id: number, estado: string) =>
      http.patch<FacturaVenta>(`/facturas-ventas/${id}`, { estado }).then((r) => r.data),

    update: (id: number, data: Partial<FacturaVenta>) =>
      http.patch<FacturaVenta>(`/facturas-ventas/${id}`, data).then((r) => r.data),

    abono: (id: number, monto: number, metodo?: 'efectivo' | 'transferencia', denominaciones?: DenominacionesMap, cambioDenominaciones?: DenominacionesMap, cuentaTransferenciaId?: number, cuentaTransferenciaNombre?: string) =>
      http.patch<FacturaVenta>(`/facturas-ventas/${id}/abono`, { monto, metodo, denominaciones, cambioDenominaciones, cuentaTransferenciaId, cuentaTransferenciaNombre }).then((r) => r.data),

    delete: (id: number) =>
      http.delete(`/facturas-ventas/${id}`).then((r) => r.data),
  };

  // ─── Facturas Pagos (Gastos) ────────────────────────────────────────
  const pagos = {
    /** Sin `limit` (o limit=0) devuelve TODOS los egresos del rango. */
    getAll: (params?: FindFacturasPagosParams) =>
      http.get<PaginatedResponse<FacturaPago>>('/facturas-pagos', { params }).then((r) => r.data),

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
    getAll: (params?: { page?: number; limit?: number; search?: string }) =>
      http
        .get<Cliente[] | PaginatedResponse<Cliente>>('/clientes', { params })
        .then((r) => {
          if (Array.isArray(r.data)) return r.data;
          if (r.data && Array.isArray((r.data as any).data)) {
            if (params?.page !== undefined || params?.limit !== undefined) {
              return r.data as any;
            }
            return (r.data as any).data as Cliente[];
          }
          return [];
        }),

    getPage: (page: number, limit = 500, search?: string) =>
      http
        .get<PaginatedResponse<Cliente> | Cliente[]>('/clientes', { params: { page, limit, search } })
        .then((r) => {
          if (r.data && Array.isArray((r.data as any).data)) {
            return r.data as PaginatedResponse<Cliente>;
          }
          const items = Array.isArray(r.data) ? r.data : [];
          return {
            data: items,
            total: items.length,
            page,
            limit,
            totalPages: Math.ceil(items.length / limit) || 1,
          };
        }),

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

    addDireccion: (telefono: string, dto: { direccion: string, referencia?: string, costoDomicilio?: number, latitud?: number, longitud?: number } | string) =>
      http.post<ClienteDireccion>(`/clientes/${telefono}/direcciones`, typeof dto === 'string' ? { direccion: dto } : dto).then((r) => r.data),

    removeDireccion: (id: number) =>
      http.delete(`/clientes/direcciones/${id}`).then((r) => r.data),

    resetPassword: (telefono: string) =>
      http.post<{ message: string }>(`/clientes/${telefono}/reset-password`).then((r) => r.data),
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

    actualizarUbicacion: (latitud: number, longitud: number, capturadaEn?: number) =>
      http.patch('/domiciliarios/me/ubicacion', { latitud, longitud, capturadaEn }).then((r) => r.data),
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
    /** Sin `grupoId` trae los sabores de todos los grupos. */
    getAll: (grupoId?: number) =>
      http
        .get<PizzaSabor[]>('/pizza-sabores', { params: grupoId != null ? { grupoId } : undefined })
        .then((r) => arr<PizzaSabor>(r.data)),

    create: (data: Partial<PizzaSabor>) =>
      http.post<PizzaSabor>('/pizza-sabores', data).then((r) => r.data),

    update: (id: number, data: Partial<Omit<PizzaSabor, 'saborId'>>) =>
      http.patch<PizzaSabor>(`/pizza-sabores/${id}`, data).then((r) => r.data),

    delete: (id: number) =>
      http.delete(`/pizza-sabores/${id}`).then((r) => r.data),
  };

  // ─── Grupos de sabores ──────────────────────────────────────────────
  const saborGrupos = {
    getAll: () =>
      http.get<SaborGrupo[]>('/sabor-grupos').then((r) => arr<SaborGrupo>(r.data)),

    create: (data: GuardarSaborGrupoDto) =>
      http.post<SaborGrupo>('/sabor-grupos', data).then((r) => r.data),

    update: (id: number, data: Partial<GuardarSaborGrupoDto>) =>
      http.patch<SaborGrupo>(`/sabor-grupos/${id}`, data).then((r) => r.data),

    delete: (id: number) =>
      http.delete(`/sabor-grupos/${id}`).then((r) => r.data),
  };

  // ─── Empresa ────────────────────────────────────────────────────────
  const empresa = {
    get: () =>
      http.get<EmpresaConfig>('/empresa').then((r) => r.data),

    update: (data: UpdateEmpresaDto) =>
      http.patch<EmpresaConfig>('/empresa', data).then((r) => r.data),

    cuentasTransferencia: {
      getAll: () =>
        http.get<CuentaTransferencia[]>('/empresa/cuentas-transferencia').then((r) => arr<CuentaTransferencia>(r.data)),

      create: (nombre: string) =>
        http.post<CuentaTransferencia>('/empresa/cuentas-transferencia', { nombre }).then((r) => r.data),

      update: (id: number, data: { nombre?: string; activa?: boolean }) =>
        http.patch<CuentaTransferencia>(`/empresa/cuentas-transferencia/${id}`, data).then((r) => r.data),

      delete: (id: number) =>
        http.delete(`/empresa/cuentas-transferencia/${id}`).then((r) => r.data),
    },
  };

  // ─── Estadísticas ───────────────────────────────────────────────────
  const estadisticas = {
    clienteHistorial: (telefono: string) =>
      http.get<ClienteHistorial>(`/estadisticas/cliente/${telefono}/historial`).then((r) => r.data),
  };

  // ─── Domicilios ───────────────────────────────────────────────────
  const domicilios = {
    getMe: (all = false) =>
      http.get<any[]>('/domicilios/me', { params: all ? { all: true } : {} }).then((r) => arr<any>(r.data)),

    getAllDay: () =>
      http.get<any[]>('/domicilios/dia').then((r) => arr<any>(r.data)),

    getSinAsignar: () =>
      http.get<any[]>('/domicilios/sin-asignar').then((r) => arr<any>(r.data)),

    update: (id: number, data: any) =>
      http.patch<any>(`/domicilios/${id}`, data).then((r) => r.data),

    remove: (id: number) =>
      http.delete<any>(`/domicilios/${id}`).then((r) => r.data),
  };

  // ─── Cierres de Caja ───────────────────────────────────────────────
  const cierres = {
    /** `enviarEmail`: manda el reporte al REPORT_EMAIL (mismas secciones que la pantalla de cierre). */
    ejecutar: (fecha: string, observaciones?: string, enviarEmail?: boolean) =>
      http.post('/cierres', { fecha, observaciones, enviarEmail }).then((r) => r.data),

    /** Todos los cierres (uno por día); `limit` opcional para solo los últimos. */
    getHistory: (limit?: number) =>
      http.get<any[]>('/cierres', { params: limit ? { limit } : undefined }).then((r) => arr<any>(r.data)),

    delete: (id: string | number) =>
      http.delete(`/cierres/${id}`).then((r) => r.data),
  };

  // ─── Inventario unificado (cajas + bebidas embotelladas) ──────────
  const inventario = {
    /** ¿Terminó la migración? Mientras no, el resto responde 503. */
    estado: () => http.get<EstadoInventario>('/inventario/estado').then((r) => r.data),

    items: (params: { tipo?: TipoItemInventario; inactivos?: boolean } = {}) =>
      http.get<InventarioItem[]>('/inventario/items', { params }).then((r) => arr<InventarioItem>(r.data)),

    crearItem: (data: CrearItemInventarioDto) => http.post<InventarioItem>('/inventario/items', data).then((r) => r.data),

    actualizarItem: (id: number, data: ActualizarItemInventarioDto) =>
      http.patch<InventarioItem>(`/inventario/items/${id}`, data).then((r) => r.data),

    /** entrada/salida: cantidad > 0 · ajuste: delta con signo · conteo: lo contado (fija el valor). */
    mover: (id: number, data: { tipo: TipoMovimientoManual; cantidad: number; nota?: string }) =>
      http.post<InventarioItem>(`/inventario/items/${id}/movimientos`, data).then((r) => r.data),

    movimientos: (params: { itemId?: number; tipoItem?: TipoItemInventario; limit?: number; offset?: number } = {}) =>
      http.get<MovimientosInventarioPagina>('/inventario/movimientos', { params }).then((r) => r.data),

    reglas: (params: { itemId?: number; varianteId?: number } = {}) =>
      http.get<InventarioRegla[]>('/inventario/reglas', { params }).then((r) => arr<InventarioRegla>(r.data)),

    sugerencias: () =>
      http.get<SugerenciaReglaCaja[]>('/inventario/reglas/sugerencias').then((r) => arr<SugerenciaReglaCaja>(r.data)),

    guardarRegla: (data: GuardarReglaInventarioDto) => http.post<{ id: number }>('/inventario/reglas', data).then((r) => r.data),

    eliminarRegla: (id: number) => http.delete(`/inventario/reglas/${id}`).then((r) => r.data),
  };

  const cajaDenominaciones = {
    getEstado: (fecha?: string, cajaOrigen: 'principal' | 'gastos' = 'principal') =>
      http.get<DenominacionesMap>('/caja-movimientos/estado', { params: { ...(fecha ? { fecha } : {}), cajaOrigen } }).then((r) => r.data),

    getResumen: (fecha?: string, cajaOrigen: 'principal' | 'gastos' = 'principal') =>
      http.get<CajaResumen>('/caja-movimientos/resumen', { params: { ...(fecha ? { fecha } : {}), cajaOrigen } }).then((r) => r.data),

    getMovimientos: (fecha?: string, cajaOrigen: 'principal' | 'gastos' = 'principal') =>
      http.get<CajaMovimiento[]>('/caja-movimientos', { params: { ...(fecha ? { fecha } : {}), cajaOrigen } }).then((r) => arr<CajaMovimiento>(r.data)),

    apertura: (denominaciones: DenominacionesMap, descripcion?: string, cajaOrigen: 'principal' | 'gastos' = 'principal') =>
      http.post<CajaMovimiento>('/caja-movimientos/apertura', { denominaciones, descripcion, cajaOrigen }).then((r) => r.data),

    ajuste: (data: { tipo: 'entrada' | 'salida' | 'cambio'; denominaciones: DenominacionesMap; descripcion: string; fecha?: string; cajaOrigen?: 'principal' | 'gastos' }) =>
      http.post<CajaMovimiento>('/caja-movimientos/ajuste', { cajaOrigen: 'principal', ...data }).then((r) => r.data),
  };

  /**
   * Query params de analítica: las listas viajan unidas por comas (?tipoPedido=mesa,domicilio)
   * — es lo que entiende el DTO del backend sin depender del parser de query de Express.
   */
  const paramsAnalitica = (filtros: object) => {
    const params: Record<string, string | number | boolean> = {};
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor == null || valor === '') continue;
      if (Array.isArray(valor)) {
        if (valor.length) params[clave] = valor.join(',');
      } else if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
        params[clave] = valor;
      }
    }
    return params;
  };

  const analitica = {
    resumen: (filtros: FiltrosAnalitica) =>
      http.get<ResumenAnalitica>('/estadisticas/analitica/resumen', { params: paramsAnalitica(filtros) }).then((r) => r.data),
    productos: (
      filtros: FiltrosAnalitica & { agrupar?: AgrupacionProductos; orden?: OrdenProductos; limit?: number; offset?: number; q?: string },
    ) => http.get<ProductosAnalitica>('/estadisticas/analitica/productos', { params: paramsAnalitica(filtros) }).then((r) => r.data),
    sabores: (filtros: FiltrosAnalitica & { metrica?: MetricaSabor; limit?: number }) =>
      http.get<SaboresAnalitica>('/estadisticas/analitica/sabores', { params: paramsAnalitica(filtros) }).then((r) => r.data),
    saboresMatriz: (filtros: FiltrosAnalitica & { metrica?: MetricaSabor }) =>
      http.get<MatrizSaboresAnalitica>('/estadisticas/analitica/sabores/matriz', { params: paramsAnalitica(filtros) }).then((r) => r.data),
    combinaciones: (filtros: FiltrosAnalitica & { limit?: number }) =>
      http
        .get<CombinacionesAnalitica>('/estadisticas/analitica/sabores/combinaciones', { params: paramsAnalitica(filtros) })
        .then((r) => r.data),
    serie: (filtros: FiltrosAnalitica & { granularidad?: GranularidadSerie }) =>
      http.get<SerieAnalitica>('/estadisticas/analitica/serie', { params: paramsAnalitica(filtros) }).then((r) => r.data),
    horarios: (filtros: FiltrosAnalitica) =>
      http.get<HorariosAnalitica>('/estadisticas/analitica/horarios', { params: paramsAnalitica(filtros) }).then((r) => r.data),
    mix: (filtros: FiltrosAnalitica) =>
      http.get<MixAnalitica>('/estadisticas/analitica/mix', { params: paramsAnalitica(filtros) }).then((r) => r.data),
    /** Paginado en el servidor: `limit`/`offset` y `orden`; `total` y `resumen` son de TODO el período. */
    clientes: (filtros: FiltrosAnalitica & { limit?: number; offset?: number; orden?: OrdenClientesAnalitica; telefonos?: string[] }) =>
      http.get<ClientesAnalitica>('/estadisticas/analitica/clientes', { params: paramsAnalitica(filtros) }).then((r) => r.data),
    domiciliarios: (filtros: FiltrosAnalitica) =>
      http.get<DomiciliariosAnalitica>('/estadisticas/analitica/domiciliarios', { params: paramsAnalitica(filtros) }).then((r) => r.data),
    opciones: () => http.get<OpcionesAnalitica>('/estadisticas/analitica/opciones').then((r) => r.data),
    calidadDatos: () => http.get<CalidadDatosAnalitica>('/estadisticas/analitica/calidad-datos').then((r) => r.data),
    /** Resumen de dinero (ventas, gastos, balance). Para todo el staff, no solo analítica. */
    resumenGeneral: (from: string, to: string) =>
      http.get<ResumenGeneral>('/estadisticas/resumen', { params: { from, to } }).then((r) => r.data),
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
    saborGrupos,
    estadisticas,
    analitica,
    empresa,
    inventario,
    cajaDenominaciones,
    http,
  };
}

export type Api = ReturnType<typeof createApi>;

// ─── Shared singleton instances ────────────────────────────────────────────────
const defaultBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
export const http = createHttpClient({ baseURL: defaultBaseUrl });
export const api = createApi(http);

