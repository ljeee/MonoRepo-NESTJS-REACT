// ─── Productos ────────────────────────────────────────────────────────────────

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

// ─── Clientes ─────────────────────────────────────────────────────────────────

export interface Cliente {
  telefono: string;
  clienteNombre?: string;
  direccion?: string;
  direccionDos?: string;
  direccionTres?: string;
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
  cantidad: number;
  precioUnitario?: number;
  subtotal?: number;
  varianteId?: number;
}

export interface Orden {
  ordenId: number;
  facturaId?: number;
  tipoPedido: string;
  estadoOrden: string;
  fechaOrden: string;
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
  productos?: FacturaOrdenProducto[];
}

export interface FacturaVenta {
  facturaId?: number;
  clienteNombre?: string;
  descripcion?: string;
  fechaFactura?: string;
  estado?: string;
  metodo?: string;
  total?: number;
  ordenes?: FacturaOrden[];
}

export interface FacturaStats {
  totalDia: number;
  totalPagado: number;
  totalPendiente: number;
  count: number;
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
}

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
}

export interface CreateOrdenDto {
  tipoPedido: string;
  estadoOrden?: string;
  fechaOrden?: string;
  telefonoCliente?: string;
  nombreCliente?: string;
  direccionCliente?: string;
  telefonoDomiciliario?: string;
  metodo?: string;
  productos?: CreateOrdenProductoDto[];
}

export interface CreateFacturaPagoDto {
  total?: number;
  nombreGasto?: string;
  descripcion?: string;
  estado?: string;
  fechaFactura?: string;
  metodo?: string;
}

export interface CreateClienteDto {
  telefono: string;
  clienteNombre?: string;
  direccion?: string;
  direccionDos?: string;
  direccionTres?: string;
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
