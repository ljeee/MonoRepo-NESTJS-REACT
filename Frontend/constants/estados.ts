import { ORDEN_ESTADO_META, getOrdenEstadoMeta } from '@/src/shared';
import type { IconName } from '../components/ui/Icon';

/**
 * Etiquetas y colores de estado de orden para las pantallas de órdenes. Derivan de
 * `ORDEN_ESTADO_META` (dominio compartido): antes esta tabla era una copia aparte.
 */
export const ESTADO_LABELS: Record<string, string> = {
  '': 'Todos',
  ...Object.fromEntries(Object.entries(ORDEN_ESTADO_META).map(([estado, meta]) => [estado, meta.label])),
};

export function getEstadoColor(estado?: string): { bg: string; text: string; icon: IconName } {
  const meta = getOrdenEstadoMeta(estado);
  if (!meta) return { bg: '#151928', text: '#64748B', icon: 'help-circle-outline' };
  return { bg: meta.bg, text: meta.color, icon: meta.icon as IconName };
}
