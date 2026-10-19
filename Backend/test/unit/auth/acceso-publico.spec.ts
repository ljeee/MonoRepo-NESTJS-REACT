import {IS_PUBLIC_KEY} from '../../../src/auth/decorators/public.decorator';
import {ClientesController} from '../../../src/clientes/clientes.controller';
import {OrdenesController} from '../../../src/ordenes/ordenes.controller';
import {EstadisticasController} from '../../../src/estadisticas/estadisticas.controller';
import {EmpresaController} from '../../../src/empresa/empresa.controller';

/**
 * Regresión de seguridad: estas rutas exponen datos personales o permiten tomar
 * cuentas. No deben volver a marcarse @Public (ni a nivel de clase ni de handler).
 */
describe('Rutas que NO deben ser públicas', () => {
	const esPublico = (target: object) => Reflect.getMetadata(IS_PUBLIC_KEY, target) === true;

	it.each([
		['ClientesController', ClientesController],
		['OrdenesController', OrdenesController],
		['EstadisticasController', EstadisticasController],
	])('%s no es público a nivel de clase', (_nombre, controller) => {
		expect(esPublico(controller)).toBe(false);
	});

	it('reset-password de clientes no es público', () => {
		expect(esPublico(ClientesController.prototype.resetPassword)).toBe(false);
	});

	it.each(['findAll', 'findByDay', 'findPendingByDay', 'findOne'] as const)(
		'GET de órdenes (%s) no es público',
		(handler) => {
			expect(esPublico(OrdenesController.prototype[handler])).toBe(false);
		},
	);

	it('las cuentas de transferencia (nombres de las cuentas donde entra el dinero) no son públicas', () => {
		expect(esPublico(EmpresaController.prototype.getCuentasTransferencia)).toBe(false);
	});

	it('el perfil del negocio sigue público (lo consume ClientWeb en /nosotros)', () => {
		expect(esPublico(EmpresaController.prototype.getConfig)).toBe(true);
	});
});
