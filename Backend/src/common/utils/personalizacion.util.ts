export type Personalizacion = 'pizza' | 'calzone' | 'jugo' | 'ninguna';

/**
 * Resuelve el tipo de personalización de un producto al agregarlo a una orden.
 * Usa el campo configurado `personalizacion`; si es null/indefinido, cae al
 * fallback por nombre (compatibilidad con productos creados antes del campo).
 */
export function resolverPersonalizacion(
	productoNombre?: string | null,
	personalizacion?: string | null,
): Personalizacion {
	if (
		personalizacion === 'pizza' ||
		personalizacion === 'calzone' ||
		personalizacion === 'jugo' ||
		personalizacion === 'ninguna'
	) {
		return personalizacion;
	}
	const n = (productoNombre || '').toLowerCase();
	if (n.includes('pizza') && !n.includes('burguer')) return 'pizza';
	if (n.includes('calzone')) return 'calzone';
	if (n.includes('jugo')) return 'jugo';
	return 'ninguna';
}
