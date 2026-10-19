import PdfPrinter from 'pdfmake';
import type {TDocumentDefinitions} from 'pdfmake/interfaces';

/**
 * PDF en el servidor con pdfmake 0.2 y las fuentes ESTÁNDAR de PDF (Helvetica): no necesita archivos de fuentes
 * ni dependencias del sistema (sirve igual en Windows y en la imagen Alpine). Esas fuentes usan WinAnsi: las
 * tildes, ñ, ¿¡, «», —, · y • se ven bien; lo que no existe ahí (−, ↳, →, emojis…) se cambia con `textoPdf`.
 */
const FUENTES = {
	Helvetica: {
		normal: 'Helvetica',
		bold: 'Helvetica-Bold',
		italics: 'Helvetica-Oblique',
		bolditalics: 'Helvetica-BoldOblique',
	},
};

const impresora = new PdfPrinter(FUENTES);

/** Caracteres que no están en WinAnsi → su equivalente; el resto fuera de WinAnsi se quita. */
const REEMPLAZOS: Record<string, string> = {'−': '-', '↳': '>', '→': '->', '×': 'x', '✓': 'OK', '✅': '', '…': '...'};
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

export function textoPdf(valor: unknown): string {
	const texto =
		valor == null
			? ''
			: typeof valor === 'object'
				? JSON.stringify(valor)
				: String(valor as string | number | boolean);
	let salida = '';
	for (const ch of texto) {
		if (REEMPLAZOS[ch] != null) salida += REEMPLAZOS[ch];
		else if (ch.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.has(ch)) salida += ch;
	}
	return salida;
}

export function renderizarPdf(doc: TDocumentDefinitions): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		try {
			const pdf = impresora.createPdfKitDocument({
				...doc,
				defaultStyle: {font: 'Helvetica', ...(doc.defaultStyle ?? {})},
			});
			const trozos: Buffer[] = [];
			pdf.on('data', (trozo: Buffer) => trozos.push(trozo));
			pdf.on('end', () => resolve(Buffer.concat(trozos)));
			pdf.on('error', reject);
			pdf.end();
		} catch (error) {
			reject(error instanceof Error ? error : new Error(String(error)));
		}
	});
}
