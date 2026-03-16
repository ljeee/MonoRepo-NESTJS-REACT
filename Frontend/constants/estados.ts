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
      return { bg: 'rgba(251, 146, 60, 0.12)', text: '#FB923C', icon: 'clock-outline' as const };
    case 'en preparación':
      return { bg: 'rgba(34, 211, 238, 0.12)', text: '#22D3EE', icon: 'chef-hat' as const };
    case 'enviado':
      return { bg: 'rgba(245, 165, 36, 0.12)', text: '#F5A524', icon: 'truck-delivery-outline' as const };
    case 'entregado':
    case 'completada':
      return { bg: 'rgba(52, 211, 153, 0.12)', text: '#34D399', icon: estado === 'completada' ? 'check-all' : 'check-circle-outline' as const };
    case 'cancelado':
      return { bg: 'rgba(244, 63, 94, 0.12)', text: '#F43F5E', icon: 'close-circle-outline' as const };
    default:
      return { bg: '#151928', text: '#64748B', icon: 'help-circle-outline' as const };
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
