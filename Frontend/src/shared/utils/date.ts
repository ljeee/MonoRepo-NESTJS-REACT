// ─── Fechas del negocio (America/Bogota) ──────────────────────────────────────
// El día contable es el de Bogotá, no el del dispositivo: un navegador en UTC o un
// celular con otra zona partiría los reportes a la hora equivocada. Las fechas
// viajan como 'YYYY-MM-DD' y la aritmética de días se hace en UTC puro: Colombia
// no tiene horario de verano (UTC−5 todo el año), así que no hay días de 23 ni 25 h.
// Mismo formateador que el backend (common/utils/date.utils.ts → getBogotaDateString).

export type PresetRango = 'hoy' | 'ayer' | 'semana' | '7d' | '30d' | 'mes' | 'mesAnterior' | 'anio';

/** Rango inclusivo de fechas 'YYYY-MM-DD'. */
export interface RangoFechas {
  from: string;
  to: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

// Perezoso: si el motor JS no soporta zonas horarias el constructor lanza, y eso
// no puede tumbar la carga del módulo (lo importan Frontend y RiderApp).
let bogotaFormatter: Intl.DateTimeFormat | null | undefined;

function getBogotaFormatter(): Intl.DateTimeFormat | null {
  if (bogotaFormatter === undefined) {
    try {
      bogotaFormatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      bogotaFormatter = null;
    }
  }
  return bogotaFormatter;
}

function parseISO(iso: string): Date | null {
  if (!ISO_DATE_RE.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Fecha de hoy en Bogotá, 'YYYY-MM-DD'. */
export function bogotaToday(): string {
  const now = new Date();
  const formatted = getBogotaFormatter()?.format(now);
  if (formatted && ISO_DATE_RE.test(formatted)) return formatted;
  // Respaldo exacto si el motor no tiene Intl completo: Bogotá es UTC−5 fijo.
  return new Date(now.getTime() + BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Suma días (negativos para restar) a una fecha 'YYYY-MM-DD'. '' si la entrada no es válida. */
export function shiftISO(iso: string, dias: number): string {
  const fecha = parseISO(iso);
  if (!fecha || !Number.isFinite(dias)) return '';
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/**
 * Rango de un atajo de fechas, anclado al día de Bogotá. 'semana' va del lunes a
 * hoy, 'mes' y 'anio' del día 1 a hoy, '7d'/'30d' incluyen hoy. `hoy` se puede
 * fijar (pruebas, o anclar a un día elegido).
 */
export function presetRange(preset: PresetRango, hoy: string = bogotaToday()): RangoFechas {
  switch (preset) {
    case 'hoy':
      return { from: hoy, to: hoy };
    case 'ayer': {
      const ayer = shiftISO(hoy, -1);
      return { from: ayer, to: ayer };
    }
    case 'semana': {
      // getUTCDay: 0 = domingo … 6 = sábado → días transcurridos desde el lunes
      const desdeLunes = ((parseISO(hoy)?.getUTCDay() ?? 1) + 6) % 7;
      return { from: shiftISO(hoy, -desdeLunes), to: hoy };
    }
    case '7d':
      return { from: shiftISO(hoy, -6), to: hoy };
    case '30d':
      return { from: shiftISO(hoy, -29), to: hoy };
    case 'mes':
      return { from: `${hoy.slice(0, 7)}-01`, to: hoy };
    case 'mesAnterior': {
      const finMesAnterior = shiftISO(`${hoy.slice(0, 7)}-01`, -1);
      return { from: `${finMesAnterior.slice(0, 7)}-01`, to: finMesAnterior };
    }
    case 'anio':
      return { from: `${hoy.slice(0, 4)}-01-01`, to: hoy };
  }
}
