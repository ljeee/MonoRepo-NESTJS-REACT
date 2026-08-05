// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  ProductoVariante, Personalizacion, Producto, ClienteDireccion, Cliente, Domiciliario,
  OrdenProducto, Orden, PaginatedResponse, Domicilio, FacturaOrdenProducto, FacturaOrden,
  FacturaDomicilio, FacturaVenta, FacturaStats, DenominacionesMap, CajaMovimiento,
  CajaResumen, FacturaPago, OrderCartItem, CartItem, CreateOrdenProductoDto,
  CreateOrdenDto, CreateFacturaPagoDto, CreateClienteDto, CreateDomiciliarioDto,
  FindOrdenesParams, RegisterDto, AuthTokens, AuthUser, AuthResponse, PizzaSabor,
  ProductoTop, SaborTop, VentaHora, VentaDia, MetodoPago, ResumenPeriodo, ClienteFrecuente,
  VarianteTop, ClienteHistorial, EmpresaConfig, UpdateEmpresaDto, CuentaTransferencia, InventarioCaja,
  InventarioCajasMovimiento, CrearCajaDto, AjustarCajasDto, CategoriaBebida, Ingrediente,
  VarianteIngrediente, BebidaMovimiento, CreateIngredienteDto, VincularVarianteDto
} from './types/models';
export { DENOMINACIONES_COP, Role } from './types/models';

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
export {
  useCreateFacturaPago,
  useFacturasPagosDia,
  useFacturasPagosRango,
  useUpdateFacturaPago,
  useDeleteFacturaPago,
} from './hooks/use-create-factura-pago';
export { useFacturasDia, useFacturasRango, calcStats, mapFactura } from './hooks/use-facturas';
export { useFacturasPagosScreen, todayISO } from './hooks/use-facturas-pagos-screen';
export { useGestionProductosScreen } from './hooks/use-gestion-productos-screen';
export { useOrdenesSocket } from './hooks/use-ordenes-socket';
export { formatCurrency, formatDate, formatDateShort, formatCompactCurrency } from './utils/format';
export type { DateRangeValidationResult } from './utils/dateRange';
export { validateFlexibleDateRange, getRangeDates, getLocalDateString } from './utils/dateRange';
export { getProductEmoji } from './utils/productEmojis';
export { normalizePhone, toDialablePhone, toWhatsappPhone, formatPhoneDisplay, COUNTRY_CODE } from './utils/phone';
export { resolverPersonalizacion, PERSONALIZACION_OPCIONES } from './utils/personalizacion';
export { mapOrdenToForm } from './utils/orderMapper';
