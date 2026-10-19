/**
 * Utilidades para exportar CSV desde el servidor (contabilidad). Excel abre el archivo con BOM y `;` no hace
 * falta: se usa coma y comillas estándar.
 */

/** Texto seguro para una celda: comillas escapadas y sin inyección de fórmulas (=, +, -, @ al inicio). */
export function celdaTexto(valor: unknown): string {
	let texto = valor == null ? '' : typeof valor === 'string' ? valor : typeof valor === 'number' || typeof valor === 'boolean' ? String(valor) : JSON.stringify(valor);
	if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
	return `"${texto.replace(/"/g, '""')}"`;
}

/** Número tal cual (sin comillas, sin separador de miles) para que Excel lo sume. */
export function celdaNumero(valor: unknown): string {
	const n = Number(valor);
	return Number.isFinite(n) ? String(n) : '0';
}

export function filaCsv(celdas: string[]): string {
	return celdas.join(',') + '\r\n';
}

/** BOM UTF-8: sin él Excel muestra mal las tildes. */
export const BOM_UTF8 = '﻿';
