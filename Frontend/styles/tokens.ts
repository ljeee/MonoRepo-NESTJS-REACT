/**
 * Design tokens — single source of truth for colors, animations, and spacing.
 * Use these in new code. Existing inline values will migrate gradually.
 *
 * Convention:
 *   primary (#F5A524) = action/CTA only (buttons, primary highlights)
 *   warning (#FB923C) = pending/attention states (NEVER reuse primary for warning)
 */

/**
 * Los colores del tema viven en `src/global.css` (`--color-pos-*`): esa es la fuente de verdad y estos valores
 * son su espejo para código que no puede usar clases (SVG, StyleSheet). Si cambias uno, cambia el otro.
 */
export const colors = {
  // Brand
  primary: '#F5A524',          // amber — exclusively for CTAs / brand accent
  primaryDim: 'rgba(245,165,36,0.15)',

  // Semantic (= --color-pos-success / warning / danger / info)
  success: '#34D399',
  successLight: '#34D399',
  danger: '#F43F5E',
  dangerLight: '#F87171',
  warning: '#FB923C',          // distinct orange from primary
  info: '#22D3EE',

  // Surfaces (= --color-pos-bg / surface)
  bg: '#0C0F1A',
  surface: '#151928',
  surfaceAlt: '#080B14',

  // Text. `textDim` era #475569 (contraste ~2.5:1 sobre el fondo, ilegible): ahora #7C8BA1 (~5.5:1).
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#7C8BA1',
  textDim: '#7C8BA1',
} as const;

/**
 * Receta de superficie de una tarjeta (mismas clases que `Card`): úsala para armar un contenedor que no pueda ser
 * un `<Card>`. `card` = tarjeta normal, `solid` = panel sólido (KPI, gráficas), `inset` = caja dentro de otra tarjeta.
 */
export const surface = {
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.07)' },
  solid: { backgroundColor: '#0F172A', borderColor: 'rgba(255,255,255,0.05)' },
  inset: { backgroundColor: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.05)' },
} as const;

/** Escala de espaciado (px) para padding, gap y márgenes. `seccion` separa bloques de una página. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  seccion: 16,
} as const;

// Reanimated spring configs — pick by intent, not feel
export const springs = {
  fast: { damping: 12, stiffness: 200 },     // press feedback (pressIn/pressOut)
  medium: { damping: 15, stiffness: 150 },   // entrance animations
  slow: { damping: 18, stiffness: 100 },     // settling, layout shifts
} as const;

// withTiming durations
export const timings = {
  fast: 200,    // toasts, micro-interactions
  medium: 300,  // sidebars, drawers, navigation transitions
  slow: 400,    // page transitions, large layout shifts
} as const;

// Touch feedback opacity (TouchableOpacity activeOpacity)
export const ACTIVE_OPACITY = 0.75;

// Common hitSlop presets (extend touch area without resizing visual)
export const HIT_SLOP_SM = { top: 6, bottom: 6, left: 6, right: 6 } as const;
export const HIT_SLOP_MD = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const HIT_SLOP_LG = { top: 12, bottom: 12, left: 12, right: 12 } as const;

/**
 * Escala de radios para tarjetas y paneles. Sustituye a los 9 valores sueltos (12…40) que había:
 * sm = chips/etiquetas, md = botones/inputs/cajas internas, lg = tarjetas normales, xl = paneles y modales.
 */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

/** Familias de fuente cargadas en `app/_layout.tsx` (usar estos nombres, no escribirlos a mano). */
export const fonts = {
  /** Títulos y cifras. */
  display: 'SpaceGrotesk-Bold',
  /** Texto corrido y etiquetas. */
  body: 'Outfit',
} as const;

/** Escala tipográfica (px). `micro` (10) es el PISO: solo etiquetas en mayúsculas; el texto que se lee va en `caption` o más. */
export const type = {
  micro: 10,
  caption: 11,
  body: 13,
  bodyLg: 15,
  title: 17,
  kpi: 24,
} as const;
