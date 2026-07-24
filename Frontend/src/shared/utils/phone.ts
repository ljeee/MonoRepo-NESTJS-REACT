// Teléfonos colombianos.
//
// El sistema guarda SIEMPRE el número local de 10 dígitos (sin indicativo, sin
// separadores) — es la forma con la que se creó la base y la que usa
// `GET /domicilios/me` para matchear `telefonoDomiciliarioAsignado` contra el
// `username` del usuario domiciliario. Pero al copiar un número desde WhatsApp,
// la app de contactos o el historial de llamadas llega con indicativo y
// espacios ("+57 300 123 4567", "573001234567", "(+57) 300-123-4567"), y al
// pegarlo tal cual quedaba guardado distinto y dejaba de matchear.
//
// `normalizePhone` es el único punto de entrada: todo campo de teléfono lo
// aplica al escribir/pegar. Para marcar o abrir WhatsApp se vuelve a añadir el
// indicativo con `toDialablePhone` / `toWhatsappPhone`.

export const COUNTRY_CODE = '57';
const LOCAL_LENGTH = 10;

/**
 * Deja el número en su forma canónica de almacenamiento: solo dígitos, sin
 * indicativo de país.
 *
 *   "+57 300 123 4567" → "3001234567"
 *   "573001234567"     → "3001234567"
 *   "0057 3001234567"  → "3001234567"
 *   "300 123 4567"     → "3001234567"
 */
export function normalizePhone(raw: string | null | undefined): string {
	if (!raw) return '';

	let digits = String(raw).replace(/\D/g, '');

	// Prefijo internacional marcado como "00" (formato europeo de discado).
	if (digits.startsWith('00')) digits = digits.slice(2);

	// Quitar el indicativo solo cuando lo que queda son exactamente los 10
	// dígitos locales. Así un número local que casualmente empiece por "57"
	// (p. ej. un fijo "5712345678") no se mutila.
	if (digits.length === COUNTRY_CODE.length + LOCAL_LENGTH && digits.startsWith(COUNTRY_CODE)) {
		digits = digits.slice(COUNTRY_CODE.length);
	}

	return digits;
}

/** Número listo para `tel:` — con indicativo si es un celular local válido. */
export function toDialablePhone(raw: string | null | undefined): string {
	const local = normalizePhone(raw);
	if (!local) return '';
	return local.length === LOCAL_LENGTH ? `+${COUNTRY_CODE}${local}` : local;
}

/** Número listo para `wa.me/` — con indicativo pero sin el "+". */
export function toWhatsappPhone(raw: string | null | undefined): string {
	const local = normalizePhone(raw);
	if (!local) return '';
	return local.length === LOCAL_LENGTH ? `${COUNTRY_CODE}${local}` : local;
}

/** "3001234567" → "300 123 4567" (solo para mostrar, nunca para guardar). */
export function formatPhoneDisplay(raw: string | null | undefined): string {
	const local = normalizePhone(raw);
	if (local.length !== LOCAL_LENGTH) return local;
	return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
