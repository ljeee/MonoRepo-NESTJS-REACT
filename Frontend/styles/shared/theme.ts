/**
 * Design System Colors
 * Central definition of all colors used in the application
 */

export const colors = {
  // Brand Colors
  primary: '#10B981', // green-500
  primaryLight: 'rgba(16, 185, 129, 0.1)',
  secondary: '#6366F1', // indigo-500
  secondaryLight: 'rgba(99, 102, 241, 0.15)',
  
  // Neutral Colors
  bg: '#0F172A', // slate-900 (Dark background)
  bgLight: '#1E293B', // slate-800
  card: '#1E293B', // slate-800
  border: '#334155', // slate-700
  divider: 'rgba(255, 255, 255, 0.1)',
  text: '#F8FAFC', // slate-50
  textSecondary: '#E2E8F0', // slate-200
  textTertiary: '#CBD5E1', // slate-300
  textMuted: '#94A3B8', // slate-400
  
  // Status Colors
  success: '#10B981',
  successLight: 'rgba(16, 185, 129, 0.15)',
  danger: '#EF4444',
  dangerLight: 'rgba(239, 68, 68, 0.15)',
  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  info: '#3B82F6',
  infoLight: 'rgba(59, 130, 246, 0.15)',
  
  // Constants
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;
