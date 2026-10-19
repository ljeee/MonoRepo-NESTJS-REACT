import type { EstadoStock, TipoMovimientoInventario } from '@/src/shared';
import type { IconName } from '../ui';

/** Colores del estado que calcula el servidor (ok/bajo/critico). */
export const ESTADO_META: Record<EstadoStock, { color: string; bg: string }> = {
  ok: { color: '#10B981', bg: 'rgba(16,185,129,0.14)' },
  bajo: { color: '#F5A524', bg: 'rgba(245,165,36,0.16)' },
  critico: { color: '#F43F5E', bg: 'rgba(244,63,94,0.16)' },
};

export function estadoLabel(estado: EstadoStock, cantidad: number): string {
  if (estado === 'ok') return 'OK';
  if (estado === 'bajo') return 'Bajo';
  return cantidad <= 0 ? 'Agotado' : 'Crítico';
}

export interface MetaCategoria {
  key: string;
  label: string;
  icon: IconName;
  color: string;
}

export const CATEGORIAS_CAJA: MetaCategoria[] = [
  { key: 'pequena', label: 'Pequeña', icon: 'package-variant-closed', color: '#38BDF8' },
  { key: 'mediana', label: 'Mediana', icon: 'package-variant-closed', color: '#A78BFA' },
  { key: 'grande', label: 'Grande', icon: 'package-variant-closed', color: '#F5A524' },
  { key: 'calzone', label: 'Calzone', icon: 'package-variant-closed', color: '#FB923C' },
  { key: 'otra', label: 'Otra', icon: 'package-variant', color: '#94A3B8' },
];

/** Solo embotelladas: los jugos preparados no llevan stock. */
export const CATEGORIAS_BEBIDA: MetaCategoria[] = [
  { key: 'gaseosa', label: 'Gaseosas', icon: 'bottle-soda', color: '#60A5FA' },
  { key: 'cerveza', label: 'Cervezas', icon: 'glass-mug-variant', color: '#FBBF24' },
  { key: 'agua', label: 'Agua', icon: 'water', color: '#38BDF8' },
  { key: 'otra', label: 'Otras', icon: 'bottle-tonic-outline', color: '#94A3B8' },
];

export const metaCategoria = (tipo: 'caja' | 'bebida', key: string | null): MetaCategoria => {
  const lista = tipo === 'caja' ? CATEGORIAS_CAJA : CATEGORIAS_BEBIDA;
  return lista.find((c) => c.key === key) ?? lista[lista.length - 1];
};

export const MOVIMIENTO_META: Record<TipoMovimientoInventario, { label: string; icon: IconName }> = {
  entrada: { label: 'Entrada', icon: 'tray-arrow-down' },
  salida: { label: 'Salida', icon: 'tray-arrow-up' },
  ajuste: { label: 'Ajuste', icon: 'tune-variant' },
  conteo: { label: 'Conteo', icon: 'counter' },
  venta: { label: 'Venta', icon: 'receipt' },
  devolucion: { label: 'Devolución', icon: 'undo-variant' },
  migracion: { label: 'Saldo migrado', icon: 'database-import-outline' },
};

/** Medidor contra un objetivo REAL; sin objetivo se estima uno y se rotula "~". */
export function gauge(cantidad: number, alerta: number | null, objetivo: number | null) {
  const estimado = !(objetivo && objetivo > 0);
  const meta = estimado ? Math.max((alerta ?? 0) * 4, cantidad, 10) : objetivo!;
  const llenoPct = Math.max(0, Math.min(cantidad / meta, 1)) * 100;
  const marcaPct = alerta != null && alerta > 0 ? Math.min(alerta / meta, 1) * 100 : null;
  return { meta, llenoPct, marcaPct, estimado };
}
