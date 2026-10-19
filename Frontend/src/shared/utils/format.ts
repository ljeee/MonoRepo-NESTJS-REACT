const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' });
const dateShortFormatter = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Formatea un número como moneda colombiana con puntos como separador de miles
 * Ej: 16000 → "16.000", 1234567 → "1.234.567"
 */
export function formatCurrency(num: number | undefined | null): string {
  if (num === undefined || num === null || !Number.isFinite(Number(num))) return '0';

  const redondeado = Math.round(Number(num));
  // El signo va aparte: antes -500 salía "-.500" (el "-" contaba como dígito del grupo).
  const str = Math.abs(redondeado).toString();
  const parts = [];

  // Añadir puntos cada 3 dígitos desde la derecha
  for (let i = str.length; i > 0; i -= 3) {
    parts.unshift(str.substring(Math.max(0, i - 3), i));
  }

  return (redondeado < 0 ? '-' : '') + parts.join('.');
}

/** Moneda con símbolo: 16000 → "$16.000", -1500 → "-$1.500". */
export function formatCOP(num: number | undefined | null): string {
  const n = Number(num) || 0;
  return (n < 0 ? '-$' : '$') + formatCurrency(Math.abs(n));
}

/**
 * Tiempo transcurrido desde una fecha. Corto: "Ahora", "5m", "3h", "2d".
 * Largo: "Ahora", "Hace 5 min", "Hace 3h", "Hace 2d", "Hace 1 mes".
 */
export function timeAgo(date: string | Date | null | undefined, estilo: 'corto' | 'largo' = 'corto'): string {
  if (!date) return '—';
  const ms = Date.now() - new Date(date).getTime();
  if (!Number.isFinite(ms)) return '—';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Ahora';
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (estilo === 'corto') {
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  }
  if (mins < 60) return `Hace ${mins} min`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days < 30) return `Hace ${days}d`;
  const meses = Math.floor(days / 30);
  return `Hace ${meses} mes${meses > 1 ? 'es' : ''}`;
}

/**
 * Formatea una fecha ISO a formato colombiano corto
 * Ej: "2026-02-07T16:42:00Z" → "7/02/26, 11:42 a. m."
 */
export function formatDate(date?: string | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return dateTimeFormatter.format(d);
}

/**
 * Formatea fecha solo día: "7 feb 2026"
 */
export function formatDateShort(date?: string | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return dateShortFormatter.format(d);
}

/**
 * Formatea un número como moneda colombiana compacta (k, M)
 * Ej: 53000 → "$53k", 1200000 → "$1.2M", 800 → "$800"
 */
export function formatCompactCurrency(num: number | undefined | null): string {
  if (num === undefined || num === null) return '$0';
  
  const absNum = Math.abs(num);
  let result = '';
  
  if (absNum >= 1000000) {
    const million = num / 1000000;
    result = (Math.abs(million % 1) < 0.01 ? million.toFixed(0) : million.toFixed(1)) + 'M';
  } else if (absNum >= 1000) {
    const k = num / 1000;
    result = (Math.abs(k % 1) < 0.01 ? k.toFixed(0) : k.toFixed(1)) + 'k';
  } else {
    result = formatCurrency(num);
  }
  
  return '$' + result;
}
