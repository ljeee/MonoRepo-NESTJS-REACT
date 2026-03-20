/**
 * Formatea un número como moneda colombiana con puntos como separador de miles
 * Ej: 16000 → "16.000", 1234567 → "1.234.567"
 */
export function formatCurrency(num: number | undefined | null): string {
  if (num === undefined || num === null) return '0';
  
  // Convertir a string
  const str = Math.round(num).toString();
  const parts = [];
  
  // Añadir puntos cada 3 dígitos desde la derecha
  for (let i = str.length; i > 0; i -= 3) {
    parts.unshift(str.substring(Math.max(0, i - 3), i));
  }
  
  return parts.join('.');
}

/**
 * Formatea una fecha ISO a formato colombiano corto
 * Ej: "2026-02-07T16:42:00Z" → "7/02/26, 11:42 a. m."
 */
export function formatDate(date?: string | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Formatea fecha solo día: "7 feb 2026"
 */
export function formatDateShort(date?: string | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
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
