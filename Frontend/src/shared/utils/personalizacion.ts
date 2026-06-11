import type { Personalizacion, Producto } from '../types/models';

/**
 * Resuelve el tipo de personalización de un producto al agregarlo a una orden.
 * Usa el campo configurado `personalizacion`; si es null/indefinido, cae al
 * fallback por nombre (compatibilidad con productos creados antes del campo).
 * Misma lógica que el backend (`common/utils/personalizacion.util.ts`).
 */
export function resolverPersonalizacion(producto: Pick<Producto, 'productoNombre' | 'personalizacion'>): Personalizacion {
  const p = producto.personalizacion;
  if (p === 'pizza' || p === 'calzone' || p === 'jugo' || p === 'ninguna') return p;
  const n = (producto.productoNombre || '').toLowerCase();
  if (n.includes('pizza') && !n.includes('burguer')) return 'pizza';
  if (n.includes('calzone')) return 'calzone';
  if (n.includes('jugo')) return 'jugo';
  return 'ninguna';
}

/** Opciones para el selector de personalización en Gestión de Productos */
export const PERSONALIZACION_OPCIONES: { value: Personalizacion; label: string }[] = [
  { value: 'ninguna', label: 'Ninguna' },
  { value: 'pizza', label: 'Sabores pizza' },
  { value: 'calzone', label: 'Sabores propios' },
  { value: 'jugo', label: 'Base jugo' },
];
