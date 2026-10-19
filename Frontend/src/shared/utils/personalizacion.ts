import type { Personalizacion, Producto } from '../types/models';

/**
 * Qué modal abre un producto al agregarlo a una orden, además del de sabores.
 * Los sabores ya NO salen de aquí: los decide el grupo de sabores del producto (`saborGrupoId`).
 * `personalizacion` solo distingue la base de jugo ('jugo') de agregar directo ('ninguna'); si no está
 * configurada, un producto con "jugo" en el nombre sigue pidiendo la base (compatibilidad). Los valores
 * heredados 'pizza'/'calzone' se tratan como 'ninguna'.
 */
export function resolverPersonalizacion(producto: Pick<Producto, 'productoNombre' | 'personalizacion'>): Personalizacion {
  const p = producto.personalizacion;
  if (p === 'jugo') return 'jugo';
  if (p === 'ninguna' || p === 'pizza' || p === 'calzone') return 'ninguna';
  return (producto.productoNombre || '').toLowerCase().includes('jugo') ? 'jugo' : 'ninguna';
}

/** Opciones del selector "Al pedir" en Gestión de Productos (los grupos de sabores se eligen aparte). */
export const PERSONALIZACION_OPCIONES: { value: Personalizacion; label: string }[] = [
  { value: 'ninguna', label: 'Ninguna' },
  { value: 'jugo', label: 'Base jugo' },
];
