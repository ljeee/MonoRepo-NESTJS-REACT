/**
 * Formatea un número como moneda colombiana con puntos como separador de miles
 * Ej: 16000 → "16.000", 1234567 → "1.234.567"
 */
export function formatCurrency(num: number | undefined | null): string {
  if (num === undefined || num === null) return '0';
  
  // Convertir a string y invertir
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
