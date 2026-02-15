import { useWindowDimensions } from 'react-native';

/**
 * Breakpoints for responsive design
 */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * Hook to get current breakpoint status
 */
export function useBreakpoint() {
  const { width } = useWindowDimensions();

  const isMobile = width < breakpoints.md;
  const isTablet = width >= breakpoints.md && width < breakpoints.lg;
  const isDesktop = width >= breakpoints.lg;

  return {
    width,
    isMobile,
    isTablet,
    isDesktop,
    breakpoint: isMobile ? 'sm' : isTablet ? 'md' : 'lg',
  };
}

/**
 * Utility to help with responsive styles
 */
export const responsive = {
  select: <T>(map: { sm?: T; md?: T; lg?: T; default: T }, width: number): T => {
    if (width >= breakpoints.lg && map.lg !== undefined) return map.lg;
    if (width >= breakpoints.md && map.md !== undefined) return map.md;
    if (width >= breakpoints.sm && map.sm !== undefined) return map.sm;
    return map.default;
  }
};
