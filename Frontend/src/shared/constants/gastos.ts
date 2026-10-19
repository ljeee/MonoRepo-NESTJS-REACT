// ─── Clasificación contable de los egresos (facturas_pagos) ──────────────────
// Espejo de Backend/src/common/utils/gastos.util.ts (mantener alineados).
//  - COSTO: lo que se gasta para producir lo que se vende (insumos, mercancía, empaques).
//    Ventas − costos = utilidad bruta.
//  - GASTO: lo que cuesta operar el negocio (nómina, servicios, arriendo…).
// La categoría trae un tipo por defecto, pero el tipo se elige aparte: p. ej. la nómina
// de la cocina puede contarse como costo. Un egreso sin tipo (histórico) es "sin clasificar".
// RN/TS puro: RiderApp compila este archivo vía @/src/shared.

import type { TipoGasto } from '../types/models';

export type TipoGastoFiltro = TipoGasto | 'sin_clasificar';

export interface CategoriaGasto {
  id: string;
  nombre: string;
  /** Nombre corto para chips. */
  corto: string;
  /** Tipo con el que se clasifica si no se elige otro. */
  tipo: TipoGasto;
  /** Nombre de MaterialCommunityIcons */
  icon: string;
}

/** Categoría que traían todos los egresos antes de la clasificación. */
export const CATEGORIA_GENERAL = 'general';

export const CATEGORIAS_GASTO: readonly CategoriaGasto[] = [
  { id: 'insumos', nombre: 'Insumos y materia prima', corto: 'Insumos', tipo: 'costo', icon: 'food-variant' },
  { id: 'mercancia', nombre: 'Bebidas y mercancía para reventa', corto: 'Mercancía', tipo: 'costo', icon: 'bottle-soda-outline' },
  { id: 'empaques', nombre: 'Empaques y desechables', corto: 'Empaques', tipo: 'costo', icon: 'package-variant-closed' },
  { id: 'nomina', nombre: 'Nómina', corto: 'Nómina', tipo: 'gasto', icon: 'account-cash-outline' },
  { id: 'servicios', nombre: 'Servicios (luz, agua, gas, internet)', corto: 'Servicios', tipo: 'gasto', icon: 'lightning-bolt-outline' },
  { id: 'arriendo', nombre: 'Arriendo', corto: 'Arriendo', tipo: 'gasto', icon: 'home-city-outline' },
  { id: 'mantenimiento', nombre: 'Mantenimiento y reparaciones', corto: 'Mantenimiento', tipo: 'gasto', icon: 'wrench-outline' },
  { id: 'transporte', nombre: 'Transporte y fletes', corto: 'Transporte', tipo: 'gasto', icon: 'truck-outline' },
  { id: 'publicidad', nombre: 'Publicidad', corto: 'Publicidad', tipo: 'gasto', icon: 'bullhorn-outline' },
  { id: 'impuestos', nombre: 'Impuestos y trámites', corto: 'Impuestos', tipo: 'gasto', icon: 'bank-outline' },
  { id: 'otros', nombre: 'Otros gastos', corto: 'Otros', tipo: 'gasto', icon: 'dots-horizontal-circle-outline' },
];

export const TIPO_GASTO_META: Record<TipoGastoFiltro, { label: string; descripcion: string; color: string }> = {
  costo: { label: 'Costo', descripcion: 'Insumos, mercancía y empaques: lo que cuesta producir lo que se vende', color: '#F59E0B' },
  gasto: { label: 'Gasto operativo', descripcion: 'Nómina, servicios, arriendo y demás costos de operar', color: '#EF4444' },
  sin_clasificar: { label: 'Sin clasificar', descripcion: 'Egresos registrados antes de la clasificación', color: '#94A3B8' },
};

/** Tipo por defecto de una categoría; null si es 'general' o desconocida. */
export function tipoPorCategoria(categoria?: string | null): TipoGasto | null {
  return CATEGORIAS_GASTO.find((c) => c.id === categoria)?.tipo ?? null;
}

/** Nombre legible de una categoría ('general' o vacía = "Sin categoría"). */
export function nombreCategoria(categoria?: string | null): string {
  if (!categoria || categoria === CATEGORIA_GENERAL) return 'Sin categoría';
  return CATEGORIAS_GASTO.find((c) => c.id === categoria)?.nombre ?? categoria;
}

/** Tipo efectivo de un egreso: el guardado, o 'sin_clasificar' si no tiene. */
export function tipoDeGasto(g: { tipoGasto?: string | null }): TipoGastoFiltro {
  return g.tipoGasto === 'costo' || g.tipoGasto === 'gasto' ? g.tipoGasto : 'sin_clasificar';
}
