// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  ProductoVariante, Personalizacion, CategoriaProducto, TamanoPizza, Producto, ClienteDireccion, Cliente, Domiciliario,
  OrdenProductoSaborDetalle, OrdenProducto, Orden, PaginatedResponse, Domicilio, FacturaOrdenProducto, FacturaOrden,
  FacturaDomicilio, FacturaVenta, FacturaStats, DenominacionesMap, CajaMovimiento,
  CajaResumen, FacturaPago, OrderCartItem, CartItem, CreateOrdenProductoDto,
  CreateOrdenDto, CreateFacturaPagoDto, CreateClienteDto, CreateDomiciliarioDto,
  FindOrdenesParams, RegisterDto, AuthTokens, AuthUser, AuthResponse, PizzaSabor, SaborGrupo, GuardarSaborGrupoDto,
  ClienteHistorial, ClienteHistorialProducto, ClienteHistorialOrden, ClienteProductoFavorito, ClienteSaborFavorito, EmpresaConfig, UpdateEmpresaDto, CuentaTransferencia, ParamsLibroDiario,
  DesgloseTransferencia, TipoGasto, FindFacturasPagosParams, CobradoPorCuenta, GastosPorTipo, GastosPorCategoria,
  ResultadoPeriodo, ProductoVendidoResumen, AjustesPrecioResumen, ProductoPorPrecio,
} from './types/models';
export type {
  TipoItemInventario, CategoriaCaja, CategoriaBebida, EstadoStock, TipoMovimientoManual, TipoMovimientoInventario,
  InventarioItem, InventarioMovimiento, MovimientosInventarioPagina, InventarioRegla, SugerenciaReglaCaja,
  EstadoInventario, CrearItemInventarioDto, ActualizarItemInventarioDto, GuardarReglaInventarioDto,
} from './types/models';
export type {
  TipoPedido, MetodoPagoFiltro, EstadoPagoFiltro, CanalOrden, FiltrosAnalitica, PeriodoAnalitica,
  KpisAnalitica, ResumenAnalitica, AgrupacionProductos, OrdenProductos, FilaProductoAnalitica, ProductosAnalitica,
  MetricaSabor, FilaSaborAnalitica, SaboresAnalitica, CeldaMetricaSabor, MatrizSaboresAnalitica, CombinacionesAnalitica,
  GranularidadSerie, PuntoSerieAnalitica, SerieAnalitica, HorariosAnalitica, MixAnalitica, ClientesAnalitica, OrdenClientesAnalitica,
  DomiciliariosAnalitica, OpcionesAnalitica, CalidadDatosAnalitica, ResumenGeneral,
} from './types/models';
export { DENOMINACIONES_COP, Role, CATEGORIAS_PRODUCTO, CATEGORIA_PRODUCTO_LABEL } from './types/models';

// ─── Domain ───────────────────────────────────────────────────────────────────
export {
  isCobrada,
  isAnulada,
  isParcial,
  isPendiente,
  cobrado,
  porCobrar,
  montoEfectivo,
  montoTransferencia,
  METODO_PAGO_META,
  resolverMetodoPago,
  getMetodoPagoMeta,
  ORDEN_ESTADO_META,
  getOrdenEstadoMeta,
  matchesMetodoFilter,
} from './domain/factura';
export {
  transferenciasPorCuenta,
  resumirFacturas,
  resumirGastos,
  isGastoPagado,
  tieneCobroTransferencia,
  nombreArchivoLibroDiario,
} from './domain/contabilidad';
export type { FacturaContable, GastoContable, ResumenFacturas, ResumenGastos } from './domain/contabilidad';
export {
  CATEGORIAS_GASTO,
  CATEGORIA_GENERAL,
  TIPO_GASTO_META,
  tipoPorCategoria,
  nombreCategoria,
  tipoDeGasto,
} from './constants/gastos';
export type { CategoriaGasto, TipoGastoFiltro } from './constants/gastos';
export type {
  FacturaMontosLike,
  MetodoPagoKey,
  MetodoPagoMeta,
  OrdenEstado,
  OrdenEstadoMeta,
  MethodFilterValue,
  FacturaMetodoLike,
} from './domain/factura';

// ─── Services ─────────────────────────────────────────────────────────────────
export { createHttpClient, createApi, setAuthToken, setApiBaseUrl, http, api } from './services/api';
export type { ApiConfig, Api } from './services/api';

// ─── Contexts ─────────────────────────────────────────────────────────────────
export { ToastProvider, useToast } from './contexts/ToastContext';
export type { Toast, ToastVariant } from './contexts/ToastContext';

export { OrderProvider, useOrder, defaultOrderFormState } from './contexts/OrderContext';
export type { OrderFormState, OrderContextType, OrderStorageAdapter, SlotSummary } from './contexts/OrderContext';

export { ApiProvider, useApi } from './contexts/ApiContext';
export type { ApiProviderProps } from './contexts/ApiContext';

export { OfflineQueueProvider, useOfflineQueue } from './contexts/OfflineQueueContext';
export type { OfflinePayment, OfflineQueueStorageAdapter } from './contexts/OfflineQueueContext';

export { AuthProvider, useAuth } from './contexts/AuthContext';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useAntiDebounce } from './hooks/useAntiDebounce';
export { useClientesList } from './hooks/use-clientes-list';
export { useClientByPhone } from './hooks/use-client-by-phone';
export { useProductos, useProductOperations } from './hooks/use-productos';
export { useCreateOrder } from './hooks/use-create-order';
export { useDomiciliariosList } from './hooks/use-domiciliarios-list';
export { usePizzaSabores, useUpdatePizzaSabor } from './hooks/use-pizza-sabores';
export { useSaborGrupos } from './hooks/use-sabor-grupos';
export {
  useCreateFacturaPago,
  useFacturasPagosDia,
  useFacturasPagosRango,
  useUpdateFacturaPago,
  useDeleteFacturaPago,
} from './hooks/use-create-factura-pago';
export { useFacturasDia, useFacturasRango, calcStats, mapFactura, SIN_LIMITE } from './hooks/use-facturas';
export { useFacturasPagosScreen, todayISO } from './hooks/use-facturas-pagos-screen';
export { useGestionProductosScreen } from './hooks/use-gestion-productos-screen';
export { useOrdenesSocket } from './hooks/use-ordenes-socket';
export type { UseOrdenesSocketOptions } from './hooks/use-ordenes-socket';
export { formatCurrency, formatCOP, timeAgo, formatDate, formatDateShort, formatCompactCurrency } from './utils/format';
export type { DateRangeValidationResult } from './utils/dateRange';
export { validateFlexibleDateRange, getRangeDates, getLocalDateString } from './utils/dateRange';
export type { PresetRango, RangoFechas } from './utils/date';
export { bogotaToday, shiftISO, presetRange } from './utils/date';
export { getProductEmoji } from './utils/productEmojis';
export { BILLETES_COP, sumDenominaciones } from './utils/denominaciones';
export { traerTodasLasPaginas, traerPorCursor, ordenarRecientesPrimero, LOTE_PAGINA } from './utils/paginas';
export { consultarConCooldown, invalidarConsultas, claveConsulta, COOLDOWN_BUSQUEDA_MS, MINIMO_RECARGA_MS } from './utils/consultas';
export type { ResultadoConsulta } from './utils/consultas';
export { tamanoDeVariante, getRecargoSabor, getRecargoPorCantidad, calcularRecargoSabores } from './utils/sabores';
export type { TamanoVariante } from './utils/sabores';
export { minutosDesde, urgenciaOrden, TIPO_PEDIDO_META, tipoPedidoMeta, nombreVisibleOrden } from './utils/orden';
export type { NivelUrgencia } from './utils/orden';
export { normalizePhone, toDialablePhone, toWhatsappPhone, formatPhoneDisplay, COUNTRY_CODE } from './utils/phone';
export { resolverPersonalizacion, PERSONALIZACION_OPCIONES } from './utils/personalizacion';
export { mapOrdenToForm } from './utils/orderMapper';
