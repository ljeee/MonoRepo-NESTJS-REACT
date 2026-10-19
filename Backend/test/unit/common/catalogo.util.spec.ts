import {
	derivarCategoriaProducto,
	esCategoriaProducto,
	normalizarTamano,
	normalizarTexto,
} from '../../../src/common/utils/catalogo.util';

describe('catalogo.util', () => {
	describe('normalizarTexto', () => {
		it('quita tildes, baja a minúsculas y colapsa espacios', () => {
			expect(normalizarTexto('  Jamón   y QUESO ')).toBe('jamon y queso');
			expect(normalizarTexto('Pequeña')).toBe('pequena');
		});

		it('tolera null/undefined', () => {
			expect(normalizarTexto(null)).toBe('');
			expect(normalizarTexto(undefined)).toBe('');
		});
	});

	describe('normalizarTamano', () => {
		it.each([
			['Grande', 'grande'],
			['Mediana', 'mediana'],
			['Pequeña', 'pequena'],
			['pequena', 'pequena'],
			['Personal', 'pequena'],
			['PIZZA GRANDE', 'grande'],
			['mediano', 'mediana'],
		])('%s → %s', (entrada, esperado) => {
			expect(normalizarTamano(entrada)).toBe(esperado);
		});

		it('devuelve null si no hay palabra de tamaño', () => {
			expect(normalizarTamano('De Casa')).toBeNull();
			expect(normalizarTamano('UNIDAD')).toBeNull();
			expect(normalizarTamano(null)).toBeNull();
		});
	});

	describe('derivarCategoriaProducto', () => {
		it('respeta la personalización configurada', () => {
			expect(derivarCategoriaProducto('Lo que sea', 'pizza')).toBe('pizza');
			expect(derivarCategoriaProducto('Lo que sea', 'calzone')).toBe('calzone');
			expect(derivarCategoriaProducto('Lo que sea', 'jugo')).toBe('jugo');
		});

		it.each([
			['Pizza', 'pizza'],
			['CALZONE DE DOS SABORES', 'calzone'],
			['Adición de Queso', 'adicion'],
			['ADICIÓNES', 'adicion'],
			['GASEOSA', 'bebida'],
			['BEBIDAS', 'bebida'],
			['Agua Cristal', 'bebida'],
			['Cerveza Club Colombia', 'bebida'],
			['Jugos Naturales', 'jugo'],
			['LIMONADAS', 'jugo'],
			['Pizza Burguer', 'comida'],
			['Papas Encajadas', 'comida'],
			['Salchipapa', 'comida'],
			['Combo Familiar', 'otro'],
		])('%s → %s', (nombre, esperado) => {
			expect(derivarCategoriaProducto(nombre, null)).toBe(esperado);
		});

		it("personalización 'ninguna' cae a la deducción por nombre", () => {
			expect(derivarCategoriaProducto('GASEOSA', 'ninguna')).toBe('bebida');
		});
	});

	describe('esCategoriaProducto', () => {
		it('valida contra la lista cerrada', () => {
			expect(esCategoriaProducto('pizza')).toBe(true);
			expect(esCategoriaProducto('postres')).toBe(false);
			expect(esCategoriaProducto(null)).toBe(false);
		});
	});
});
