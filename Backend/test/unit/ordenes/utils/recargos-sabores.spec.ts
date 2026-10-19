import {calcularRecargoSabores, claveTamano, tamanoDeVariante, ReglasGrupo} from '../../../../src/ordenes/utils/recargos-sabores';

const PIZZA: ReglasGrupo = {
	usaTamano: true,
	recargoExtraDesde: 3,
	recargoExtraPequena: 3000,
	recargoExtraMediana: 3500,
	recargoExtraGrande: 4000,
};
const CALZONE: ReglasGrupo = {
	usaTamano: false,
	recargoExtraDesde: null,
	recargoExtraPequena: 0,
	recargoExtraMediana: 0,
	recargoExtraGrande: 0,
};
const paisa = {recargoPequena: '1000', recargoMediana: '2000', recargoGrande: '2500'};
const carnes = {recargoPequena: 0, recargoMediana: 0, recargoGrande: 0};

describe('recargos-sabores', () => {
	describe('tamanoDeVariante', () => {
		it('usa el tamaño explícito aunque el nombre diga otra cosa', () => {
			expect(tamanoDeVariante({nombre: 'Grande', tamano: 'pequena'})).toBe('pequena');
		});
		it('sin tamaño explícito lo deduce del nombre', () => {
			expect(tamanoDeVariante({nombre: 'Mediana'})).toBe('mediana');
			expect(tamanoDeVariante({nombre: 'Personal', tamano: null})).toBe('pequena');
		});
		it('devuelve null si no se reconoce', () => {
			expect(tamanoDeVariante({nombre: 'UNIDAD'})).toBeNull();
		});
	});

	describe('claveTamano', () => {
		it('un grupo sin tamaños siempre usa la columna grande', () => {
			expect(claveTamano(CALZONE, 'pequena')).toBe('Grande');
		});
		it('con tamaños usa el de la variante y, si no se reconoce, la grande', () => {
			expect(claveTamano(PIZZA, 'pequena')).toBe('Pequena');
			expect(claveTamano(PIZZA, 'mediana')).toBe('Mediana');
			expect(claveTamano(PIZZA, null)).toBe('Grande');
		});
	});

	describe('calcularRecargoSabores', () => {
		it('cobra el recargo del sabor según el tamaño', () => {
			expect(calcularRecargoSabores(PIZZA, [paisa], 1, 'pequena').total).toBe(1000);
			expect(calcularRecargoSabores(PIZZA, [paisa], 1, 'mediana').total).toBe(2000);
			expect(calcularRecargoSabores(PIZZA, [paisa], 1, 'grande').total).toBe(2500);
		});

		it('cero en el sabor = no cobra', () => {
			expect(calcularRecargoSabores(PIZZA, [carnes], 1, 'grande')).toEqual({porSabor: 0, porCantidad: 0, total: 0});
		});

		it('entre varios sabores cobra el mayor, no la suma', () => {
			const otro = {recargoPequena: 0, recargoMediana: 0, recargoGrande: 1500};
			expect(calcularRecargoSabores(PIZZA, [paisa, otro], 2, 'grande').porSabor).toBe(2500);
		});

		it('el extra por cantidad aplica desde el umbral y por tamaño', () => {
			expect(calcularRecargoSabores(PIZZA, [carnes], 2, 'grande').porCantidad).toBe(0);
			expect(calcularRecargoSabores(PIZZA, [carnes], 3, 'pequena').porCantidad).toBe(3000);
			expect(calcularRecargoSabores(PIZZA, [carnes], 3, 'mediana').porCantidad).toBe(3500);
			expect(calcularRecargoSabores(PIZZA, [carnes], 3, 'grande').porCantidad).toBe(4000);
		});

		it('cuenta los nombres pedidos aunque alguno no exista en el catálogo', () => {
			expect(calcularRecargoSabores(PIZZA, [paisa], 3, 'grande')).toEqual({porSabor: 2500, porCantidad: 4000, total: 6500});
		});

		it('un grupo sin umbral no cobra extra', () => {
			expect(calcularRecargoSabores(CALZONE, [carnes], 5, 'grande').porCantidad).toBe(0);
		});

		it('un grupo sin tamaños cobra la columna grande del sabor', () => {
			expect(calcularRecargoSabores(CALZONE, [paisa], 1, 'pequena').total).toBe(2500);
		});

		it('valores no numéricos cuentan como 0', () => {
			const raro = {recargoPequena: 'x', recargoMediana: null as unknown as number, recargoGrande: ''};
			expect(calcularRecargoSabores(PIZZA, [raro], 1, 'grande').total).toBe(0);
		});
	});
});
