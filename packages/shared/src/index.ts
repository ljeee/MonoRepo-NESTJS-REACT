// ─── Types ────────────────────────────────────────────────────────────────────
export * from './types/models';

// ─── Services ─────────────────────────────────────────────────────────────────
export { createHttpClient, createApi, setAuthToken, setApiBaseUrl } from './services/api';
export type { ApiConfig, Api } from './services/api';

// ─── Contexts ─────────────────────────────────────────────────────────────────
export { ToastProvider, useToast } from './contexts/ToastContext';
export type { Toast, ToastVariant } from './contexts/ToastContext';

export { OrderProvider, useOrder, defaultOrderFormState } from './contexts/OrderContext';
export type { OrderFormState, OrderContextType, OrderStorageAdapter } from './contexts/OrderContext';

export { ApiProvider, useApi } from './contexts/ApiContext';
export type { ApiProviderProps } from './contexts/ApiContext';

export { OfflineQueueProvider, useOfflineQueue } from './contexts/OfflineQueueContext';
export type { OfflinePayment, OfflineQueueStorageAdapter } from './contexts/OfflineQueueContext';

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
export { useFacturasDia, useFacturasRango } from './hooks/use-facturas';
export { useFacturasPagosScreen, todayISO } from './hooks/use-facturas-pagos-screen';
export { useGestionProductosScreen } from './hooks/use-gestion-productos-screen';
export { useOrdenesSocket } from './hooks/use-ordenes-socket';
export * from './utils/format';
export * from './utils/dateRange';
export * from './utils/productEmojis';
export { mapOrdenToForm } from './utils/orderMapper';
