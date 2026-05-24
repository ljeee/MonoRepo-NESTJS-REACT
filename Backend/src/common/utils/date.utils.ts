/**
 * Helpers para el manejo de zona horaria America/Bogota (UTC-5)
 */

/**
 * Retorna la fecha local en formato YYYY-MM-DD en la zona horaria de Bogotá
 */
export function getBogotaDateString(date: Date = new Date()): string {
	const formatter = new Intl.DateTimeFormat('sv-SE', {
		timeZone: 'America/Bogota',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	});
	return formatter.format(date);
}

/**
 * Genera los límites exactos de inicio (00:00:00) y fin (23:59:59.999) del día
 * en la zona horaria de Bogotá, representados como objetos Date con offset -05:00.
 * Útil para búsquedas exactas con timestamptz.
 */
export function getBogotaDayBoundaries(dateStr?: string): { start: Date; end: Date } {
	const baseDate = dateStr || getBogotaDateString();
	const start = new Date(`${baseDate}T00:00:00-05:00`);
	const end = new Date(`${baseDate}T23:59:59.999-05:00`);
	return { start, end };
}
