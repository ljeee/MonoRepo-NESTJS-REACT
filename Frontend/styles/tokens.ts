/**
 * Design tokens — single source of truth for colors, animations, and spacing.
 * Use these in new code. Existing inline values will migrate gradually.
 *
 * Convention:
 *   primary (#F5A524) = action/CTA only (buttons, primary highlights)
 *   warning (#FB923C) = pending/attention states (NEVER reuse primary for warning)
 */

export const colors = {
  // Brand
  primary: '#F5A524',          // amber — exclusively for CTAs / brand accent
  primaryDim: 'rgba(245,165,36,0.15)',

  // Semantic
  success: '#10B981',
  successLight: '#34D399',
  danger: '#EF4444',
  dangerLight: '#F87171',
  warning: '#FB923C',          // distinct orange from primary
  info: '#3B82F6',

  // Surfaces
  bg: '#060E1A',
  surface: '#0C0F1A',
  surfaceAlt: '#080B14',

  // Text
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textDim: '#475569',
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
