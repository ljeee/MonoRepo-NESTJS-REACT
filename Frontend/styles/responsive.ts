import { useWindowDimensions } from 'react-native';

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export const useBreakpoint = () => {
  const { width } = useWindowDimensions();

  return {
    width,
    isMobile: width < breakpoints.md,
    isTablet: width >= breakpoints.md && width < breakpoints.lg,
    isDesktop: width >= breakpoints.lg,
    breakpoint: width < breakpoints.md ? 'sm' : width < breakpoints.lg ? 'md' : 'lg',
  };
};

export const responsive = {
  isMobile: (width: number) => width < breakpoints.md,
  isTablet: (width: number) => width >= breakpoints.md && width < breakpoints.lg,
  isDesktop: (width: number) => width >= breakpoints.lg,
};
