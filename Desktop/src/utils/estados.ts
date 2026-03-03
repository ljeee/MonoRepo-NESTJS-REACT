// ── Order States ──────────────────────────────────────────────────────────────
export const ESTADOS_ORDEN = ['', 'pendiente', 'en preparación', 'enviado', 'entregado', 'completada', 'cancelado'] as const;
export type EstadoOrden = typeof ESTADOS_ORDEN[number];

export const ESTADO_LABELS: Record<string, string> = {
  '': 'Todos',
  pendiente: 'Pendiente',
  'en preparación': 'En preparación',
  enviado: 'Enviado',
  entregado: 'Entregado',
  completada: 'Completada',
  cancelado: 'Cancelado',
};

export function getEstadoColor(estado?: string) {
  switch (estado?.toLowerCase()) {
    case 'pendiente':
      return { bg: 'var(--warning-light)', text: 'var(--warning-dark)', icon: 'clock' as const };
    case 'en preparación':
    case 'preparacion':
      return { bg: 'var(--info-light)', text: 'var(--info)', icon: 'chef-hat' as const };
    case 'enviado':
      return { bg: 'var(--primary-light)', text: 'var(--primary)', icon: 'truck' as const };
    case 'entregado':
      return { bg: 'var(--success-light)', text: 'var(--success)', icon: 'check-circle' as const };
    case 'completada':
      return { bg: 'var(--success-light)', text: 'var(--success)', icon: 'check-all' as const };
    case 'cancelado':
      return { bg: 'var(--danger-light)', text: 'var(--danger)', icon: 'x-circle' as const };
    default:
      return { bg: 'var(--surface-dark)', text: 'var(--text-muted)', icon: 'help-circle' as const };
  }
}

// ── Payment Methods ───────────────────────────────────────────────────────────
export const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo', icon: 'dollar-sign' as const },
  { value: 'qr', label: 'Transferencia (QR)', icon: 'qrcode' as const },
] as const;

// ── Order Types ───────────────────────────────────────────────────────────────
export const TIPOS_PEDIDO = [
  { value: 'domicilio', label: 'Domicilio', icon: 'truck' as const },
  { value: 'llevar', label: 'Llevar', icon: 'shopping-bag' as const },
  { value: 'mesa', label: 'Mesa', icon: 'utensils' as const },
] as const;

// ── Mesas ─────────────────────────────────────────────────────────────────────
export const MESAS = Array.from({ length: 15 }, (_, i) => ({
  value: `${i + 1}`,
  label: `Mesa ${i + 1}`,
}));

// ── Estados de Factura ────────────────────────────────────────────────────────
export const ESTADOS_FACTURA = ['pendiente', 'pagado'] as const;
