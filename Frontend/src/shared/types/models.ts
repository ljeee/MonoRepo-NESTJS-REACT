// ─── Productos ────────────────────────────────────────────────────────────────

export interface ProductoVariante {
  varianteId: number;
  nombre: string;
  precio: number;
  /** Precio cuando el jugo se pide con leche. Si es null/undefined, la variante no ofrece opción de base. */
  precioLeche?: number | null;
  descripcion?: string;
  activo: boolean;
  /** Stock físico de unidades de bebida (gaseosas/jugos) */
  stockBebida?: number;
}

export interface Producto {
  productoId: number;
  productoNombre: string;
  descripcion?: string;
  activo: boolean;
  emoji?: string;
  variantes: ProductoVariante[];
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

export interface ClienteDireccion {
  id: number;
  telefonoCliente: string;
  direccion: string;
}

export interface Cliente {
  telefono: string;
  clienteNombre?: string;
  tipoDocumento?: string;
  documento?: string;
  correo?: string;
  direcciones?: ClienteDireccion[];
}

// ─── Domiciliarios ────────────────────────────────────────────────────────────

export interface Domiciliario {
  telefono: string;
  domiciliarioNombre?: string;
}

// ─── Ordenes ──────────────────────────────────────────────────────────────────

export interface OrdenProducto {
  id?: number;
  producto: string;            // text field: "Pizza - Mediana (De Casa + Napolitana)"
  productoNombre?: string;
  cantidad: number;
  precioUnitario?: number;
  subtotal?: number;
  varianteId?: number;
  sabor1?: string;
  sabor2?: string;
  sabor3?: string;
  sabores?: string[];          // Added for frontend mapping and diff tracking
}

export interface Orden {
  ordenId: number;
  facturaId?: number;
  tipoPedido: string;
  estadoOrden: string;
  fechaOrden: string;
  nombreCliente?: string;
  telefonoCliente?: string;
  mesa?: string;
  observaciones?: string;
  productos?: OrdenProducto[];
  factura?: FacturaVenta;
  domicilios?: Domicilio[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Domicilios ───────────────────────────────────────────────────────────────

export interface Domicilio {
  domicilioId: number;
  fechaCreado?: string;
  facturaId?: number;
  ordenId?: number;
  telefono?: string;
  telefonoDomiciliarioAsignado?: string;
  direccionEntrega?: string;
  estadoDomicilio?: string;
  costoDomicilio?: number;
  assignedUserId?: string;
}

// ─── Facturas Ventas ──────────────────────────────────────────────────────────

export interface FacturaOrdenProducto {
  cantidad?: number;
  precioUnitario?: number;
  subtotal?: number;
  productoNombre?: string;    // resolved from text field 'producto' 
}

export interface FacturaOrden {
  ordenId?: number;
  tipoPedido?: string;
  productos?: FacturaOrdenProducto[];
}

export interface FacturaDomicilio {
  costoDomicilio?: number;
  direccionEntrega?: string;
  telefono?: string;
}

export interface FacturaVenta {
  facturaId?: number;
  clienteNombre?: string;
  telefonoCliente?: string | null;
  descripcion?: string;
  fechaFactura?: string;
  estado?: string;
  metodo?: string;
  pagoEfectivo?: number;
  pagoTransferencia?: number;
  total?: number;
  totalFactura?: number;
  denominaciones?: DenominacionesMap | null;
  /** Denominaciones entregadas como cambio al cliente (salida de caja) */
  cambioDenominaciones?: DenominacionesMap | null;
  /** Monto acumulado abonado en efectivo (parcial). Cuando alcanza total → estado pasa a pagado */
  montoPagado?: number;
  ordenes?: FacturaOrden[];
  domicilios?: FacturaDomicilio[];
}

export interface FacturaStats {
  totalDia: number;
  totalPagado: number;
  totalPendiente: number;
  count: number;
}

// ─── Denominaciones (Arqueada / Caja) ─────────────────────────────────────────

/** Mapa de denominación → cantidad. Ej: { "50000": 2, "10000": 3 } */
export type DenominacionesMap = Record<string, number>;

export const DENOMINACIONES_COP = [
  { valor: 200000, tipo: 'billete' as const, label: '$200.000' },
  { valor: 100000, tipo: 'billete' as const, label: '$100.000' },
  { valor: 50000,  tipo: 'billete' as const, label: '$50.000' },
  { valor: 20000,  tipo: 'billete' as const, label: '$20.000' },
  { valor: 10000,  tipo: 'billete' as const, label: '$10.000' },
  { valor: 5000,   tipo: 'billete' as const, label: '$5.000' },
  { valor: 2000,   tipo: 'billete' as const, label: '$2.000' },
] as const;

export interface CajaMovimiento {
  id: string;
  fecha: string;
  tipo: 'entrada' | 'salida' | 'apertura';
  denominaciones: DenominacionesMap;
  total: number;
  facturaVentaId?: number | null;
  facturaPagoId?: number | null;
  descripcion?: string | null;
  metodo?: string | null;
  pagoTransferencia?: number | null;
  createdAt: string;
}

export interface CajaResumen {
  fecha: string;
  estadoActual: DenominacionesMap;
  totalEfectivo: number;
  totalEntradas: number;
  totalSalidas: number;
  movimientos: CajaMovimiento[];
}

// ─── Facturas Pagos (Gastos) ──────────────────────────────────────────────────

export interface FacturaPago {
  pagosId?: number;
  total?: number;
  nombreGasto?: string;
  descripcion?: string;
  estado?: string;
  fechaFactura?: string;
  metodo?: string;
  categoria?: string;
  denominaciones?: DenominacionesMap | null;
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

export interface OrderCartItem {
  id: string;
  productoNombre: string;
  varianteNombre: string;
  varianteId: number;
  precioUnitario: number;
  cantidad: number;
  sabores?: string[];
  /** Base del jugo: 'leche' | 'agua'. Undefined para productos que no son jugo. */
  base?: 'leche' | 'agua';
}

/** @deprecated Use OrderCartItem instead */
export type CartItem = OrderCartItem;

// ─── DTOs de creación ─────────────────────────────────────────────────────────

export interface CreateOrdenProductoDto {
  tipo: string;
  productoId?: number;
  varianteId?: number;
  tamano?: string;
  sabor1?: string;
  sabor2?: string;
  sabor3?: string;
  cantidad: number;
  base?: 'leche' | 'agua';
}

export interface CreateOrdenDto {
  tipoPedido: string;
  estadoOrden?: string;
  fechaOrden?: string;
  telefonoCliente?: string;
  nombreCliente?: string;
  direccionCliente?: string;
  telefonoDomiciliario?: string;
  costoDomicilio?: number;
  observaciones?: string;
  productos?: CreateOrdenProductoDto[];
}

export interface CreateFacturaPagoDto {
  total?: number;
  nombreGasto?: string;
  descripcion?: string;
  estado?: string;
  fechaFactura?: string;
  metodo?: string;
  categoria?: string;
  denominaciones?: DenominacionesMap;
}

export interface CreateClienteDto {
  telefono: string;
  clienteNombre?: string;
  tipoDocumento?: string;
  documento?: string;
  correo?: string;
}

export interface CreateDomiciliarioDto {
  telefono: string;
  domiciliarioNombre?: string;
}

export interface FindOrdenesParams {
  estado?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export enum Role {
  Admin = 'admin',
  Cocina = 'cocina',
  Mesero = 'mesero',
  Domiciliario = 'domiciliario',
  Cajero = 'cajero',
}

export interface RegisterDto {
  username: string;
  password: string;
  name?: string;
  roles?: Role[];
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  username: string;
  name?: string;
  roles: Role[];
  createdAt?: string;
}

export type AuthResponse = AuthTokens & AuthUser;

// ─── Pizza Sabores ────────────────────────────────────────────────────────────

export interface PizzaSabor {
  saborId: number;
  nombre: string;
  tipo: 'tradicional' | 'especial' | 'configuracion' | 'calzone';
  recargoPequena: number | string;
  recargoMediana: number;
  recargoGrande: number;
  activo: boolean;
}

// ─── Estadísticas ─────────────────────────────────────────────────────────────

export interface ProductoTop {
  producto: string;
  totalVendido: number;
  ingresos: number;
}

export interface SaborTop {
  sabor: string;
  cantidad: number;
}

export interface VentaHora {
  hora: number;
  cantidad: number;
  total: number;
}

export interface VentaDia {
  fecha: string;
  cantidad: number;
  total: number;
  ticketPromedio: number;
}

export interface MetodoPago {
  metodo: string;
  cantidad: number;
  total: number;
  porcentaje: number;
}

export interface ResumenPeriodo {
  totalVentas: number;
  totalEgresos: number;
  balanceNeto: number;
  facturas: number;
  ordenes: number;
  cancelados: number;
  ticketPromedio: number;
  tasaCancelacion: number;

  totalIngresosPagados?: number;
  totalIngresosPendientes?: number;
  countIngresosPagados?: number;
  countIngresosPendientes?: number;

  totalEgresosPagados?: number;
  totalEgresosPendientes?: number;
  countEgresosPagados?: number;
  countEgresosPendientes?: number;
}

export interface ClienteFrecuente {
  clienteNombre: string;
  totalOrdenes: number;
  gastoTotal: number;
  /** Valor del pedido individual más alto del cliente */
  pedidoMaximo: number;
  ultimaVisita: string;
}

export interface VarianteTop {
  variante: string;
  producto: string;
  totalVendido: number;
  ingresos: number;
}

export interface ClienteHistorial {
  totalOrdenes: number;
  completadas: number;
  canceladas: number;
  gastoTotal: number;
  ticketPromedio: number;
  productosTop: { nombre: string; cantidad: number }[];
  ultimaVisita: string | null;
  ordenes: {
    ordenId: number;
    fechaOrden: string;
    estadoOrden: string;
    tipoPedido: string;
    total: number;
  }[];
}

// ─── Empresa Config ───────────────────────────────────────────────────────────

export interface EmpresaConfig {
  id: number;
  nit: string;
  razonSocial: string;
  nombreComercial?: string;
  regimen: string;
  direccion?: string;
  telefono?: string;
  municipio?: string;
  departamento?: string;
  tarifaIva: number;
  updatedAt: string;
}

export interface UpdateEmpresaDto {
  nit?: string;
  razonSocial?: string;
  nombreComercial?: string;
  regimen?: string;
  direccion?: string;
  telefono?: string;
  municipio?: string;
  departamento?: string;
  tarifaIva?: number;
}

// ─── Inventario Cajas ─────────────────────────────────────────────────────────

export interface InventarioCaja {
  id: number;
  nombre: string;
  cantidad: number;
  alertaMinimo: number | null;
  enAlerta: boolean;
}

export interface InventarioCajasMovimiento {
  id: number;
  cajaId: number;
  cajaNombre: string;
  delta: number;
  cantidadResultante: number;
  tipo: 'entrada' | 'salida' | 'ajuste';
  nota: string | null;
  creadoEn: string;
}

export interface CrearCajaDto {
  nombre: string;
  cantidad?: number;
  alertaMinimo?: number;
}

export interface AjustarCajasDto {
  delta: number;
  tipo?: 'entrada' | 'salida' | 'ajuste';
  nota?: string;
}

// ─── Inventario Bebidas ────────────────────────────────────────────────────────

export type CategoriaBebida = 'pulpa' | 'jugo_directo' | 'gaseosa' | 'agua' | 'otro';

export interface Ingrediente {
  id: number;
  nombre: string;
  categoria: CategoriaBebida;
  unidad: string;
  stockActual: number;
  rendimientoPorUnidad: number;
  porcionesDisponibles: number;
  alertaMinimo: number | null;
  enAlerta: boolean;
  costo: number | null;
  activo: boolean;
  variantes?: VarianteIngrediente[];
}

export interface VarianteIngrediente {
  id: number;
  varianteId: number;
  ingredienteId: number;
  cantidadPorVenta: number;
}

/** Movimiento del ledger de stock por variante (gaseosas/jugos) */
export interface BebidaMovimiento {
  id: number;
  varianteId: number;
  varianteNombre: string;
  productoNombre: string;
  /** Lo solicitado (negativo en salida) */
  delta: number;
  /** Lo realmente movido tras clamp (si delta ≠ aplicado, se vendió sin stock) */
  aplicado: number;
  cantidadResultante: number;
  tipo: string; // 'salida' | 'entrada' | 'ajuste'
  nota: string | null;
  creadoEn: string;
}

export interface CreateIngredienteDto {
  nombre: string;
  categoria?: CategoriaBebida;
  unidad?: string;
  stockActual?: number;
  rendimientoPorUnidad?: number;
  alertaMinimo?: number;
  costo?: number;
}

export interface VincularVarianteDto {
  varianteId: number;
  ingredienteId: number;
  cantidadPorVenta: number;
}
