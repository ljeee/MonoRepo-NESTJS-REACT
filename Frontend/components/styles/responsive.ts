import { useWindowDimensions } from 'react-native';

export type Breakpoints = {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
};

// Breakpoint values
export const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
  largeDesktop: 1440,
} as const;

export function useBreakpoint(): Breakpoints {
  const { width, height } = useWindowDimensions();
  const isMobile = width < BREAKPOINTS.mobile;
  const isTablet = width >= BREAKPOINTS.mobile && width < BREAKPOINTS.desktop;
  const isDesktop = width >= BREAKPOINTS.desktop && width < BREAKPOINTS.largeDesktop;
  const isLargeDesktop = width >= BREAKPOINTS.largeDesktop;
  
  return { width, height, isMobile, isTablet, isDesktop, isLargeDesktop };
}

// Helper function to get responsive value based on screen size
export function getResponsiveValue<T>(
  breakpoint: Breakpoints,
  values: {
    mobile?: T;
    tablet?: T;
    desktop?: T;
    largeDesktop?: T;
    default: T;
  }
): T {
  if (breakpoint.isMobile && values.mobile !== undefined) return values.mobile;
  if (breakpoint.isTablet && values.tablet !== undefined) return values.tablet;
  if (breakpoint.isDesktop && values.desktop !== undefined) return values.desktop;
  if (breakpoint.isLargeDesktop && values.largeDesktop !== undefined) return values.largeDesktop;
  return values.default;
}

// Helper to get max width for content containers
export function getMaxContentWidth(breakpoint: Breakpoints): number {
  return getResponsiveValue(breakpoint, {
    mobile: breakpoint.width - 32, // Full width with padding
    tablet: 700,
    desktop: 900,
    largeDesktop: 1200,
    default: 900,
  });
}
