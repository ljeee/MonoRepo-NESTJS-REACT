/**
 * Helpers de catálogo compartidos por la escritura de líneas de venta, el backfill
 * del histórico y la analítica. Mantener aquí una sola versión de cada regla.
 */

export const CATEGORIAS_PRODUCTO = ['pizza', 'calzone', 'bebida', 'jugo', 'adicion', 'comida', 'otro'] as const;
export type CategoriaProducto = (typeof CATEGORIAS_PRODUCTO)[number];

export type TamanoPizza = 'pequena' | 'mediana' | 'grande';

/** minúsculas, sin tildes, espacios colapsados. Base de toda comparación de nombres. */
export function normalizarTexto(valor?: string | null): string {
	return (valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Clave de tamaño de pizza a partir del nombre de la variante (o de la palabra de
 * tamaño en textos legados). `personal` es alias de `pequena`. Null si no hay tamaño.
 */
export function normalizarTamano(nombre?: string | null): TamanoPizza | null {
	const n = normalizarTexto(nombre);
	if (!n) return null;
	if (/\bpeque(n|ñ)a?\b|\bpequen|\bpersonal\b/.test(n)) return 'pequena';
	if (/\bmedian[oa]?\b/.test(n)) return 'mediana';
	if (/\bgrande\b/.test(n)) return 'grande';
	return null;
}

export function esCategoriaProducto(valor: unknown): valor is CategoriaProducto {
	return typeof valor === 'string' && (CATEGORIAS_PRODUCTO as readonly string[]).includes(valor);
}

/**
 * Categoría por defecto de un producto. `personalizacion` (configurada por el admin)
 * manda para pizza/calzone/jugo; si no, se deduce del nombre. El resultado es solo
 * un valor inicial: el admin puede corregirlo en el catálogo.
 */
export function derivarCategoriaProducto(
	productoNombre?: string | null,
	personalizacion?: string | null,
): CategoriaProducto {
	if (personalizacion === 'pizza' || personalizacion === 'calzone' || personalizacion === 'jugo') {
		return personalizacion;
	}
	const n = normalizarTexto(productoNombre);
	if (/\badicion/.test(n)) return 'adicion';
	if (/\bjugo|\blimonada|\bpulpa|\bbatido|\bmalteada/.test(n)) return 'jugo';
	if (
		/gaseosa|\bbebida|\bagua\b|\bcerveza|\bsoda\b|coca[\s-]?cola|pepsi|postobon|gatorade|hidrat|\bmilo\b|\bte\b/.test(
			n,
		)
	) {
		return 'bebida';
	}
	if (/\bcalzone/.test(n)) return 'calzone';
	// "Pizza Burguer" es una hamburguesa con nombre de pizza: no lleva sabores ni tamaño.
	if (/burguer|burger|hamburg|\bpapas?\b|encajad|salchipapa|\bchuzo|\balitas?\b|\bperro\b/.test(n)) return 'comida';
	if (/\bpizza/.test(n)) return 'pizza';
	return 'otro';
}

const PALABRAS_VACIAS_SABOR = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'al']);

/**
 * Clave tolerante para emparejar sabores escritos distinto: ignora artículos y
 * preposiciones ("De Casa" ≈ "De la Casa", "Pollo con Champiñones" ≈ "Pollo
 * Champiñones"). Se usa SOLO como segundo intento, después de la coincidencia exacta.
 */
export function claveSabor(nombre?: string | null): string {
	return normalizarTexto(nombre)
		.split(' ')
		.filter((palabra) => palabra && !PALABRAS_VACIAS_SABOR.has(palabra))
		.join(' ');
}
