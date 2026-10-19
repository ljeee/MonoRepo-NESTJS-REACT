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

/**
 * Ancho mínimo y máximo de columnas por tipo de tarjeta. Las columnas salen del ANCHO REAL del contenedor
 * (no del de la ventana: el menú lateral y el `max-w` de la página lo reducen), así que la misma regla
 * sirve en móvil, tablet y escritorio, web y APK.
 */
export const GRID_KINDS = {
  kpi: { minItemWidth: 160, maxColumns: 4 },
  factura: { minItemWidth: 320, maxColumns: 4 },
  orden: { minItemWidth: 300, maxColumns: 3 },
  persona: { minItemWidth: 340, maxColumns: 3 },
  panel: { minItemWidth: 420, maxColumns: 2 },
} as const;

export type GridKind = keyof typeof GRID_KINDS;

/** Cuántas columnas caben en `containerWidth` con items de al menos `minItemWidth` y `gap` entre ellos (mínimo 1). */
export function calcularColumnas(containerWidth: number, minItemWidth: number, maxColumns: number, gap: number): number {
  if (!(containerWidth > 0)) return 1;
  const caben = Math.floor((containerWidth + gap) / (minItemWidth + gap));
  return Math.max(1, Math.min(maxColumns, caben));
}
