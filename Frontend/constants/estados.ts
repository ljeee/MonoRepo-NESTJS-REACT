import { colors } from '../styles/theme';

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
  switch (estado) {
    case 'pendiente':
      return { bg: colors.warningLight, text: colors.warning, icon: 'clock-outline' as const };
    case 'en preparación':
      return { bg: colors.infoLight, text: colors.info, icon: 'chef-hat' as const };
    case 'enviado':
      return { bg: colors.primaryLight, text: colors.primary, icon: 'truck-delivery-outline' as const };
    case 'entregado':
      return { bg: colors.successLight, text: colors.success, icon: 'check-circle-outline' as const };
    case 'completada':
      return { bg: colors.successLight, text: colors.success, icon: 'check-all' as const };
    case 'cancelado':
      return { bg: colors.dangerLight, text: colors.danger, icon: 'close-circle-outline' as const };
    default:
      return { bg: colors.card, text: colors.textMuted, icon: 'help-circle-outline' as const };
  }
}

// ── Payment Methods ───────────────────────────────────────────────────────────
export const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo', icon: 'cash' as const },
  { value: 'qr', label: 'QR', icon: 'qrcode' as const },
] as const;

// ── Order Types ───────────────────────────────────────────────────────────────
export const TIPOS_PEDIDO = [
  { value: 'domicilio', label: 'Domicilio', icon: 'truck-delivery-outline' as const },
  { value: 'llevar', label: 'Llevar', icon: 'shopping-outline' as const },
  { value: 'mesa', label: 'Mesa', icon: 'table-furniture' as const },
] as const;

// ── Mesas ─────────────────────────────────────────────────────────────────────
export const MESAS = Array.from({ length: 10 }, (_, i) => ({
  value: `${i + 1}`,
  label: `Mesa ${i + 1}`,
}));

// ── Estados de Factura ────────────────────────────────────────────────────────
export const ESTADOS_FACTURA = ['pendiente', 'pagado'] as const;
