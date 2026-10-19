import {calcularRecargoSabores as backend, tamanoDeVariante, ReglasGrupo} from '../../../src/ordenes/utils/recargos-sabores';
import {calcularRecargoSabores as frontend} from '../../../../Frontend/src/shared/utils/sabores';
// require (no import): el tsc del backend no resuelve el './types' sin extensión de ClientWeb (moduleResolution distinto).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {recargoTotal: clientWeb} = require('../../../../ClientWeb/src/lib/sabores') as {recargoTotal: (...args: any[]) => number};

/**
 * El precio de una línea con sabores se calcula en TRES sitios: el backend (la verdad: recalcula al crear la
 * orden), el POS (`Frontend/src/shared/utils/sabores.ts`, necesario sin conexión) y ClientWeb (solo para mostrarle
 * al cliente lo que va a pagar). No se pueden compartir como paquete (ClientWeb no es workspace, RiderApp compila
 * con otro TS), así que esta prueba ejecuta los tres con los mismos casos: si uno cambia una regla y los demás
 * no, falla aquí y no en un cobro.
 */

const GRUPO_TAMANOS: ReglasGrupo & {id: number} = {
	id: 1,
	usaTamano: true,
	recargoExtraDesde: 3,
	recargoExtraPequena: 1000,
	recargoExtraMediana: 2000,
	recargoExtraGrande: 3000,
};
const GRUPO_UNICO: ReglasGrupo & {id: number} = {
	id: 2,
	usaTamano: false,
	recargoExtraDesde: null,
	recargoExtraPequena: 0,
	recargoExtraMediana: 0,
	recargoExtraGrande: 500,
};

const SABORES = [
	{id: 1, grupoId: 1, nombre: 'Paisa', recargoPequena: 0, recargoMediana: 0, recargoGrande: 0},
	{id: 2, grupoId: 1, nombre: 'Carnes', recargoPequena: 1000, recargoMediana: 2000, recargoGrande: 3000},
	{id: 3, grupoId: 1, nombre: 'Camaron', recargoPequena: 4000, recargoMediana: 5000, recargoGrande: 6000},
	{id: 4, grupoId: 2, nombre: 'Mora', recargoPequena: 0, recargoMediana: 0, recargoGrande: 700},
	{id: 5, grupoId: 1, nombre: 'Decimal', recargoPequena: '1500.50', recargoMediana: '0', recargoGrande: '2500.00'},
];

const VARIANTES = [
	{nombre: 'Pequeña'},
	{nombre: 'Personal'},
	{nombre: 'Mediana'},
	{nombre: 'Grande'},
	{nombre: 'GRANDE FAMILIAR'},
	{nombre: 'Unidad'}, // sin tamaño reconocible → grande
	{nombre: 'X', tamano: 'mediana'}, // el tamaño explícito manda sobre el nombre
	{nombre: 'Grande', tamano: 'pequena'},
];

const PEDIDOS: string[][] = [[], ['Paisa'], ['Carnes'], ['Paisa', 'Carnes'], ['Paisa', 'Carnes', 'Camaron'], ['Camaron', 'Camaron', 'Camaron'], ['Decimal'], ['Inexistente'], ['Paisa', 'Inexistente', 'Carnes']];

function backendDe(grupo: ReglasGrupo & {id: number}, variante: (typeof VARIANTES)[number], pedido: string[]) {
	// El backend recibe las filas del grupo que coinciden con los nombres; `cantidadPedida` cuenta los nombres como llegaron.
	const filas = SABORES.filter((s) => s.grupoId === grupo.id && pedido.includes(s.nombre));
	return backend(grupo, filas, pedido.length, tamanoDeVariante(variante)).total;
}

describe('Recargos de sabores: backend = POS = ClientWeb', () => {
	for (const grupo of [GRUPO_TAMANOS, GRUPO_UNICO]) {
		for (const variante of VARIANTES) {
			for (const pedido of PEDIDOS) {
				it(`grupo ${grupo.id} · ${variante.nombre}${'tamano' in variante ? `/${variante.tamano}` : ''} · [${pedido.join(', ')}]`, () => {
					const esperado = backendDe(grupo, variante, pedido);

					expect(frontend(grupo as any, SABORES as any, pedido, variante).total).toBe(esperado);
					expect(clientWeb(grupo as any, SABORES as any, pedido, variante as any)).toBe(esperado);
				});
			}
		}
	}

	it('casos de referencia (los valores a mano, para que un cambio de regla no pase por "los tres cambiaron igual")', () => {
		expect(backendDe(GRUPO_TAMANOS, {nombre: 'Grande'}, ['Paisa', 'Carnes', 'Camaron'])).toBe(6000 + 3000); // mayor sabor + extra por 3
		expect(backendDe(GRUPO_TAMANOS, {nombre: 'Pequeña'}, ['Paisa', 'Carnes'])).toBe(1000); // sin extra: solo 2 sabores
		expect(backendDe(GRUPO_TAMANOS, {nombre: 'Unidad'}, ['Carnes'])).toBe(3000); // sin tamaño → grande
		expect(backendDe(GRUPO_UNICO, {nombre: 'Pequeña'}, ['Mora'])).toBe(700); // grupo sin tamaños: siempre columna grande
		expect(backendDe(GRUPO_TAMANOS, {nombre: 'Grande'}, ['Paisa', 'Inexistente', 'Carnes'])).toBe(3000 + 3000); // el nombre inexistente cuenta para el extra
	});
});
