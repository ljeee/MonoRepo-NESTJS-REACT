/**
 * Grupos de sabores con los que arranca el sistema: reproducen exactamente cómo se vendían pizza y calzone
 * antes de que las reglas fueran datos. Los usan la siembra de una instalación nueva y la migración
 * `sabor-grupos-v1`. Después el admin los edita o crea los suyos desde la pantalla de sabores.
 */
export interface GrupoBase {
	nombre: string;
	maxSabores: number;
	varianteEsSabor: boolean;
	usaTamano: boolean;
	recargoExtraDesde: number | null;
	recargoExtraPequena: number;
	recargoExtraMediana: number;
	recargoExtraGrande: number;
	orden: number;
}

/** Recargo por tres sabores que se cobraba cuando la fila de configuración no tenía valor para el tamaño. */
export const RECARGO_TRES_SABORES_POR_DEFECTO = 3000;

export const GRUPO_PIZZA: GrupoBase = {
	nombre: 'Pizza',
	maxSabores: 3,
	varianteEsSabor: false,
	usaTamano: true,
	recargoExtraDesde: 3,
	recargoExtraPequena: RECARGO_TRES_SABORES_POR_DEFECTO,
	recargoExtraMediana: RECARGO_TRES_SABORES_POR_DEFECTO,
	recargoExtraGrande: RECARGO_TRES_SABORES_POR_DEFECTO,
	orden: 1,
};

/** Calzone: sus variantes SON los sabores, precio plano, hasta 2 sabores. */
export const GRUPO_CALZONE: GrupoBase = {
	nombre: 'Calzone',
	maxSabores: 2,
	varianteEsSabor: true,
	usaTamano: false,
	recargoExtraDesde: null,
	recargoExtraPequena: 0,
	recargoExtraMediana: 0,
	recargoExtraGrande: 0,
	orden: 2,
};

export const GRUPOS_BASE: GrupoBase[] = [GRUPO_PIZZA, GRUPO_CALZONE];
