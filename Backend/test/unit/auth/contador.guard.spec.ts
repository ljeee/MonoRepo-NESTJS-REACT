import {ExecutionContext, ForbiddenException} from '@nestjs/common';
import {ContadorGuard} from '../../../src/auth/guards/contador.guard';
import {Role} from '../../../src/auth/roles.enum';

const contexto = (method: string, url: string, roles?: Role[]) =>
	({
		switchToHttp: () => ({getRequest: () => ({method, originalUrl: url, url, user: roles ? {roles} : undefined})}),
	}) as unknown as ExecutionContext;

describe('ContadorGuard', () => {
	const guard = new ContadorGuard();
	const CONTADOR = [Role.Contador];

	it.each([
		'/contabilidad/algo',
		'/estadisticas/resumen?from=2026-06-01&to=2026-06-30',
		'/facturas-ventas?from=2026-06-01&to=2026-06-30&limit=0',
		'/facturas-pagos?from=2026-06-01&to=2026-06-30',
		// Contabilidad carga las cuentas de transferencia para agrupar/filtrar por cuenta
		'/empresa/cuentas-transferencia',
	])('el contador puede consultar (GET) %s', (url) => {
		expect(guard.canActivate(contexto('GET', url, CONTADOR))).toBe(true);
	});

	it.each([
		['POST', '/empresa/cuentas-transferencia'],
		['PATCH', '/empresa/cuentas-transferencia/1'],
		['DELETE', '/empresa/cuentas-transferencia/1'],
		['PATCH', '/facturas-ventas/1'],
		['POST', '/facturas-pagos'],
		['DELETE', '/facturas-pagos/1'],
	])('el contador NO puede %s %s (solo lectura)', (method, url) => {
		expect(() => guard.canActivate(contexto(method, url, CONTADOR))).toThrow(ForbiddenException);
	});

	it.each(['/empresa', '/ordenes', '/caja-movimientos/estado', '/cierres', '/inventario/items'])(
		'el contador NO accede a %s',
		(url) => {
			expect(() => guard.canActivate(contexto('GET', url, CONTADOR))).toThrow(ForbiddenException);
		},
	);

	it('el staff con otros roles no se ve afectado', () => {
		expect(guard.canActivate(contexto('POST', '/facturas-pagos', [Role.Cajero]))).toBe(true);
		expect(guard.canActivate(contexto('PATCH', '/empresa/cuentas-transferencia/1', [Role.Admin, Role.Contador]))).toBe(
			true,
		);
	});

	it('rutas públicas (sin usuario) pasan', () => {
		expect(guard.canActivate(contexto('GET', '/empresa'))).toBe(true);
	});
});
