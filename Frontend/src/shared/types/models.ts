// ─── Productos ────────────────────────────────────────────────────────────────

export interface ProductoVariante {
  varianteId: number;
  nombre: string;
  precio: number;
  /** Precio cuando el jugo se pide con leche. Si es null/undefined, la variante no ofrece opción de base. */
  precioLeche?: number | null;
  descripcion?: string;
  activo: boolean;
  /** Tamaño explícito (productos cuyo grupo de sabores usa tamaños). null = se deduce del nombre. */
  tamano?: TamanoPizza | null;
  /** @deprecated Inventario anterior; el stock vive en `InventarioItem`. Se quita en la limpieza final. */
  stockBebida?: number;
  /** @deprecated Ver stockBebida. */
  categoriaBebida?: string | null;
  /** @deprecated Ver stockBebida. */
  alertaBebida?: number | null;
  /** @deprecated Ver stockBebida. */
  nivelObjetivoBebida?: number | null;
}

export type Personalizacion = 'pizza' | 'calzone' | 'jugo' | 'ninguna';

/** Categorías de catálogo (analítica e inventario). Espejo de `common/utils/catalogo.util` del backend. */
export const CATEGORIAS_PRODUCTO = ['pizza', 'calzone', 'bebida', 'jugo', 'adicion', 'comida', 'otro'] as const;
export type CategoriaProducto = (typeof CATEGORIAS_PRODUCTO)[number];

export const CATEGORIA_PRODUCTO_LABEL: Record<CategoriaProducto, string> = {
  pizza: 'Pizza',
  calzone: 'Calzone',
  bebida: 'Bebida',
  jugo: 'Jugo',
  adicion: 'Adición',
  comida: 'Comida',
  otro: 'Otro',
};

/** Tamaño normalizado de una pizza vendida (`personal` cuenta como `pequena`). */
export type TamanoPizza = 'pequena' | 'mediana' | 'grande';

export interface Producto {
  productoId: number;
  productoNombre: string;
  descripcion?: string;
  activo: boolean;
  emoji?: string;
  /** 'jugo' abre el modal de base; 'ninguna' agrega directo. Los sabores ya no van aquí: ver `saborGrupoId`. */
  personalizacion?: string | null;
  /** Grupo de sabores que ofrece el producto (Pizza, Calzone…). null = el producto no lleva sabores. */
  saborGrupoId?: number | null;
  /** Categoría para analítica. null = sin configurar (el backend la deduce del nombre). */
  categoria?: CategoriaProducto | null;
  variantes: ProductoVariante[];
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

export interface ClienteDireccion {
  id: number;
  telefonoCliente: string;
  direccion: string;
  referencia?: string;
  costoDomicilio?: number;
  latitud?: number;
  longitud?: number;
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
  userId?: string;
  /** Última posición GPS reportada por RiderApp mientras la app está abierta */
  ultimaLatitud?: number;
  ultimaLongitud?: number;
  ultimaUbicacionFecha?: string;
  user?: {
    id: string;
    username: string;
    name?: string;
  };
}

// ─── Ordenes ──────────────────────────────────────────────────────────────────

/** Un sabor de una línea de pizza/calzone (una fila por sabor). */
export interface OrdenProductoSaborDetalle {
  id: string;                  // bigint: llega como string
  /** null = sabor no reconocido en el catálogo ("sin clasificar") o ya borrado */
  saborId: number | null;
  /** Snapshot del nombre al vender (sobrevive a renombrar o borrar el sabor) */
  saborNombre: string;
  posicion: number;
  /** 1/n de la pizza (mitad y mitad = 0.5) */
  fraccion: number;
}

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
  // ── Detalle estructurado (analítica). Las líneas del histórico pueden no traerlo:
  //    el texto `producto` sigue siendo la fuente para mostrar la línea.
  productoId?: number | null;
  /** Nombre del producto al vender (no se llama `productoNombre`: ese lo leen pantallas que esperan el texto completo) */
  productoBase?: string | null;
  varianteNombre?: string | null;
  /** Solo pizzas */
  tamano?: TamanoPizza | null;
  categoria?: string | null;
  /** Precio calculado (variante + recargos) antes de cualquier precio manual */
  precioLista?: number | null;
  /** true si el cajero fijó el precio a mano. null = desconocido (histórico) */
  precioManual?: boolean | null;
  saboresDetalle?: OrdenProductoSaborDetalle[];
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
  costoDomicilio?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Paginación por cursor: id para pedir la tanda siguiente (null = no hay más; ausente = el servidor no la usa). */
  siguiente?: string | null;
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
  referenciaDomicilio?: string;
  estadoDomicilio?: string;
  costoDomicilio?: number;
  latitud?: number;
  longitud?: number;
  assignedUserId?: string;
  domiciliario?: {
    domiciliarioNombre?: string;
    telefono?: string;
  };
  orden?: Orden;
  cliente?: Cliente;
  factura?: FacturaVenta;
}

// ─── Facturas Ventas ──────────────────────────────────────────────────────────

export interface FacturaOrdenProducto {
  cantidad?: number;
  precioUnitario?: number;
  subtotal?: number;
  productoNombre?: string;    // resolved from text field 'producto'
  /** El cajero fijó el precio a mano (precio desactualizado, adición fuera del menú…). */
  precioManual?: boolean;
  /** Precio del menú calculado al vender (variante + recargos); null = línea antigua sin dato. */
  precioLista?: number | null;
}

export interface FacturaOrden {
  ordenId?: number;
  tipoPedido?: string;
  productos?: FacturaOrdenProducto[];
}

export interface FacturaDomicilio {
  costoDomicilio?: number;
  direccionEntrega?: string;
  referencia?: string;
  telefono?: string;
  domiciliario?: {
    domiciliarioNombre?: string;
    telefono?: string;
  };
}

export interface FacturaVenta {
  facturaId?: number;
  clienteNombre?: string;
  telefonoCliente?: string | null;
  descripcion?: string;
  fechaFactura?: string;
  /** Momento en que la factura quedó saldada (completar o último abono). */
  fechaCobro?: string | null;
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
  cuentaTransferenciaId?: number | null;
  cuentaTransferenciaNombre?: string | null;
  /**
   * Cuánto de lo cobrado por QR entró a cada cuenta. Solo lo llenan los abonos por QR (una factura
   * puede abonarse a cuentas distintas); null = todo a `cuentaTransferencia*`.
   */
  desgloseTransferencia?: DesgloseTransferencia[] | null;
  ordenes?: FacturaOrden[];
  domicilios?: FacturaDomicilio[];
}

/** Parte de una transferencia que entró a una cuenta (cuentaId/cuenta null = sin asignar). */
export interface DesgloseTransferencia {
  cuentaId: number | null;
  cuenta: string | null;
  monto: number;
}

export interface CuentaTransferencia {
  id: number;
  nombre: string;
  activa: boolean;
  createdAt?: string;
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
  /** Categoría contable (nomina, servicios, insumos…); 'general' = sin categoría (histórico). */
  categoria?: string;
  /** 'costo' | 'gasto'. Sin valor = sin clasificar (egresos anteriores a la clasificación). */
  tipoGasto?: TipoGasto | null;
  /** Cuenta de transferencia de la que salió un egreso pagado por QR. null = sin asignar. */
  cuentaOrigenId?: number | null;
  denominaciones?: DenominacionesMap | null;
}

export type TipoGasto = 'costo' | 'gasto';

// ─── Cart ─────────────────────────────────────────────────────────────────────

export interface OrderCartItem {
  id: string;
  productoNombre: string;
  varianteNombre: string;
  varianteId: number;
  /** Precio calculado desde la variante (+ recargo de base leche). Solo referencia. */
  precioUnitario: number;
  /**
   * Precio manual fijado por el cajero (descuento, precio pactado, cortesía).
   * Cuando existe, es el que se cobra y el que se envía al backend — el backend
   * entonces NO aplica sus recargos por sabor. Si es undefined, el backend
   * calcula el precio completo (variante + recargos).
   */
  precioOverride?: number;
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
  /**
   * Precio manual por unidad. Si viene, el backend lo usa tal cual y NO aplica
   * sus recargos por sabor/tamaño. Se envía solo cuando el cajero editó el
   * precio; el backend lo ignora para el rol `cliente`.
   */
  precioUnitario?: number;
}

export interface CreateOrdenDto {
  tipoPedido: string;
  estadoOrden?: string;
  fechaOrden?: string;
  telefonoCliente?: string;
  nombreCliente?: string;
  direccionId?: number;
  direccionCliente?: string;
  referenciaDomicilio?: string;
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
  tipoGasto?: TipoGasto;
  /** Obligatoria cuando `metodo` es 'qr'. */
  cuentaOrigenId?: number | null;
  denominaciones?: DenominacionesMap;
}

/** Filtros de GET /facturas-pagos. Sin `limit` (o limit=0) devuelve TODO el rango. */
export interface FindFacturasPagosParams {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  /** 'costo' | 'gasto' | 'sin_clasificar' */
  tipo?: string;
  categoria?: string;
  /** 'pagado' | 'pendiente' */
  estado?: string;
  /** Paginación por clave: 'inicio' y luego el `siguiente` de cada respuesta. */
  cursor?: string;
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
  Cliente = 'cliente',
  Contador = 'contador',
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

/**
 * Grupo de sabores: el conjunto de sabores de un producto y las reglas de cómo se piden y cobran.
 * Un producto nuevo con sabores se configura asignándole un grupo, sin tocar código.
 */
export interface SaborGrupo {
  id: number;
  nombre: string;
  /** Tope de sabores por unidad (pizza 3, calzone 2). */
  maxSabores: number;
  /** Las variantes del producto SON los sabores (calzone). */
  varianteEsSabor: boolean;
  /** El producto tiene tamaños: se cobra el recargo del sabor según el tamaño. */
  usaTamano: boolean;
  /** Desde cuántos sabores se cobra el recargo extra. null = nunca. */
  recargoExtraDesde: number | null;
  recargoExtraPequena: number;
  recargoExtraMediana: number;
  recargoExtraGrande: number;
  activo: boolean;
  orden: number;
}

export type GuardarSaborGrupoDto = Partial<Omit<SaborGrupo, 'id'>> & { nombre: string };

export interface PizzaSabor {
  saborId: number;
  nombre: string;
  /** Grupo al que pertenece. null = sabor sin clasificar (no se ofrece al pedir). */
  grupoId: number | null;
  /** Recargo por tamaño; 0 = no cobra. Un grupo sin tamaños usa solo `recargoGrande`. */
  recargoPequena: number | string;
  recargoMediana: number | string;
  recargoGrande: number | string;
  activo: boolean;
  /** @deprecated Clasificación anterior (tradicional/especial). Ya no se usa. */
  tipo?: string;
}

// ─── Estadísticas ─────────────────────────────────────────────────────────────

export interface ClienteHistorialProducto {
  id?: number;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  tamano?: string | null;
  categoria?: string | null;
}

export interface ClienteHistorialOrden {
  /** Null en facturas importadas que no tienen orden. */
  ordenId: number | null;
  fechaOrden: string;
  estadoOrden: string | null;
  tipoPedido: string | null;
  canal?: string | null;
  total: number;
  /** Lo cobrado de la factura (abonos incluidos) y lo que falta. */
  cobrado?: number;
  porCobrar?: number;
  facturaId: number;
  metodo?: string | null;
  estadoFactura?: string | null;
  observaciones?: string | null;
  productos: ClienteHistorialProducto[];
}

export interface ClienteSaborFavorito {
  nombre: string;
  pizzas: number;
}

export interface ClienteProductoFavorito {
  nombre: string;
  cantidad: number;
  gastoTotal: number;
}

export interface ClienteHistorial {
  totalOrdenes: number;
  completadas: number;
  canceladas: number;
  /** Facturado en ventas válidas (mismas definiciones que la lista de clientes y la analítica). */
  gastoTotal: number;
  cobrado?: number;
  /** Lo que el cliente debe (saldo de facturas pendientes y abonadas). */
  porCobrar?: number;
  ticketPromedio: number;
  pedidoMaximo?: number;
  primeraVisita?: string | null;
  productosTop: ClienteProductoFavorito[];
  saboresTop?: ClienteSaborFavorito[];
  ultimaVisita: string | null;
  /** Cada cuántos días pide, en promedio. */
  diasEntrePedidos?: number | null;
  tipoPedidoFavorito?: string | null;
  canalFavorito?: string | null;
  tamanoHabitual?: string | null;
  /** Hay más órdenes que las listadas (las cifras sí las incluyen todas). */
  hayMasOrdenes?: boolean;
  ordenes: ClienteHistorialOrden[];
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
  recargoLeche?: number;
  /** Control de caja por arqueo (solo el admin lo cambia). Apagado: cobros sin desglose de cambio. */
  arqueoCaja?: boolean;
  /** Último momento en que el admin encendió el arqueo: un conteo anterior ya no vale. */
  arqueoDesde?: string | null;
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
  recargoLeche?: number;
  arqueoCaja?: boolean;
  /** Correo(s) del contador separados por coma ('' = no enviarle el libro diario). */
  correoContador?: string;
}

/** GET /contabilidad/libro-diario: el libro lo arma el servidor (el mismo que recibe el contador en cada cierre). */
export interface ParamsLibroDiario {
  from: string;
  to: string;
  /** solo_transferencias = «Transferencias y mixto» (facturas con alguna parte por QR, completas). */
  filtro?: 'completo' | 'solo_transferencias' | 'cuenta_especifica';
  cuentaId?: number;
}

// ─── Inventario unificado (/inventario/*) ────────────────────────────────────
// Espejo de Backend/src/inventario. Cajas y bebidas embotelladas comparten modelo.

export type TipoItemInventario = 'caja' | 'bebida';
export type CategoriaCaja = 'pequena' | 'mediana' | 'grande' | 'calzone' | 'otra';
export type CategoriaBebida = 'gaseosa' | 'agua' | 'cerveza' | 'otra';
export type EstadoStock = 'ok' | 'bajo' | 'critico';
export type TipoMovimientoManual = 'entrada' | 'salida' | 'ajuste' | 'conteo';
export type TipoMovimientoInventario = TipoMovimientoManual | 'venta' | 'devolucion' | 'migracion';

export interface InventarioItem {
  id: number;
  tipo: TipoItemInventario;
  nombre: string;
  /** CategoriaCaja | CategoriaBebida ('jugo' solo en inactivos migrados). */
  categoria: string | null;
  cantidad: number;
  alertaMinimo: number | null;
  nivelObjetivo: number | null;
  activo: boolean;
  /** Lo calcula el servidor (misma regla para píldora, número y medidor). */
  estado: EstadoStock;
  reglas: number;
  /** Reglas creadas por la migración, pendientes de revisar. */
  reglasAuto: number;
  actualizadoEn: string;
}

export interface InventarioMovimiento {
  id: number;
  itemId: number;
  itemNombre: string;
  itemTipo: TipoItemInventario;
  tipo: TipoMovimientoInventario;
  /** Lo pedido (negativo en salidas). */
  delta: number;
  /** Lo que de verdad se movió; si difiere de delta, se vendió sin stock. */
  aplicado: number;
  cantidadResultante: number;
  ordenId: number | null;
  nota: string | null;
  creadoEn: string;
  usuarioNombre: string | null;
}

export interface MovimientosInventarioPagina {
  total: number;
  limit: number;
  offset: number;
  filas: InventarioMovimiento[];
}

export interface InventarioRegla {
  id: number;
  itemId: number;
  itemNombre: string;
  itemTipo: TipoItemInventario;
  varianteId: number;
  varianteNombre: string;
  productoNombre: string;
  cantidad: number;
  soloParaLlevar: boolean;
  origen: 'auto' | 'manual';
}

export interface SugerenciaReglaCaja {
  varianteId: number;
  varianteNombre: string;
  productoNombre: string;
  categoriaCaja: Exclude<CategoriaCaja, 'otra'>;
  cajaSugerida: { id: number; nombre: string } | null;
}

export interface EstadoInventario {
  listo: boolean;
  fechaCorte: string | null;
}

export interface CrearItemInventarioDto {
  tipo: TipoItemInventario;
  nombre: string;
  categoria?: string;
  cantidad?: number;
  alertaMinimo?: number;
  nivelObjetivo?: number;
  /** Bebida: la variante que la descuenta 1:1. */
  varianteId?: number;
}

export interface ActualizarItemInventarioDto {
  nombre?: string;
  categoria?: string;
  alertaMinimo?: number | null;
  nivelObjetivo?: number | null;
  activo?: boolean;
}

export interface GuardarReglaInventarioDto {
  itemId: number;
  varianteId: number;
  cantidad?: number;
  soloParaLlevar?: boolean;
}

// ─── Analítica (/estadisticas/analitica/*) ───────────────────────────────────
// Espejo de Backend/src/estadisticas/analitica (dto + service). Mantener alineados.

export type TipoPedido = 'mesa' | 'llevar' | 'domicilio';
export type MetodoPagoFiltro = 'efectivo' | 'transferencia' | 'mixto' | 'sin_metodo' | 'otro';
export type EstadoPagoFiltro = 'cobrada' | 'parcial' | 'pendiente';
export type CanalOrden = 'pos' | 'web';

/** Filtros comunes a todos los endpoints de analítica. Fechas 'YYYY-MM-DD' (Bogotá). */
export interface FiltrosAnalitica {
  from: string;
  to: string;
  comparar?: boolean;
  tipoPedido?: TipoPedido[];
  metodoPago?: MetodoPagoFiltro[];
  estadoPago?: EstadoPagoFiltro[];
  canal?: CanalOrden[];
  usuario?: string;
  categoria?: CategoriaProducto[];
  productoId?: number[];
  varianteId?: number[];
  tamano?: TamanoPizza[];
  saborId?: number[];
  /** Grupo de sabores del producto vendido (ids de `SaborGrupo`). */
  saborGrupoId?: number[];
  /** 1 = lunes … 7 = domingo */
  diaSemana?: number[];
  horaDesde?: number;
  horaHasta?: number;
  domiciliario?: string;
  cliente?: string;
  precioManual?: boolean;
}

export interface PeriodoAnalitica {
  from: string;
  to: string;
  dias: number;
  inicio: string;
  fin: string;
  anterior: { inicio: string; fin: string } | null;
}

export interface KpisAnalitica {
  facturado: number;
  cobrado: number;
  porCobrar: number;
  facturas: number;
  ticket: number;
  ordenes: number;
  domicilios: number;
  canceladas: number;
  tasaCancelacion: number;
  unidades: number;
  pizzas: number;
  ingresosLineas: number;
  descuentos: number;
}

export interface ResumenAnalitica {
  periodo: PeriodoAnalitica;
  /** Hay filtros de producto/tamaño/sabor: el dinero es de "facturas que incluyen…". */
  filtrosDeLinea: boolean;
  actual: KpisAnalitica;
  anterior: KpisAnalitica | null;
  destacados: {
    pizzaMasVendida: { tamano: TamanoPizza | null; sabores: string[]; unidades: number } | null;
    saborMasPedido: { saborId: number | null; nombre: string; apariciones: number } | null;
    combinacionMasPedida: { sabores: string[]; pizzas: number } | null;
  };
}

export type AgrupacionProductos = 'producto' | 'variante' | 'tamano' | 'categoria';
export type OrdenProductos = 'unidades' | 'ingresos' | 'veces';

export interface FilaProductoAnalitica {
  clave: string;
  nombre: string;
  productoId: number | null;
  varianteId: number | null;
  unidades: number;
  ingresos: number;
  veces: number;
  precioPromedio: number;
  pctUnidades: number;
  pctIngresos: number;
  anterior?: { unidades: number; ingresos: number } | null;
}

export interface ProductosAnalitica {
  periodo: PeriodoAnalitica;
  agrupar: AgrupacionProductos;
  total: number;
  totales: { unidades: number; ingresos: number };
  filas: FilaProductoAnalitica[];
}

export type MetricaSabor = 'apariciones' | 'porciones';

export interface FilaSaborAnalitica {
  clave: string;
  saborId: number | null;
  nombre: string;
  /** Nombre del grupo de sabores; null = sabor sin clasificar. */
  grupo: string | null;
  apariciones: number;
  porciones: number;
  ingresos: number;
  ordenes: number;
  pct: number;
  sinClasificar: boolean;
}

export interface SaboresAnalitica {
  periodo: PeriodoAnalitica;
  metrica: MetricaSabor;
  total: number;
  sinClasificar: { apariciones: number; porciones: number };
  filas: FilaSaborAnalitica[];
}

export interface CeldaMetricaSabor {
  apariciones: number;
  porciones: number;
}

export interface MatrizSaboresAnalitica {
  periodo: PeriodoAnalitica;
  metrica: MetricaSabor;
  tamanos: TamanoPizza[];
  filas: {
    clave: string;
    saborId: number | null;
    nombre: string;
    total: CeldaMetricaSabor;
    porTamano: Partial<Record<TamanoPizza, CeldaMetricaSabor>>;
  }[];
}

export interface CombinacionesAnalitica {
  periodo: PeriodoAnalitica;
  filas: { sabores: string[]; pizzas: number; lineas: number }[];
}

export type GranularidadSerie = 'dia' | 'semana' | 'mes';

export interface PuntoSerieAnalitica {
  periodo: string;
  facturas: number;
  facturado: number;
  cobrado: number;
  ticket: number;
  unidades: number;
}

export interface SerieAnalitica {
  periodo: PeriodoAnalitica;
  granularidad: GranularidadSerie;
  puntos: PuntoSerieAnalitica[];
  anterior: PuntoSerieAnalitica[] | null;
}

export interface HorariosAnalitica {
  periodo: PeriodoAnalitica;
  celdas: { diaSemana: number; hora: number; facturas: number; facturado: number }[];
  porHora: { hora: number; facturas: number; facturado: number }[];
  porDia: { diaSemana: number; facturas: number; facturado: number }[];
}

export interface MixAnalitica {
  periodo: PeriodoAnalitica;
  metodoPago: { clave: string; facturas: number; facturado: number }[];
  cobradoPorMetodo: { efectivo: number; transferencia: number };
  porCuenta: CobradoPorCuenta[];
  estadoPago: { clave: string; facturas: number; facturado: number; cobrado: number; porCobrar: number }[];
  tipoPedido: { clave: string; ordenes: number; facturado: number }[];
  canal: { clave: string; ordenes: number; facturado: number }[];
  categoria: { clave: string; unidades: number; ingresos: number }[];
}

export type OrdenClientesAnalitica = 'gasto' | 'facturas' | 'ticket' | 'ultimaVisita';

export interface ClientesAnalitica {
  periodo: PeriodoAnalitica;
  /** Clientes del período (todos, no solo los de esta página). Ausente en servidores viejos. */
  total?: number;
  /** Totales de TODOS los clientes del período. Ausente en servidores viejos. */
  resumen?: { clientes: number; recurrentes: number; gasto: number };
  filas: {
    clave: string;
    telefono: string | null;
    nombre: string;
    facturas: number;
    gasto: number;
    ticket: number;
    /** Pedido individual más alto del cliente en el rango. */
    pedidoMaximo: number;
    ultimaVisita: string;
  }[];
}

export interface DomiciliariosAnalitica {
  periodo: PeriodoAnalitica;
  filas: { telefono: string; nombre: string; asignados: number; entregas: number; ganancia: number; ticketPromedio: number }[];
  /** Domicilios del período, también los que no tienen repartidor. Ausente en servidores viejos. */
  totales?: { domicilios: number; sinRepartidor: number; entregados: number; costoDomicilios: number };
  /** Una fila por día (hora de Bogotá) y repartidor; telefono null = sin repartidor. */
  porDia?: { dia: string; telefono: string | null; nombre: string; domicilios: number; entregas: number; ganancia: number }[];
}

export interface OpcionesAnalitica {
  productos: { productoId: number; nombre: string; categoria: CategoriaProducto; activo: boolean }[];
  sabores: { saborId: number; nombre: string; grupoId: number | null; activo: boolean }[];
  grupos: { id: number; nombre: string }[];
  domiciliarios: { telefono: string; nombre: string }[];
  usuarios: { id: string; nombre: string }[];
  tamanos: TamanoPizza[];
}

export interface CalidadDatosAnalitica {
  lineas: { total: number; procesadas: number; errores: number; pendientes: number; porcentajeProcesado: number };
  sabores: { total: number; sinClasificar: number };
  migracion: { estado: string; resultado: Record<string, unknown> | null; actualizadaEn: string } | null;
}

/** GET /estadisticas/resumen — la "foto" de dinero con las definiciones únicas. */
export interface ResumenGeneral {
  periodo: { from: string; to: string };
  ventas: {
    facturado: number;
    cobrado: number;
    porCobrar: number;
    facturas: number;
    ticket: number;
    ordenes: number;
    canceladas: number;
    costoDomicilios: number;
    cobradoPorMetodo: { efectivo: number; transferencia: number };
    porMetodo: { clave: string; facturas: number; facturado: number }[];
    /** Cobrado por transferencia por cuenta (id; nombre vigente). sinAsignar = sin cuenta elegida. */
    porCuenta: CobradoPorCuenta[];
    /** cobrada | parcial | pendiente */
    porEstado: { clave: string; facturas: number; facturado: number; cobrado: number; porCobrar: number }[];
  };
  gastos: {
    total: number;
    pagados: number;
    pendientes: number;
    cantidad: number;
    porMetodo: { metodo: string; total: number; pagados: number }[];
    /** Egresos por QR según la cuenta de la que salieron (incluye 'Sin asignar'). */
    porCuenta: { cuentaId: number | null; cuenta: string; sinAsignar: boolean; cantidad: number; total: number; pagados: number }[];
    /** costo | gasto | sin_clasificar (siempre las tres). */
    porTipo: GastosPorTipo[];
    /** Una fila por (categoría, tipo). */
    porCategoria: GastosPorCategoria[];
  };
  /**
   * Balance de caja = cobrado − gastos pagados (UNA sola definición en todas las pantallas).
   * `devengado` = facturado − todos los gastos (solo informativo).
   */
  balance: { devengado: number; cobrado: number };
  /** Por cuenta de transferencia: entradas (cobrado QR) − salidas (egresos QR pagados) = saldo del rango. */
  cuentas: { cuentaId: number | null; cuenta: string; sinAsignar: boolean; entradas: number; salidas: number; saldo: number }[];
  /** Todo lo vendido en el rango por producto + variante, completo (sin tope). */
  productos: ProductoVendidoResumen[];
  /** Ajuste manual de precio: aumentos (+), bajas (−) y líneas afectadas. */
  ajustesPrecio: AjustesPrecioResumen;
  /** Unidades por producto + variante y PRECIO, los manuales aparte ("Pizza - Grande · $48.000 × 50"). Ausente en servidores viejos. */
  productosPorPrecio?: ProductoPorPrecio[];
  /** Estado de resultados con lo cobrado y pagado: ingresos − costos − gastos. */
  resultado: ResultadoPeriodo;
}

export interface ProductoPorPrecio {
  clave: string;
  nombre: string;
  categoria: string | null;
  precio: number;
  manual: boolean;
  /** Precio del menú en las líneas manuales (null si no se guardó). */
  precioLista: number | null;
  unidades: number;
  valor: number;
}

export interface ProductoVendidoResumen {
  clave: string;
  nombre: string;
  /** pizza, calzone, bebida… (para contar cuántas pizzas salieron). Ausente en servidores viejos. */
  categoria?: string | null;
  unidades: number;
  valor: number;
  /** Líneas con precio_manual. */
  lineasManuales: number;
  /** Manuales sin precio de lista (histórico): su ajuste no es calculable. */
  sinPrecioLista: number;
  aumentos: number;
  bajas: number;
  ajuste: number;
}

export interface AjustesPrecioResumen {
  aumentos: number;
  bajas: number;
  neto: number;
  lineasManuales: number;
  sinPrecioLista: number;
}

export interface CobradoPorCuenta {
  cuentaId: number | null;
  cuenta: string;
  sinAsignar: boolean;
  facturas: number;
  monto: number;
}

export interface GastosPorTipo {
  tipo: 'costo' | 'gasto' | 'sin_clasificar';
  cantidad: number;
  total: number;
  pagados: number;
}

export interface GastosPorCategoria {
  categoria: string;
  tipo: 'costo' | 'gasto' | 'sin_clasificar';
  cantidad: number;
  total: number;
  pagados: number;
}

export interface ResultadoPeriodo {
  ingresos: number;
  costos: number;
  utilidadBruta: number;
  gastosOperativos: number;
  sinClasificar: number;
  utilidadOperativa: number;
}
