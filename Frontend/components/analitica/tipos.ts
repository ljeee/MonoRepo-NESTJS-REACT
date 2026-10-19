import type { FiltrosAnalitica } from '@/src/shared';
import type { ClaveFiltro, FiltrosExtra } from '../../hooks/use-analitica-filtros';

export type TabAnalitica = 'resumen' | 'productos' | 'sabores' | 'horarios' | 'clientes' | 'domiciliarios';

export interface PropsTabAnalitica {
  /** Filtros + rango confirmados (lo que se consulta). */
  consulta: FiltrosAnalitica;
  /** Sube con cada `stats:update` relevante: fuerza recargar. */
  version: number;
  /** Agrega/reemplaza un filtro (profundizar desde una fila o barra). */
  onFiltrar: <K extends ClaveFiltro>(clave: K, valor: FiltrosExtra[K] | undefined) => void;
  /** Cambia de pestaña (p. ej. del top de sabores del resumen a la pestaña Sabores). */
  onIrA: (tab: TabAnalitica) => void;
}
