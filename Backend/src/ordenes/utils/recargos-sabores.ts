import {TamanoPizza, normalizarTamano} from '../../common/utils/catalogo.util';

/** Lo mínimo del grupo de sabores que necesita el cálculo (lo que guarda `sabor_grupos`). */
export interface ReglasGrupo {
	usaTamano: boolean;
	recargoExtraDesde: number | null;
	recargoExtraPequena: number;
	recargoExtraMediana: number;
	recargoExtraGrande: number;
}

/** Recargo por tamaño de un sabor (llegan como string desde `numeric`, por eso se convierten). */
export interface RecargosSabor {
	recargoPequena: number | string;
	recargoMediana: number | string;
	recargoGrande: number | string;
}

export type ClaveTamano = 'Pequena' | 'Mediana' | 'Grande';

/**
 * Tamaño de una variante: el explícito (`producto_variantes.tamano`) o, si no hay, el que dice su nombre
 * ("Pequeña", "Personal", "Mediana", "Grande"). Null si no se reconoce.
 */
export function tamanoDeVariante(variante: {nombre?: string | null; tamano?: string | null}): TamanoPizza | null {
	const explicito = variante.tamano;
	if (explicito === 'pequena' || explicito === 'mediana' || explicito === 'grande') return explicito;
	return normalizarTamano(variante.nombre);
}

/**
 * Columna de recargo que aplica. Un grupo sin tamaños cobra siempre la columna "grande" (su único valor);
 * con tamaños, la del tamaño de la variante y, si no se reconoce, la grande (como siempre).
 */
export function claveTamano(grupo: Pick<ReglasGrupo, 'usaTamano'>, tamano: TamanoPizza | null): ClaveTamano {
	if (!grupo.usaTamano) return 'Grande';
	return tamano === 'pequena' ? 'Pequena' : tamano === 'mediana' ? 'Mediana' : 'Grande';
}

export interface RecargoCalculado {
	/** El mayor recargo entre los sabores pedidos (no se suman). */
	porSabor: number;
	/** Recargo por pedir varios sabores (pizza: desde 3). */
	porCantidad: number;
	total: number;
}

/**
 * Recargo de una unidad con sabores, según las reglas de su grupo:
 *  - por sabor: el mayor `recargo_<tamaño>` entre los sabores pedidos (0 = no cobra);
 *  - por cantidad: `recargoExtra<tamaño>` cuando se piden `recargoExtraDesde` sabores o más.
 * `sabores` son las filas del grupo que coinciden con los nombres pedidos; `cantidadPedida` cuenta los
 * nombres tal como llegaron (aunque alguno no exista en el catálogo).
 */
export function calcularRecargoSabores(
	grupo: ReglasGrupo,
	sabores: RecargosSabor[],
	cantidadPedida: number,
	tamano: TamanoPizza | null,
): RecargoCalculado {
	const clave = claveTamano(grupo, tamano);
	const columna = `recargo${clave}` as keyof RecargosSabor;
	const porSabor = sabores.reduce((max, s) => Math.max(max, Number(s[columna]) || 0), 0);

	const desde = grupo.recargoExtraDesde;
	const porCantidad =
		desde != null && cantidadPedida >= desde ? Number(grupo[`recargoExtra${clave}` as keyof ReglasGrupo]) || 0 : 0;

	return {porSabor, porCantidad, total: porSabor + porCantidad};
}
