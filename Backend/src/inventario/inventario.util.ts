import {normalizarTamano, normalizarTexto} from '../common/utils/catalogo.util';

/**
 * Reglas puras del inventario unificado. Las usan el servicio, la migración
 * `inventario-unificado-v1` y las sugerencias de reglas: una sola versión de cada una.
 */

export const TIPOS_ITEM_INVENTARIO = ['caja', 'bebida'] as const;
export type TipoItemInventario = (typeof TIPOS_ITEM_INVENTARIO)[number];

export const CATEGORIAS_CAJA = ['pequena', 'mediana', 'grande', 'calzone', 'otra'] as const;
export type CategoriaCaja = (typeof CATEGORIAS_CAJA)[number];

/** Solo bebidas embotelladas llevan stock; jugos y limonadas preparados no. */
export const CATEGORIAS_BEBIDA = ['gaseosa', 'agua', 'cerveza', 'otra'] as const;
export type CategoriaBebida = (typeof CATEGORIAS_BEBIDA)[number];

/** Movimientos que registra la gente. `venta`/`devolucion` los escribe solo la reconciliación de órdenes. */
export const TIPOS_MOVIMIENTO_MANUAL = ['entrada', 'salida', 'ajuste', 'conteo'] as const;
export type TipoMovimientoManual = (typeof TIPOS_MOVIMIENTO_MANUAL)[number];
export type TipoMovimiento = TipoMovimientoManual | 'venta' | 'devolucion' | 'migracion';

export type EstadoStock = 'ok' | 'bajo' | 'critico';

/** Misma regla que mostraba la pantalla (`clasificar`): ahora la calcula el servidor. */
export function estadoStock(cantidad: number, alerta: number | null | undefined): EstadoStock {
	if (cantidad <= 0) return 'critico';
	if (alerta == null) return 'ok';
	if (cantidad <= alerta) return 'critico';
	if (cantidad <= alerta * 1.5) return 'bajo';
	return 'ok';
}

/** Categoría de una caja a partir del nombre libre que le puso el admin. */
export function categoriaCajaPorNombre(nombre?: string | null): CategoriaCaja {
	const n = normalizarTexto(nombre);
	if (/calzon/.test(n)) return 'calzone';
	if (/pequen|personal/.test(n)) return 'pequena';
	if (/median/.test(n)) return 'mediana';
	if (/grand/.test(n)) return 'grande';
	return 'otra';
}

/**
 * Qué caja gasta una variante vendida (para las reglas automáticas). Null = no lleva caja.
 *
 * Reemplaza la clasificación por TEXTO de la línea vendida, que hacía gastar una caja
 * pequeña a "Coca Cola Personal" y una grande a "Adición de Queso Grande". Ahora solo
 * pizzas y calzones (por la categoría del producto) y lo "encajado" llevan caja.
 */
export function categoriaCajaDeVariante(
	categoriaProducto: string | null | undefined,
	productoNombre: string | null | undefined,
	varianteNombre: string | null | undefined,
): Exclude<CategoriaCaja, 'otra'> | null {
	const producto = normalizarTexto(productoNombre);
	const variante = normalizarTexto(varianteNombre);
	if (/encajad/.test(producto) || /encajad/.test(variante)) return 'pequena';
	if (/\badicion/.test(variante)) return null;
	if (categoriaProducto === 'calzone') return 'calzone';
	if (categoriaProducto !== 'pizza') return null;
	return normalizarTamano(varianteNombre) ?? 'grande';
}

/**
 * Categoría de bebida por nombre (producto + variante). 'jugo' = preparado (no lleva
 * stock). Null = no parece una bebida.
 */
export function categoriaBebidaPorNombre(texto?: string | null): CategoriaBebida | 'jugo' | null {
	const n = normalizarTexto(texto);
	if (!n) return null;
	if (/\bjugo|limonada|\bpulpa|batido|malteada|\bmilo\b/.test(n)) return 'jugo';
	if (/cerveza|\bpoker\b|\baguila\b|club colombia|\bcorona\b|\bheineken\b|\bcosteña/.test(n)) return 'cerveza';
	if (/\bagua\b|\bbrisa\b|\bcristal\b/.test(n)) return 'agua';
	if (
		/gaseosa|\bsoda\b|coca[\s-]?cola|\bpepsi\b|postobon|\bsprite\b|\bquatro\b|colombiana|\b7up\b|\bkola\b/.test(n)
	) {
		return 'gaseosa';
	}
	if (/\bbebida|gatorade|hidrat|energizante|\bte\b|\bhit\b/.test(n)) return 'otra';
	return null;
}

/** "Gaseosa" + "Coca Cola 400ml" → "Gaseosa Coca Cola 400ml"; sin repetir si la variante ya lo dice. */
export function nombreItemBebida(productoNombre: string, varianteNombre: string): string {
	const producto = (productoNombre ?? '').trim();
	const variante = (varianteNombre ?? '').trim();
	if (!producto) return variante;
	if (!variante || normalizarTexto(variante).includes(normalizarTexto(producto))) return variante || producto;
	return `${producto} ${variante}`.replace(/\s+/g, ' ');
}

/**
 * Cuánto mueve un movimiento manual y cuánto se aplica de verdad (el stock nunca baja
 * de 0). `conteo` fija el valor absoluto contado; `ajuste` es un delta con signo.
 */
export function calcularMovimiento(
	actual: number,
	tipo: TipoMovimientoManual,
	cantidad: number,
): {delta: number; aplicado: number; resultante: number} {
	const delta =
		tipo === 'entrada'
			? Math.abs(cantidad)
			: tipo === 'salida'
				? -Math.abs(cantidad)
				: tipo === 'conteo'
					? cantidad - actual
					: cantidad;
	const resultante = Math.max(0, actual + delta);
	return {delta, aplicado: resultante - actual, resultante};
}
