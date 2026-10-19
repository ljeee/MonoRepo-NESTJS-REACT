import {ExecutionContext, ForbiddenException, Type} from '@nestjs/common';
import {MODULE_METADATA} from '@nestjs/common/constants';
import {APP_GUARD, Reflector} from '@nestjs/core';
import {AuthModule} from '../../../src/auth/auth.module';
import {Public} from '../../../src/auth/decorators/public.decorator';
import {ClienteGuard} from '../../../src/auth/guards/cliente.guard';
import {JwtAuthGuard} from '../../../src/auth/guards/jwt-auth.guard';
import {Role} from '../../../src/auth/roles.enum';
import {EstadisticasController} from '../../../src/estadisticas/estadisticas.controller';

type UsuarioMock = {roles?: Role[]};
type RequestMock = {method: string; originalUrl?: string; url?: string; user?: UsuarioMock};
type Handler = (...args: never[]) => unknown;
type Destino = {clase: Type; handler: Handler};

// Controllers de mentira: el guard solo lee la metadata @Public del handler y de la clase
class RutasPrivadas {
	accion() {}
}

class RutasConHandlerPublico {
	@Public()
	catalogo() {}
}

@Public()
class RutasPublicas {
	accion() {}
}

/** Clase + handler tal como los entrega Nest en `context.getClass()` / `context.getHandler()`. */
function destino<T>(clase: Type<T>, metodo: keyof T & string): Destino {
	return {clase, handler: (clase.prototype as Record<string, Handler>)[metodo]};
}

const CLIENTE: UsuarioMock = {roles: [Role.Cliente]};

// Rutas reales del POS (sin @Roles o con @Roles de staff) que un cliente no debe tocar
const RUTAS_PROHIBIDAS: Array<[string, string]> = [
	['GET', '/inventario/items'],
	['PATCH', '/productos/1'],
	['DELETE', '/facturas-ventas/1'],
	['GET', '/estadisticas/resumen'],
];

function crearRequest(method: string, originalUrl: string, user: UsuarioMock = CLIENTE): RequestMock {
	return {method, originalUrl, url: originalUrl, user};
}

function crearContexto(request: RequestMock, {clase, handler}: Destino): ExecutionContext {
	return {
		getClass: () => clase,
		getHandler: () => handler,
		switchToHttp: () => ({getRequest: () => request}),
	} as unknown as ExecutionContext;
}

describe('ClienteGuard', () => {
	let guard: ClienteGuard;

	beforeEach(() => {
		guard = new ClienteGuard(new Reflector());
	});

	const permite = (request: RequestMock, ruta: Destino = destino(RutasPrivadas, 'accion')) =>
		guard.canActivate(crearContexto(request, ruta));

	// ==================== rol cliente ====================

	describe('rol cliente', () => {
		it('puede crear su pedido: POST /ordenes', () => {
			expect(permite(crearRequest('POST', '/ordenes'))).toBe(true);
		});

		it.each(RUTAS_PROHIBIDAS)('no puede %s %s', (method, url) => {
			expect(() => permite(crearRequest(method, url))).toThrow(ForbiddenException);
		});

		it('responde 403 con un mensaje claro en español', () => {
			expect(() => permite(crearRequest('GET', '/inventario/items'))).toThrow(
				'El rol cliente solo puede crear pedidos a domicilio',
			);
		});

		it('compara método + path exacto, no por prefijo', () => {
			// Todas empiezan por '/ordenes': un startsWith (como en ContadorGuard) las dejaría pasar
			expect(() => permite(crearRequest('POST', '/ordenes-productos'))).toThrow(ForbiddenException);
			expect(() => permite(crearRequest('PATCH', '/ordenes/1/completar'))).toThrow(ForbiddenException);
			expect(() => permite(crearRequest('DELETE', '/ordenes/1'))).toThrow(ForbiddenException);
		});

		it('el método también cuenta: PUT /ordenes no está en la lista blanca', () => {
			expect(() => permite(crearRequest('PUT', '/ordenes'))).toThrow(ForbiddenException);
		});

		it('EstadisticasController ya no es @Public: el cliente queda bloqueado en el controller real', () => {
			const request = crearRequest('GET', '/estadisticas/resumen?from=2026-01-01&to=2026-01-31');

			expect(() => permite(request, destino(EstadisticasController, 'resumenGeneral'))).toThrow(
				ForbiddenException,
			);
		});
	});

	// ==================== querystring y path ====================

	describe('querystring y path', () => {
		it('ignora la querystring: POST /ordenes?origen=web', () => {
			expect(permite(crearRequest('POST', '/ordenes?origen=web'))).toBe(true);
		});

		it('no se deja engañar por una ruta escondida en la querystring', () => {
			expect(() => permite(crearRequest('PATCH', '/productos/1?volver=/ordenes'))).toThrow(ForbiddenException);
			expect(() => permite(crearRequest('POST', '/inventario/items?/ordenes'))).toThrow(ForbiddenException);
		});

		it('acepta el slash final que Express enruta igual: POST /ordenes/', () => {
			expect(permite(crearRequest('POST', '/ordenes/'))).toBe(true);
		});

		it('lee originalUrl (como ContadorGuard) y cae a url si no viene', () => {
			expect(permite({method: 'POST', url: '/ordenes', user: CLIENTE})).toBe(true);
			expect(() => permite({method: 'POST', originalUrl: '/productos', url: '/ordenes', user: CLIENTE})).toThrow(
				ForbiddenException,
			);
		});
	});

	// ==================== rutas @Public ====================

	describe('rutas @Public', () => {
		it('deja pasar al cliente en un handler @Public (catálogo)', () => {
			const request = crearRequest('GET', '/productos?activo=true');

			expect(permite(request, destino(RutasConHandlerPublico, 'catalogo'))).toBe(true);
		});

		it('deja pasar al cliente en un controller @Public a nivel de clase', () => {
			const request = crearRequest('POST', '/auth/refresh');

			expect(permite(request, destino(RutasPublicas, 'accion'))).toBe(true);
		});
	});

	// ==================== staff y otros usuarios ====================

	describe('staff y usuarios que no son solo cliente', () => {
		it.each([Role.Admin, Role.Cajero, Role.Mesero, Role.Cocina, Role.Domiciliario, Role.Contador])(
			'no afecta al rol %s (lo limitan RolesGuard/ContadorGuard)',
			(role) => {
				for (const [method, url] of RUTAS_PROHIBIDAS) {
					expect(permite(crearRequest(method, url, {roles: [role]}))).toBe(true);
				}
			},
		);

		it('no afecta a quien tenga algún rol de staff además de cliente', () => {
			expect(permite(crearRequest('GET', '/inventario/items', {roles: [Role.Cliente, Role.Cajero]}))).toBe(true);
		});

		it('no afecta a un usuario sin roles: no es cliente (RolesGuard decide)', () => {
			expect(permite(crearRequest('GET', '/inventario/items', {roles: []}))).toBe(true);
			expect(permite(crearRequest('GET', '/inventario/items', {}))).toBe(true);
		});

		it('sin usuario adjunto deja decidir a JwtAuthGuard', () => {
			expect(permite({method: 'GET', originalUrl: '/inventario/items'})).toBe(true);
		});
	});

	// ==================== registro global ====================

	describe('registro en AuthModule', () => {
		it('es APP_GUARD y corre después de JwtAuthGuard (sin req.user dejaría pasar todo)', () => {
			const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AuthModule) as Array<{
				provide?: unknown;
				useClass?: unknown;
			}>;
			const guardsGlobales = providers.filter((p) => p.provide === APP_GUARD).map((p) => p.useClass);

			expect(guardsGlobales).toContain(JwtAuthGuard);
			expect(guardsGlobales.indexOf(ClienteGuard)).toBeGreaterThan(guardsGlobales.indexOf(JwtAuthGuard));
		});
	});
});
