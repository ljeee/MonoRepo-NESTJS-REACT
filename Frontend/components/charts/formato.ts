import { formatCompactCurrency, formatCurrency } from '@/src/shared';

const NUMERO = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

/** Formatos de valor que entienden las gráficas. */
export type FormatoValor = 'moneda' | 'monedaCompacta' | 'numero' | 'porcentaje';

export function formatearValor(valor: number, formato: FormatoValor = 'numero'): string {
  switch (formato) {
    case 'moneda':
      return `$${formatCurrency(valor)}`;
    case 'monedaCompacta':
      return formatCompactCurrency(valor);
    case 'porcentaje':
      return `${NUMERO.format(valor)}%`;
    default:
      return NUMERO.format(valor);
  }
}

/**
 * Variación porcentual actual vs anterior. null si no hay base (anterior 0) — la UI
 * muestra "nuevo" en vez de un +∞% engañoso.
 */
export function variacion(actual: number, anterior: number | null | undefined): number | null {
  if (anterior == null || anterior === 0) return null;
  return Math.round(((actual - anterior) / Math.abs(anterior)) * 1000) / 10;
}

/** Color de una variación: subir es bueno salvo que la métrica sea "menos es mejor". */
export function colorVariacion(delta: number | null, menosEsMejor = false): string {
  if (delta == null || delta === 0) return '#94A3B8';
  const bueno = menosEsMejor ? delta < 0 : delta > 0;
  return bueno ? '#10B981' : '#F43F5E';
}
