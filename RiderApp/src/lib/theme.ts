// Tokens de diseño de RiderApp. Mantienen la identidad del POS Dfiru (ámbar
// sobre slate oscuro) pero con una escala de superficies y sombras propia, para
// que la app del domiciliario no se vea como una pantalla de formulario suelta.

export const colors = {
  bg: '#0B1220', // fondo general
  bgElevated: '#0F172A', // barras y zonas fijas
  surface: '#1A2436', // tarjetas
  surfaceAlt: '#212D42', // filas internas / inputs
  hairline: 'rgba(226,232,240,0.07)', // borde de tarjeta
  hairlineTop: 'rgba(226,232,240,0.12)', // canto superior (luz de arriba)
  line: 'rgba(226,232,240,0.09)', // separadores

  brand: '#F5A524', // acento principal
  brandDeep: '#D98A0F',
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
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 6,
  },
  bar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  glow: {
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

export const text = {
  // Escala tipográfica: títulos apretados, etiquetas en versalita espaciada.
  h1: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.4 },
  h2: { fontSize: 19, fontWeight: '800' as const, letterSpacing: -0.2 },
  body: { fontSize: 14, fontWeight: '500' as const },
  label: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
} as const;
