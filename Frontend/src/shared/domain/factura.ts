// ─── Dominio de facturas de venta ─────────────────────────────────────────────
// Espejo de las reglas del backend para clasificar y sumar facturas: estado
// (cobrada / parcial / pendiente / anulada), cuánto se cobró, cuánto falta y el
// desglose por método. Las pantallas que cuentan dinero deben pasar por aquí para
// que el POS y los reportes del servidor den las mismas cifras.
// RN/TS puro: RiderApp compila este archivo vía @/src/shared.

/** Lo mínimo que usan estas reglas; lo cumplen FacturaVenta, FacturaItem y el JSON del API. */
export interface FacturaMontosLike {
  estado?: string | null;
  metodo?: string | null;
  total?: number | null;
  /** Acumulado cobrado (pago completo o abonos). null en facturas antiguas. */
  montoPagado?: number | null;
  pagoEfectivo?: number | null;
  pagoTransferencia?: number | null;
}

type FacturaEstadoLike = Pick<FacturaMontosLike, 'estado'>;

/** null, undefined o un valor no numérico cuentan como 0. */
function monto(valor: number | null | undefined): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

// ─── Estado ───────────────────────────────────────────────────────────────────

/** Saldada por completo. 'pagada' es la grafía histórica de 'pagado'. */
export function isCobrada(f: FacturaEstadoLike | null | undefined): boolean {
  return f?.estado === 'pagado' || f?.estado === 'pagada';
}

export function isAnulada(f: FacturaEstadoLike | null | undefined): boolean {
  return f?.estado === 'cancelado';
}

/** Tiene abonos pero aún no está saldada. */
export function isParcial(f: FacturaEstadoLike | null | undefined): boolean {
  return f?.estado === 'parcial';
}

/**
 * Sin cobrar. Sin estado cuenta como pendiente, igual que el backend
 * (`estado = 'pendiente' OR estado IS NULL`). Con `incluirParcial` entran también
 * las que tienen abonos: todo lo que aún tiene saldo.
 */
export function isPendiente(
  f: FacturaEstadoLike | null | undefined,
  { incluirParcial = false }: { incluirParcial?: boolean } = {},
): boolean {
  if (!f) return false;
  if (!f.estado || f.estado === 'pendiente') return true;
  return incluirParcial && f.estado === 'parcial';
}

// ─── Montos ───────────────────────────────────────────────────────────────────

/**
 * Lo efectivamente cobrado, nunca más que el total. Cobrada → `montoPagado` (o el
 * total, en facturas antiguas sin ese campo); parcial → lo abonado; pendiente o
 * anulada → 0.
 */
export function cobrado(f: FacturaMontosLike | null | undefined): number {
  if (!f) return 0;
  const total = monto(f.total);
  if (isCobrada(f)) return Math.min(monto(f.montoPagado ?? f.total), total);
  if (isParcial(f)) return Math.min(monto(f.montoPagado), total);
  return 0;
}

/** Saldo pendiente: total − cobrado. Una anulada no debe nada. */
export function porCobrar(f: FacturaMontosLike | null | undefined): number {
  if (!f || isAnulada(f)) return 0;
  return monto(f.total) - cobrado(f);
}

/**
 * Reparte lo cobrado entre efectivo y transferencia. Mixta → su desglose
 * (`pagoEfectivo`/`pagoTransferencia`); efectivo o QR/transferencia → todo lo
 * cobrado a ese método. Una parcial con desglose también usa el desglose: los
 * abonos lo acumulan por método y el `metodo` final solo se fija al saldarse
 * (antes puede venir vacío o preasignado, p. ej. pedidos del bot de WhatsApp).
 * Pendientes y anuladas no reparten nada aunque conserven un desglose viejo
 * (revertir a pendiente no lo borra).
 */
function desglosePorMetodo(f: FacturaMontosLike | null | undefined): { efectivo: number; transferencia: number } {
  if (!f || !(isCobrada(f) || isParcial(f))) return { efectivo: 0, transferencia: 0 };
  const metodo = resolverMetodoPago(f.metodo);
  const tieneDesglose = f.pagoEfectivo != null || f.pagoTransferencia != null;
  if (metodo === 'efectivo_transferencia' || (isParcial(f) && tieneDesglose)) {
    return { efectivo: monto(f.pagoEfectivo), transferencia: monto(f.pagoTransferencia) };
  }
  const total = cobrado(f);
  if (metodo === 'efectivo') return { efectivo: total, transferencia: 0 };
  if (metodo === 'transferencia') return { efectivo: 0, transferencia: total };
  return { efectivo: 0, transferencia: 0 };
}

/** Parte de lo cobrado que entró en efectivo (ver `desglosePorMetodo`). */
export function montoEfectivo(f: FacturaMontosLike | null | undefined): number {
  return desglosePorMetodo(f).efectivo;
}

/** Parte de lo cobrado que entró por QR/transferencia ('qr' cuenta aquí). */
export function montoTransferencia(f: FacturaMontosLike | null | undefined): number {
  return desglosePorMetodo(f).transferencia;
}

// ─── Métodos de pago ──────────────────────────────────────────────────────────

export type MetodoPagoKey = 'efectivo' | 'transferencia' | 'efectivo_transferencia';

export interface MetodoPagoMeta {
  label: string;
  /** Rótulo de la UI en chips y badges */
  shortLabel: string;
  /** Nombre de MaterialCommunityIcons */
  icon: string;
  color: string;
}

/** Solo métodos canónicos (se puede iterar). 'qr' se resuelve con `getMetodoPagoMeta`. */
export const METODO_PAGO_META = {
  efectivo: { label: 'Efectivo', shortLabel: 'Efectivo', icon: 'cash', color: '#10B981' },
  transferencia: { label: 'Transferencia', shortLabel: 'QR/Trans', icon: 'qrcode-scan', color: '#6366F1' },
  efectivo_transferencia: { label: 'Efectivo y Transferencia', shortLabel: 'Mixto', icon: 'swap-horizontal', color: '#F5A524' },
} as const satisfies Record<MetodoPagoKey, MetodoPagoMeta>;

/**
 * Método canónico de una factura. Alias: 'qr' (legado) → 'transferencia';
 * 'mixto' (rótulo de la UI y filtro del API) → 'efectivo_transferencia'.
 * null si no tiene método o no es uno conocido.
 */
export function resolverMetodoPago(metodo: string | null | undefined): MetodoPagoKey | null {
  const m = (metodo ?? '').trim().toLowerCase();
  if (m === 'efectivo' || m === 'transferencia' || m === 'efectivo_transferencia') return m;
  if (m === 'qr') return 'transferencia';
  if (m === 'mixto') return 'efectivo_transferencia';
  return null;
}

export function getMetodoPagoMeta(metodo: string | null | undefined) {
  const key = resolverMetodoPago(metodo);
  return key ? METODO_PAGO_META[key] : null;
}

// ─── Estados de orden ─────────────────────────────────────────────────────────

export type OrdenEstado = 'pendiente' | 'en preparación' | 'enviado' | 'entregado' | 'completada' | 'cancelado';

export interface OrdenEstadoMeta {
  label: string;
  /** Texto y acento */
  color: string;
  /** Fondo tenue de la píldora */
  bg: string;
  /** Nombre de MaterialCommunityIcons */
  icon: string;
}

/**
 * Mismos colores que `constants/estados.ts` (getEstadoColor). 'enviado' usa el
 * naranja de aviso, no el ámbar primario: ese queda para CTAs, nunca para estados.
 */
export const ORDEN_ESTADO_META = {
  pendiente: { label: 'Pendiente', color: '#FB923C', bg: 'rgba(251, 146, 60, 0.12)', icon: 'clock-outline' },
  'en preparación': { label: 'En preparación', color: '#22D3EE', bg: 'rgba(34, 211, 238, 0.12)', icon: 'chef-hat' },
  enviado: { label: 'Enviado', color: '#FB923C', bg: 'rgba(251, 146, 60, 0.12)', icon: 'truck-delivery-outline' },
  entregado: { label: 'Entregado', color: '#34D399', bg: 'rgba(52, 211, 153, 0.12)', icon: 'check-circle-outline' },
  completada: { label: 'Completada', color: '#34D399', bg: 'rgba(52, 211, 153, 0.12)', icon: 'check-all' },
  cancelado: { label: 'Cancelado', color: '#F43F5E', bg: 'rgba(244, 63, 94, 0.12)', icon: 'close-circle-outline' },
} as const satisfies Record<OrdenEstado, OrdenEstadoMeta>;

/** Meta de un estado de orden; tolera las grafías legadas de "en preparación". null si es desconocido. */
export function getOrdenEstadoMeta(estado: string | null | undefined) {
  const e = (estado ?? '').trim().toLowerCase();
  if (e === 'preparacion' || e === 'en_preparacion' || e === 'en preparacion') return ORDEN_ESTADO_META['en preparación'];
  return Object.prototype.hasOwnProperty.call(ORDEN_ESTADO_META, e) ? ORDEN_ESTADO_META[e as OrdenEstado] : null;
}

// ─── Filtro por método de pago ────────────────────────────────────────────────
// Reutilizado por las vistas de facturas/balance (MethodFilterChips lo re-exporta).
// Mixto = facturas con metodo === 'efectivo_transferencia' (su propio bucket).
// Efectivo y QR/Trans incluyen además las mixtas cuya parte correspondiente sea > 0
// ("mixta con efectivo" / "mixta con QR") — misma semántica que el backend.

export type MethodFilterValue = 'todos' | 'efectivo' | 'transferencia' | 'mixto' | 'pendiente';

export interface FacturaMetodoLike {
  metodo?: string | null;
  pagoEfectivo?: number | null;
  pagoTransferencia?: number | null;
}

/** ¿La factura entra en el bucket de método del filtro? (sin evaluar estado) */
export function matchesMetodoFilter(
  f: FacturaMetodoLike,
  key: 'efectivo' | 'transferencia' | 'mixto',
): boolean {
  const esMixta = f.metodo === 'efectivo_transferencia';
  if (key === 'mixto') return esMixta;
  if (key === 'efectivo') return f.metodo === 'efectivo' || (esMixta && (f.pagoEfectivo ?? 0) > 0);
  // 'transferencia' incluye facturas con metodo='qr' (alias legacy del mismo método)
  return f.metodo === 'transferencia' || f.metodo === 'qr' || (esMixta && (f.pagoTransferencia ?? 0) > 0);
}
