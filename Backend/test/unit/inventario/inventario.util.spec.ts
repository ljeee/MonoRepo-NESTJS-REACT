import {
	calcularMovimiento,
	categoriaBebidaPorNombre,
	categoriaCajaDeVariante,
	categoriaCajaPorNombre,
	estadoStock,
	nombreItemBebida,
} from '../../../src/inventario/inventario.util';

describe('inventario.util', () => {
	it('estadoStock: misma regla que la pantalla anterior', () => {
		expect(estadoStock(0, null)).toBe('critico');
		expect(estadoStock(5, null)).toBe('ok');
		expect(estadoStock(10, 10)).toBe('critico');
		expect(estadoStock(15, 10)).toBe('bajo');
		expect(estadoStock(16, 10)).toBe('ok');
	});

	it('categoriaCajaPorNombre tolera redacción libre', () => {
		expect(categoriaCajaPorNombre('Caja Pizza Pequeña')).toBe('pequena');
		expect(categoriaCajaPorNombre('caja personal')).toBe('pequena');
		expect(categoriaCajaPorNombre('Cajas Medianas')).toBe('mediana');
		expect(categoriaCajaPorNombre('CAJA GRANDE')).toBe('grande');
		expect(categoriaCajaPorNombre('Caja calzones')).toBe('calzone');
		expect(categoriaCajaPorNombre('Bolsa')).toBe('otra');
	});

	describe('categoriaCajaDeVariante', () => {
		it('pizzas por tamaño (sin tamaño reconocible → grande)', () => {
			expect(categoriaCajaDeVariante('pizza', 'Pizza', 'Pequeña')).toBe('pequena');
			expect(categoriaCajaDeVariante('pizza', 'Pizza', 'Personal')).toBe('pequena');
			expect(categoriaCajaDeVariante('pizza', 'Pizza', 'Mediana')).toBe('mediana');
			expect(categoriaCajaDeVariante('pizza', 'Pizza', 'Familiar')).toBe('grande');
		});

		it('calzone y encajados', () => {
			expect(categoriaCajaDeVariante('calzone', 'Calzone', 'UNIDAD')).toBe('calzone');
			expect(categoriaCajaDeVariante('comida', 'Papas Encajadas', 'Porción')).toBe('pequena');
		});

		it('regresión: bebidas y adiciones con palabras de tamaño NO gastan caja', () => {
			expect(categoriaCajaDeVariante('bebida', 'Gaseosa', 'Coca Cola Personal')).toBeNull();
			expect(categoriaCajaDeVariante('adicion', 'Adición de Queso', 'Grande')).toBeNull();
			expect(categoriaCajaDeVariante('pizza', 'Pizza', 'Adición Grande')).toBeNull();
			expect(categoriaCajaDeVariante('comida', 'Pizza Burguer', 'Sencilla')).toBeNull();
		});
	});

	it('categoriaBebidaPorNombre separa embotelladas de preparadas', () => {
		expect(categoriaBebidaPorNombre('Gaseosa Coca Cola 400ml')).toBe('gaseosa');
		expect(categoriaBebidaPorNombre('Postobón Manzana')).toBe('gaseosa');
		expect(categoriaBebidaPorNombre('Cerveza Águila')).toBe('cerveza');
		expect(categoriaBebidaPorNombre('Agua Brisa')).toBe('agua');
		expect(categoriaBebidaPorNombre('Jugo Natural Mora en agua')).toBe('jugo');
		expect(categoriaBebidaPorNombre('Limonada de coco')).toBe('jugo');
		expect(categoriaBebidaPorNombre('Pizza Hawaiana')).toBeNull();
	});

	it('nombreItemBebida no repite el producto', () => {
		expect(nombreItemBebida('Gaseosa', 'Coca Cola 400ml')).toBe('Gaseosa Coca Cola 400ml');
		expect(nombreItemBebida('Agua', 'Agua Brisa 600ml')).toBe('Agua Brisa 600ml');
	});

	describe('calcularMovimiento', () => {
		it('entrada / salida / ajuste con signo', () => {
			expect(calcularMovimiento(10, 'entrada', 5)).toEqual({delta: 5, aplicado: 5, resultante: 15});
			expect(calcularMovimiento(10, 'salida', 3)).toEqual({delta: -3, aplicado: -3, resultante: 7});
			expect(calcularMovimiento(10, 'ajuste', -4)).toEqual({delta: -4, aplicado: -4, resultante: 6});
		});

		it('conteo fija el valor absoluto', () => {
			expect(calcularMovimiento(10, 'conteo', 12)).toEqual({delta: 2, aplicado: 2, resultante: 12});
			expect(calcularMovimiento(10, 'conteo', 10)).toEqual({delta: 0, aplicado: 0, resultante: 10});
		});

		it('nunca deja stock negativo (el faltante queda en delta ≠ aplicado)', () => {
			expect(calcularMovimiento(2, 'salida', 5)).toEqual({delta: -5, aplicado: -2, resultante: 0});
		});
	});
});
