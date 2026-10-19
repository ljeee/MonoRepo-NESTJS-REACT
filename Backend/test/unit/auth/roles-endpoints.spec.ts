import 'reflect-metadata';
import {RequestMethod} from '@nestjs/common';
import {ForbiddenException} from '@nestjs/common';
import {METHOD_METADATA, PATH_METADATA} from '@nestjs/common/constants';
import {ROLES_KEY} from '../../../src/auth/decorators/roles.decorator';
import {IS_PUBLIC_KEY} from '../../../src/auth/decorators/public.decorator';
import {Role} from '../../../src/auth/roles.enum';
import {AuthController} from '../../../src/auth/auth.controller';
import {CajaMovimientosController} from '../../../src/caja-movimientos/caja-movimientos.controller';
import {CierresController} from '../../../src/cierres/cierres.controller';
import {ClientesController} from '../../../src/clientes/clientes.controller';
import {ImportadorController} from '../../../src/contabilidad/importador.controller';
import {DomiciliariosController} from '../../../src/domiciliarios/domiciliarios.controller';
import {DomiciliosController} from '../../../src/domicilios/domicilios.controller';
import {EmpresaController} from '../../../src/empresa/empresa.controller';
import {EstadisticasController} from '../../../src/estadisticas/estadisticas.controller';
import {FacturasPagosController} from '../../../src/facturas-pagos/facturas-pagos.controller';
import {FacturasVentasController} from '../../../src/facturas-ventas/facturas-ventas.controller';
import {InventarioController} from '../../../src/inventario/inventario.controller';
import {OrdenesProductosController} from '../../../src/ordenes-productos/ordenes-productos.controller';
import {OrdenesController} from '../../../src/ordenes/ordenes.controller';
import {PizzaSaboresController} from '../../../src/pizza-sabores/pizza-sabores.controller';
import {SaborGruposController} from '../../../src/pizza-sabores/sabor-grupos.controller';
import {ProductosController} from '../../../src/productos/productos.controller';

/**
 * Mapa de permisos por endpoint. RolesGuard solo exige rol cuando el endpoint declara @Roles: un endpoint de
 * escritura sin él lo puede usar CUALQUIER usuario con sesión (cocina, domiciliario…). Esta prueba falla si
 * alguien agrega una ruta que modifica datos sin decidir quién puede usarla.
 */
const CONTROLADORES: Record<string, new (...args: any[]) => unknown> = {
	AuthController,
	CajaMovimientosController,
	CierresController,
	ClientesController,
	ImportadorController,
	DomiciliariosController,
	DomiciliosController,
	EmpresaController,
	EstadisticasController,
	FacturasPagosController,
	FacturasVentasController,
	InventarioController,
	OrdenesProductosController,
	OrdenesController,
	PizzaSaboresController,
	SaborGruposController,
	ProductosController,
};

interface Ruta {
	controlador: string;
	metodo: string;
	verbo: RequestMethod;
	ruta: string;
	roles?: Role[];
	publica: boolean;
}

function rutas(): Ruta[] {
	const todas: Ruta[] = [];
	for (const [nombre, clase] of Object.entries(CONTROLADORES)) {
		const base = String(Reflect.getMetadata(PATH_METADATA, clase) ?? '');
		for (const metodo of Object.getOwnPropertyNames(clase.prototype)) {
			const handler = (clase.prototype as Record<string, unknown>)[metodo];
			if (metodo === 'constructor' || typeof handler !== 'function') continue;
			const verbo = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
			if (verbo === undefined) continue;
			todas.push({
				controlador: nombre,
				metodo,
				verbo,
				ruta: `${base}/${Reflect.getMetadata(PATH_METADATA, handler) ?? ''}`.replace(/\/+/g, '/'),
				roles: (Reflect.getMetadata(ROLES_KEY, handler) ?? Reflect.getMetadata(ROLES_KEY, clase)) as Role[] | undefined,
				publica: !!(Reflect.getMetadata(IS_PUBLIC_KEY, handler) ?? Reflect.getMetadata(IS_PUBLIC_KEY, clase)),
			});
		}
	}
	return todas;
}

/** Escrituras que a propósito no piden rol: las usa cualquier usuario de la app (incluido el cliente web) o tienen su propia regla. */
const ESCRITURAS_SIN_ROL = new Set<string>(['OrdenesController.create']);

describe('Permisos por rol de los endpoints', () => {
	const todas = rutas();
	const buscar = (controlador: string, metodo: string) => {
		const r = todas.find((x) => x.controlador === controlador && x.metodo === metodo);
		if (!r) throw new Error(`No existe ${controlador}.${metodo}`);
		return r;
	};

	it('se descubren las rutas de todos los controladores', () => {
		expect(todas.length).toBeGreaterThan(80);
	});

	it('toda ruta que modifica datos exige un rol (o es pública a propósito)', () => {
		const sinRol = todas
			.filter((r) => r.verbo !== RequestMethod.GET && !r.publica && !(r.roles && r.roles.length))
			.map((r) => `${r.controlador}.${r.metodo}`)
			.filter((clave) => !ESCRITURAS_SIN_ROL.has(clave));
		expect(sinRol).toEqual([]);
	});

	it('el dinero (facturas, gastos, caja) solo lo ven y mueven roles de caja/contabilidad', () => {
		for (const [c, m] of [['FacturasPagosController', 'findAll'], ['FacturasPagosController', 'findByDay'], ['CajaMovimientosController', 'getEstado'], ['CajaMovimientosController', 'getMovimientos']] as const) {
			const r = buscar(c, m);
			expect(r.roles).toEqual(expect.arrayContaining([Role.Admin, Role.Cajero]));
			expect(r.roles).not.toContain(Role.Cocina);
			expect(r.roles).not.toContain(Role.Domiciliario);
		}
		for (const m of ['create', 'update', 'remove']) {
			expect(buscar('FacturasPagosController', m).roles).toEqual([Role.Admin, Role.Cajero]);
		}
		for (const m of ['create', 'update', 'remove']) {
			expect(buscar('FacturasVentasController', m).roles).toEqual([Role.Admin, Role.Cajero]);
		}
	});

	it('cocina y domiciliario no pueden leer ni tocar facturas', () => {
		for (const r of todas.filter((x) => x.controlador === 'FacturasVentasController')) {
			expect(r.roles).not.toContain(Role.Cocina);
			expect(r.roles).not.toContain(Role.Domiciliario);
		}
	});

	it('el catálogo (productos, sabores) y los domiciliarios solo los edita admin/cajero', () => {
		for (const c of ['ProductosController', 'PizzaSaboresController', 'DomiciliariosController']) {
			for (const r of todas.filter((x) => x.controlador === c && x.verbo !== RequestMethod.GET && !x.metodo.startsWith('actualizarUbicacion'))) {
				expect(r.roles).toEqual([Role.Admin, Role.Cajero]);
			}
		}
	});

	it('el domiciliario solo puede usar su propia ubicación y actualizar el estado de un domicilio', () => {
		expect(buscar('DomiciliariosController', 'actualizarUbicacion').roles).toEqual([Role.Domiciliario]);
		expect(buscar('DomiciliosController', 'update').roles).toEqual(expect.arrayContaining([Role.Domiciliario]));
		expect(buscar('DomiciliosController', 'remove').roles).not.toContain(Role.Domiciliario);
		expect(buscar('DomiciliosController', 'create').roles).not.toContain(Role.Domiciliario);
	});

	it('los GET públicos son solo los que necesita el cliente web y el login', () => {
		const publicas = todas.filter((r) => r.publica).map((r) => `${r.controlador}.${r.metodo}`);
		expect(publicas).not.toEqual(expect.arrayContaining(['FacturasVentasController.findAll', 'FacturasPagosController.findAll', 'ClientesController.findOne']));
	});
});

describe('DomiciliosController.update: el domiciliario solo marca SUS entregas', () => {
	const servicio = {findOne: jest.fn(), update: jest.fn().mockResolvedValue({ok: true})};
	const controlador = new DomiciliosController(servicio as any);
	const repartidor = {username: '3001112233', roles: [Role.Domiciliario]} as any;

	beforeEach(() => jest.clearAllMocks());

	it('admin y cajero actualizan cualquier campo (asignar, costo, dirección)', async () => {
		await controlador.update(1, {telefonoDomiciliarioAsignado: '3000000000', costoDomicilio: 7000} as any, {username: 'x', roles: [Role.Cajero]} as any);

		expect(servicio.update).toHaveBeenCalledWith(1, {telefonoDomiciliarioAsignado: '3000000000', costoDomicilio: 7000});
		expect(servicio.findOne).not.toHaveBeenCalled();
	});

	it('un domiciliario marca como entregado su propio domicilio, y solo se guarda el estado', async () => {
		servicio.findOne.mockResolvedValue({domicilioId: 1, telefonoDomiciliarioAsignado: '3001112233'});

		await controlador.update(1, {estadoDomicilio: 'entregado', costoDomicilio: 0, telefonoDomiciliarioAsignado: '3009998888'} as any, repartidor);

		expect(servicio.update).toHaveBeenCalledWith(1, {estadoDomicilio: 'entregado'});
	});

	it('no puede tocar el domicilio de otro repartidor', async () => {
		servicio.findOne.mockResolvedValue({domicilioId: 1, telefonoDomiciliarioAsignado: '3105550000'});

		await expect(controlador.update(1, {estadoDomicilio: 'entregado'} as any, repartidor)).rejects.toThrow(ForbiddenException);
		expect(servicio.update).not.toHaveBeenCalled();
	});

	it('no puede cambiar nada que no sea el estado (reasignarse, cambiar el costo)', async () => {
		servicio.findOne.mockResolvedValue({domicilioId: 1, telefonoDomiciliarioAsignado: '3001112233'});

		await expect(controlador.update(1, {costoDomicilio: 0} as any, repartidor)).rejects.toThrow(ForbiddenException);
		expect(servicio.update).not.toHaveBeenCalled();
	});
});
