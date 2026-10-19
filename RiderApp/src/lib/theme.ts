// Tokens de diseño de RiderApp. Identidad del POS Dfiru (ámbar sobre slate oscuro) en versión
// minimalista: superficies planas con borde tenue, sin sombras ni brillos, y poco texto en versalita.

export const colors = {
  bg: '#0B1220', // fondo general
  bgElevated: '#0F172A', // barras y zonas fijas
  surface: '#141D2E', // tarjetas
  surfaceAlt: '#1B2639', // filas internas / inputs
  hairline: 'rgba(226,232,240,0.08)', // borde de tarjeta
  line: 'rgba(226,232,240,0.08)', // separadores

  brand: '#F5A524', // acento principal
  brandSoft: 'rgba(245,165,36,0.14)',
  onBrand: '#1A1206', // texto sobre ámbar

  ink: '#F1F5F9', // texto principal
  muted: '#94A3B8', // texto secundario
  faint: '#64748B', // placeholders
  ghost: '#475569', // deshabilitado

  success: '#10B981',
  successSoft: 'rgba(16,185,129,0.13)',
  danger: '#F43F5E',
  dangerSoft: 'rgba(244,63,94,0.13)',
  info: '#38BDF8',
  infoSoft: 'rgba(56,189,248,0.13)',
  warn: '#F59E0B',
  warnSoft: 'rgba(245,158,11,0.13)',

  whatsapp: '#25D366',
  whatsappSoft: 'rgba(37,211,102,0.14)',
  waze: '#33CCFF',
  wazeSoft: 'rgba(51,204,255,0.14)',
  maps: '#4285F4',
  mapsSoft: 'rgba(66,133,244,0.14)',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/** Ancho máximo del contenido: en tablets las pantallas no se estiran de borde a borde. */
export const maxContentWidth = 1100;

/** Desde este ancho las entregas pasan a dos columnas. */
export const TWO_COLUMNS_FROM = 720;

export const text = {
  h1: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '500' as const },
  label: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
} as const;
