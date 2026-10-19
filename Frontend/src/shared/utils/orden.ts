import type { Orden } from '../types/models';

/**
 * Reglas de presentación de una orden compartidas por KDS, POS, el dashboard y la
 * lista de pendientes. Sin dependencias de UI (RiderApp también importa src/shared).
 */

/** Minutos enteros transcurridos desde la fecha (nunca negativos). */
export function minutosDesde(fecha: string | Date): number {
  return Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 60000));
}

export type NivelUrgencia = 'nueva' | 'ok' | 'atencion' | 'urgente' | 'lista';

/**
 * Urgencia de una orden pendiente según los minutos que lleva:
 * 0–4 nueva (azul) · 5–19 a tiempo (verde) · 20–29 atención (amarillo) · 30+ urgente (rojo).
 * Cualquier estado distinto de "pendiente" cuenta como lista.
 */
export function urgenciaOrden(mins: number, estado?: string | null) {
  if ((estado ?? '').toLowerCase() !== 'pendiente') {
    return { nivel: 'lista' as NivelUrgencia, color: '#10B981', texto: '#10B981', label: 'LISTO' };
  }
  if (mins >= 30) return { nivel: 'urgente' as NivelUrgencia, color: '#EF4444', texto: '#F87171', label: 'URGENTE' };
  if (mins >= 20) return { nivel: 'atencion' as NivelUrgencia, color: '#EAB308', texto: '#FDE047', label: 'ATENCIÓN' };
  if (mins >= 5) return { nivel: 'ok' as NivelUrgencia, color: '#22C55E', texto: '#86EFAC', label: 'A TIEMPO' };
  return { nivel: 'nueva' as NivelUrgencia, color: '#3B82F6', texto: '#93C5FD', label: 'NUEVA' };
}

/** Etiqueta, ícono (MaterialCommunityIcons) y color de cada tipo de pedido. */
export const TIPO_PEDIDO_META = {
  domicilio: { label: 'Domicilio', icon: 'motorbike', color: '#F5A524' },
  llevar: { label: 'Para llevar', icon: 'bag-personal-outline', color: '#60A5FA' },
  mesa: { label: 'Mesa', icon: 'silverware-fork-knife', color: '#94A3B8' },
} as const;

export function tipoPedidoMeta(tipo?: string | null) {
  const t = (tipo ?? '').toLowerCase();
  if (t.includes('domicilio')) return TIPO_PEDIDO_META.domicilio;
  if (t.includes('llevar')) return TIPO_PEDIDO_META.llevar;
  return TIPO_PEDIDO_META.mesa;
}

/**
 * Nombre a mostrar: el cliente de la factura o de la orden; en mesa, "Mesa N"
 * (el nombre suele ser solo el número). Una sola regla para todas las tarjetas.
 */
export function nombreVisibleOrden(orden: Pick<Orden, 'nombreCliente' | 'tipoPedido' | 'mesa' | 'factura'>): string {
  const nombre = (orden.factura?.clienteNombre || orden.nombreCliente || '').trim();
  const esMesa = (orden.tipoPedido ?? '').toLowerCase() === 'mesa';
  if (!nombre) {
    const mesa = (orden.mesa ?? '').trim();
    return esMesa && mesa ? `Mesa ${mesa}` : esMesa ? 'Mesa' : 'Sin nombre';
  }
  if (esMesa && !nombre.toLowerCase().startsWith('mesa')) return `Mesa ${nombre}`;
  return nombre;
}
