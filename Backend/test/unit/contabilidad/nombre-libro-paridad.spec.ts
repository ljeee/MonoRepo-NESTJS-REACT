import {nombreArchivoLibro} from '../../../src/contabilidad/libro-diario/libro-diario.formato';
import {nombreArchivoLibroDiario} from '../../../../Frontend/src/shared/domain/contabilidad';

/**
 * El nombre del archivo del libro diario se arma en DOS sitios: el servidor (adjuntos del correo del cierre y la
 * descarga directa) y el POS (el PDF que se abre en una pestaña y el CSV). Deben coincidir para que el libro que se
 * baja en el POS se llame igual que el que llega por correo: libro-diario[-transferencias|-cuenta-x]-<fecha>.
 */
describe('Nombre del archivo del libro diario: servidor = POS', () => {
	const casos: [
		{
			from: string;
			to: string;
			filtro: 'completo' | 'solo_transferencias' | 'cuenta_especifica';
			cuentaNombre: string | null;
		},
		string,
	][] = [
		[{from: '2026-10-18', to: '2026-10-18', filtro: 'completo', cuentaNombre: null}, 'libro-diario-2026-10-18'],
		[
			{from: '2026-10-01', to: '2026-10-31', filtro: 'completo', cuentaNombre: null},
			'libro-diario-2026-10-01_a_2026-10-31',
		],
		[
			{from: '2026-10-18', to: '2026-10-18', filtro: 'solo_transferencias', cuentaNombre: null},
			'libro-diario-transferencias-2026-10-18',
		],
		[
			{from: '2026-10-18', to: '2026-10-18', filtro: 'cuenta_especifica', cuentaNombre: 'Diana'},
			'libro-diario-cuenta-diana-2026-10-18',
		],
		[
			{from: '2026-10-01', to: '2026-10-31', filtro: 'cuenta_especifica', cuentaNombre: 'Ñequi Ahorros #2 (QR)'},
			'libro-diario-cuenta-nequi-ahorros-2-qr-2026-10-01_a_2026-10-31',
		],
		[
			{from: '2026-10-18', to: '2026-10-18', filtro: 'cuenta_especifica', cuentaNombre: '***'},
			'libro-diario-cuenta-2026-10-18',
		],
		[
			{from: '2026-10-18', to: '2026-10-18', filtro: 'cuenta_especifica', cuentaNombre: null},
			'libro-diario-cuenta-2026-10-18',
		],
	];

	it.each(casos)('%o → %s', (libro, esperado) => {
		for (const extension of ['pdf', 'csv'] as const) {
			expect(nombreArchivoLibro(libro, extension)).toBe(`${esperado}.${extension}`);
			expect(nombreArchivoLibroDiario(libro, extension)).toBe(`${esperado}.${extension}`);
		}
	});
});
