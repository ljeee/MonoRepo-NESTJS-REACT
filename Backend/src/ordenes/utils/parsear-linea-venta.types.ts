import type {CategoriaProducto, TamanoPizza} from '../../common/utils/catalogo.util';

/** Una línea de `ordenes_productos` tal como está guardada (histórico). */
export interface LineaVentaCruda {
	/** Texto libre de la columna `producto`, p. ej. "Pizza - Grande (Paisa + Carnes)". */
	texto: string | null;
	varianteId: number | null;
	/** Columna `base` ('leche' | 'agua' | null). Fuente autoritativa de la base. */
	base: string | null;
}

export interface VarianteCatalogo {
	varianteId: number;
	nombre: string;
	productoId: number;
	productoNombre: string;
	/** `productos.categoria` si está configurada; si no, la derivada. */
	categoria: CategoriaProducto;
}

export interface ProductoCatalogo {
	productoId: number;
	productoNombre: string;
	categoria: CategoriaProducto;
	/** Solo se buscan por prefijo los productos que tienen variantes (filtra basura legada). */
	tieneVariantes: boolean;
	/** Nombres de sus variantes (para reconocer "<Prod> - <Var>" sin variante_id). */
	variantes: string[];
}

export interface SaborCatalogo {
	saborId: number;
	nombre: string;
	tipo: string;
	/**
	 * true = sabor de un grupo cuya variante ES el sabor (calzone); false = sabor de pizza u otro grupo; undefined =
	 * se desconoce. Pizza y calzone comparten nombres ("Carnes", "De Casa"…): al leer una línea se prefiere el sabor de
	 * su misma familia para no mezclar los calzones con los sabores de pizza en la analítica.
	 */
	esCalzone?: boolean;
}

export interface ContextoCatalogo {
	variantes: Map<number, VarianteCatalogo>;
	productos: ProductoCatalogo[];
	/** Sin filas `tipo = 'configuracion'` (p. ej. RECARGO_3_SABORES). */
	sabores: SaborCatalogo[];
}

export interface SaborParseado {
	/** null = sabor no reconocido en el catálogo ("sin clasificar"). */
	saborId: number | null;
	nombre: string;
	posicion: number;
	/** 1/n donde n = número de sabores distintos de la línea. */
	fraccion: number;
}

export type MotivoParseo = 'ok' | 'sin-producto' | 'sin-texto';

export interface ResultadoParseo {
	productoId: number | null;
	productoBase: string | null;
	varianteNombre: string | null;
	/** Solo para categoría pizza. */
	tamano: TamanoPizza | null;
	categoria: CategoriaProducto | null;
	/** Solo pizza y calzone generan sabores. */
	sabores: SaborParseado[];
	motivo: MotivoParseo;
}
