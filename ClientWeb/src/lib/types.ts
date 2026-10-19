// Tipos espejo de los DTOs/entidades del Backend (Backend/src/**).
// ClientWeb es standalone (no importa Frontend/src/shared), así que los
// contratos se replican aquí y deben mantenerse congruentes con el Backend.

// ─── Catálogo ─────────────────────────────────────────────────────────────────

export interface ProductoVariante {
  varianteId: number;
  productoId: number;
  nombre: string;
  precio: number;
  descripcion?: string | null;
  precioLeche?: number | null;
  stockBebida?: number;
  /** Tamaño explícito (productos cuyo grupo de sabores usa tamaños). null = se deduce del nombre. */
  tamano?: 'pequena' | 'mediana' | 'grande' | null;
  activo: boolean;
}

export interface Producto {
  productoId: number;
  productoNombre: string;
  descripcion?: string | null;
  activo: boolean;
  emoji?: string | null;
  /** 'jugo' pide la base; los sabores los decide `saborGrupoId` ('pizza'/'calzone' son valores heredados). */
  personalizacion?: 'pizza' | 'calzone' | 'jugo' | 'ninguna' | null;
  /** Grupo de sabores que ofrece el producto. null = no lleva sabores. */
  saborGrupoId?: number | null;
  variantes?: ProductoVariante[];
}

/** Reglas de los sabores de un producto (espejo de `SaborGrupo` del backend: mantener congruente). */
export interface SaborGrupo {
  id: number;
  nombre: string;
  maxSabores: number;
  varianteEsSabor: boolean;
  usaTamano: boolean;
  recargoExtraDesde: number | null;
  recargoExtraPequena: number;
  recargoExtraMediana: number;
  recargoExtraGrande: number;
  activo: boolean;
  orden: number;
}

export interface PizzaSabor {
  saborId: number;
  nombre: string;
  grupoId: number | null;
  /** Recargo por tamaño; 0 = no cobra. Un grupo sin tamaños usa solo `recargoGrande`. */
  recargoPequena: number;
  recargoMediana: number;
  recargoGrande: number;
  activo: boolean;
}

// ─── Empresa (About Us) ───────────────────────────────────────────────────────

export interface EmpresaConfig {
  id?: number;
  nit?: string | null;
  razonSocial?: string | null;
  nombreComercial?: string | null;
  regimen?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  municipio?: string | null;
  departamento?: string | null;
}

// ─── Auth (POST /auth/cliente/login | /auth/cliente/registro) ────────────────

export interface AuthUser {
  id: string;
  username: string;
  name?: string;
  roles: string[];
}

export interface AuthResponse extends AuthUser {
  accessToken: string;
  refreshToken: string;
}

// ─── Crear orden (POST /ordenes → CreateOrdenesDto) ──────────────────────────
// Contrato idéntico al que envía el POS (Frontend/components/orderForm/CreateOrderForm.tsx):
// cada item lleva tipo = nombre del producto, varianteId y cantidad.

export interface CreateOrdenProductoPayload {
  tipo: string;
  productoId?: number;
  varianteId: number;
  cantidad: number;
  sabor1?: string;
  sabor2?: string;
  sabor3?: string;
  base?: 'leche' | 'agua';
}

export interface CreateOrdenPayload {
  tipoPedido: 'domicilio';
  telefonoCliente: string;
  nombreCliente?: string;
  direccionCliente?: string;
  referenciaCliente?: string;
  latitudCliente?: number;
  longitudCliente?: number;
  metodo?: 'efectivo' | 'transferencia';
  costoDomicilio?: number;
  observaciones?: string;
  productos: CreateOrdenProductoPayload[];
}

// ─── Carrito (estado local de ClientWeb) ──────────────────────────────────────

export interface CartItem {
  id: string;
  productoId: number;
  productoNombre: string;
  varianteId: number;
  varianteNombre: string;
  precio: number;
  cantidad: number;
  sabores?: string[];
}
