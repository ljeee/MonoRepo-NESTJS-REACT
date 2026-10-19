import {
	cobrado,
	esCobrada,
	esPendiente,
	montoEfectivo,
	montoTransferencia,
	normalizarMetodo,
	porCobrar,
	sqlCobrado,
	sqlFacturaValida,
	sqlFechaBogota,
} from '../../../src/common/domain/ventas';
import {getBogotaRange} from '../../../src/common/utils/date.utils';

describe('domain/ventas', () => {
	describe('cobrado / porCobrar', () => {
		it('factura pagada: cobra el total aunque monto_pagado venga NULL (importadas por CSV)', () => {
			expect(cobrado({estado: 'pagado', total: 50000, montoPagado: null})).toBe(50000);
			expect(cobrado({estado: 'pagada', total: '30000'})).toBe(30000);
		});

		it('topa monto_pagado desfasado al total', () => {
			expect(cobrado({estado: 'pagado', total: 40000, montoPagado: 55000})).toBe(40000);
			expect(cobrado({estado: 'parcial', total: 40000, montoPagado: 90000})).toBe(40000);
		});

		it('parcial cobra lo abonado; pendiente y anulada no cobran', () => {
			expect(cobrado({estado: 'parcial', total: 50000, montoPagado: 20000})).toBe(20000);
			expect(cobrado({estado: 'pendiente', total: 50000, montoPagado: 50000})).toBe(0);
			expect(cobrado({estado: 'cancelado', total: 50000, montoPagado: 50000})).toBe(0);
		});

		it('porCobrar = total − cobrado, 0 para anuladas', () => {
			expect(porCobrar({estado: 'parcial', total: 50000, montoPagado: 20000})).toBe(30000);
			expect(porCobrar({estado: 'pendiente', total: 50000})).toBe(50000);
			expect(porCobrar({estado: 'cancelado', total: 50000})).toBe(0);
			expect(porCobrar({estado: 'pagado', total: 50000})).toBe(0);
		});
	});

	describe('estados', () => {
		it('acepta el alias legado "pagada"', () => {
			expect(esCobrada({estado: 'pagada'})).toBe(true);
		});

		it('pendiente puede incluir o excluir las parciales', () => {
			expect(esPendiente({estado: 'parcial'})).toBe(false);
			expect(esPendiente({estado: 'parcial'}, {incluirParcial: true})).toBe(true);
			
			expect(esPendiente({estado: null})).toBe(true);
			expect(esPendiente({estado: 'pagado'})).toBe(false);
		});
	});

	describe('método de pago', () => {
		it('normaliza qr como transferencia y efectivo_transferencia como mixto', () => {
			expect(normalizarMetodo('qr')).toBe('transferencia');
			expect(normalizarMetodo('efectivo_transferencia')).toBe('mixto');
			expect(normalizarMetodo(null)).toBe('sin_metodo');
			expect(normalizarMetodo('tarjeta')).toBe('otro');
		});

		it('desglosa mixtas y abonos por sus campos', () => {
			const mixta = {
				estado: 'pagado',
				total: 50000,
				metodo: 'efectivo_transferencia',
				pagoEfectivo: 20000,
				pagoTransferencia: 30000,
			};
			expect(montoEfectivo(mixta)).toBe(20000);
			expect(montoTransferencia(mixta)).toBe(30000);

			const abonada = {
				estado: 'parcial',
				total: 50000,
				montoPagado: 15000,
				metodo: null,
				pagoEfectivo: 10000,
				pagoTransferencia: 5000,
			};
			expect(montoEfectivo(abonada)).toBe(10000);
			expect(montoTransferencia(abonada)).toBe(5000);
		});

		it('una factura de un solo método asigna todo lo cobrado a ese método', () => {
			expect(montoEfectivo({estado: 'pagado', total: 30000, metodo: 'efectivo'})).toBe(30000);
			expect(montoTransferencia({estado: 'pagado', total: 30000, metodo: 'qr'})).toBe(30000);
			expect(montoEfectivo({estado: 'pendiente', total: 30000, metodo: 'efectivo'})).toBe(0);
		});
	});

	describe('fragmentos SQL', () => {
		it('usa IS DISTINCT FROM para no perder estados NULL', () => {
			expect(sqlFacturaValida('fv')).toContain(`fv.estado IS DISTINCT FROM 'cancelado'`);
			expect(sqlFacturaValida('fv')).toContain('estado_orden IS DISTINCT FROM');
		});

		it('cobrado topa al total y trata NULL', () => {
			const sql = sqlCobrado('f');
			expect(sql).toContain('LEAST(COALESCE(f.monto_pagado, f.total, 0)');
			expect(sql).toContain(`f.estado = 'parcial'`);
		});

		it('fecha en hora de Bogotá sobre la columna camelCase', () => {
			expect(sqlFechaBogota('f')).toBe(`(f."fechaFactura" AT TIME ZONE 'America/Bogota')`);
		});
	});

	describe('getBogotaRange', () => {
		it('cubre el día completo en hora de Bogotá', () => {
			const {start, end} = getBogotaRange('2026-05-01', '2026-05-31');
			expect(start.toISOString()).toBe('2026-05-01T05:00:00.000Z');
			expect(end.toISOString()).toBe('2026-06-01T04:59:59.999Z');
		});

		it('respeta ISO completos', () => {
			const {start} = getBogotaRange('2026-05-01T10:00:00-05:00', '2026-05-01');
			expect(start.toISOString()).toBe('2026-05-01T15:00:00.000Z');
		});
	});
});

describe('domain/ventas — reparto por método alineado con el frontend', () => {
	it('pendientes con desglose viejo (tras revertir) no reparten nada', () => {
		const f = {estado: 'pendiente', total: 30000, metodo: 'efectivo_transferencia', pagoEfectivo: 10000, pagoTransferencia: 20000};
		expect(montoEfectivo(f)).toBe(0);
		expect(montoTransferencia(f)).toBe(0);
	});

	it('parcial sin desglose reparte lo abonado a su método', () => {
		const f = {estado: 'parcial', total: 30000, montoPagado: 10000, metodo: 'efectivo'};
		expect(montoEfectivo(f)).toBe(10000);
		expect(montoTransferencia(f)).toBe(0);
	});
});
