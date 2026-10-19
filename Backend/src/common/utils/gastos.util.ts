/**
 * Clasificación contable de los egresos (`facturas_pagos`).
 *
 * - COSTO: lo que se gasta para producir lo que se vende (insumos, mercancía para reventa,
 *   empaques). Restado a las ventas da la utilidad bruta.
 * - GASTO: lo que cuesta operar el negocio (nómina, servicios, arriendo…).
 *
 * La categoría trae un tipo por defecto, pero el tipo se guarda aparte (`tipo_gasto`) para
 * poder corregirlo: p. ej. la nómina de cocina puede contarse como costo. Un egreso sin
 * `tipo_gasto` (todo el histórico) se reporta como "sin clasificar".
 *
 * Espejo en el frontend: Frontend/src/shared/constants/gastos.ts (mantener alineados).
 */

export const TIPOS_GASTO = ['costo', 'gasto'] as const;
export type TipoGasto = (typeof TIPOS_GASTO)[number];

/** Categoría que traían todos los egresos antes de la clasificación (valor por defecto de la columna). */
export const CATEGORIA_GENERAL = 'general';

export interface CategoriaGasto {
	id: string;
	nombre: string;
	/** Tipo con el que se clasifica si no se elige otro. */
	tipo: TipoGasto;
}

export const CATEGORIAS_GASTO: readonly CategoriaGasto[] = [
	{id: 'insumos', nombre: 'Insumos y materia prima', tipo: 'costo'},
	{id: 'mercancia', nombre: 'Bebidas y mercancía para reventa', tipo: 'costo'},
	{id: 'empaques', nombre: 'Empaques y desechables', tipo: 'costo'},
	{id: 'nomina', nombre: 'Nómina', tipo: 'gasto'},
	{id: 'servicios', nombre: 'Servicios (luz, agua, gas, internet)', tipo: 'gasto'},
	{id: 'arriendo', nombre: 'Arriendo', tipo: 'gasto'},
	{id: 'mantenimiento', nombre: 'Mantenimiento y reparaciones', tipo: 'gasto'},
	{id: 'transporte', nombre: 'Transporte y fletes', tipo: 'gasto'},
	{id: 'publicidad', nombre: 'Publicidad', tipo: 'gasto'},
	{id: 'impuestos', nombre: 'Impuestos y trámites', tipo: 'gasto'},
	{id: 'otros', nombre: 'Otros gastos', tipo: 'gasto'},
];

/** Valores que acepta `categoria` (incluye 'general', el valor histórico). */
export const IDS_CATEGORIA_GASTO: readonly string[] = [CATEGORIA_GENERAL, ...CATEGORIAS_GASTO.map((c) => c.id)];

/** Tipo por defecto de una categoría; null si es 'general' o desconocida (queda sin clasificar). */
export function tipoPorCategoria(categoria?: string | null): TipoGasto | null {
	return CATEGORIAS_GASTO.find((c) => c.id === categoria)?.tipo ?? null;
}
