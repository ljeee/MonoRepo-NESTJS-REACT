import {
	CATEGORIAS_GASTO,
	CATEGORIA_GENERAL,
	IDS_CATEGORIA_GASTO,
	TIPOS_GASTO,
	tipoPorCategoria,
} from '../../../src/common/utils/gastos.util';
import {acumularDesglose, metodoSegunPagos} from '../../../src/common/domain/ventas';

describe('clasificación de egresos', () => {
	it('nómina y servicios son gastos; insumos, mercancía y empaques son costos', () => {
		expect(tipoPorCategoria('nomina')).toBe('gasto');
		expect(tipoPorCategoria('servicios')).toBe('gasto');
		expect(tipoPorCategoria('arriendo')).toBe('gasto');
		expect(tipoPorCategoria('insumos')).toBe('costo');
		expect(tipoPorCategoria('mercancia')).toBe('costo');
		expect(tipoPorCategoria('empaques')).toBe('costo');
	});

	it("'general' (histórico), vacía o desconocida quedan sin tipo", () => {
		expect(tipoPorCategoria(CATEGORIA_GENERAL)).toBeNull();
		expect(tipoPorCategoria(undefined)).toBeNull();
		expect(tipoPorCategoria('cosas')).toBeNull();
	});

	it('el catálogo no repite ids y todos los tipos son válidos', () => {
		const ids = CATEGORIAS_GASTO.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(CATEGORIAS_GASTO.every((c) => (TIPOS_GASTO as readonly string[]).includes(c.tipo))).toBe(true);
		expect(IDS_CATEGORIA_GASTO).toContain('general');
	});
});

describe('desglose de transferencias por cuenta', () => {
	it('suma a la misma cuenta y agrega las nuevas, sin mutar el original', () => {
		const original = [{cuentaId: 1, cuenta: 'Nequi', monto: 10000}];

		const a = acumularDesglose(original, 1, 'Nequi', 5000);
		const b = acumularDesglose(a, 2, 'Bancolombia', 7000);

		expect(a).toEqual([{cuentaId: 1, cuenta: 'Nequi', monto: 15000}]);
		expect(b).toEqual([
			{cuentaId: 1, cuenta: 'Nequi', monto: 15000},
			{cuentaId: 2, cuenta: 'Bancolombia', monto: 7000},
		]);
		expect(original[0].monto).toBe(10000);
	});

	it('los abonos sin cuenta se acumulan en una sola entrada "sin asignar"', () => {
		const lista = acumularDesglose(acumularDesglose(null, null, null, 3000), undefined, '  ', 2000);

		expect(lista).toEqual([{cuentaId: null, cuenta: null, monto: 5000}]);
	});

	it('sin id, distingue las cuentas por nombre', () => {
		const lista = acumularDesglose([{cuentaId: null, cuenta: 'Vieja', monto: 100}], null, 'Otra', 50);

		expect(lista).toHaveLength(2);
	});
});

describe('metodoSegunPagos', () => {
	it('deriva el método final por lo que entró en cada vía', () => {
		expect(metodoSegunPagos(1000, 0)).toBe('efectivo');
		expect(metodoSegunPagos(0, 1000)).toBe('transferencia');
		expect(metodoSegunPagos(500, 500)).toBe('efectivo_transferencia');
		expect(metodoSegunPagos(0, 0)).toBe('efectivo');
	});
});
