import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {BadRequestException} from '@nestjs/common';
import {DetalleLinea, ProductProcessingService} from '../../../../src/ordenes/services/product-processing.service';
import {ProductoVariantes} from '../../../../src/productos/esquemas/producto-variantes.entity';
import {OrdenesProductos} from '../../../../src/ordenes-productos/esquemas/ordenes-productos.entity';
import {OrdenProductoSabor} from '../../../../src/ordenes-productos/esquemas/orden-producto-sabor.entity';
import {PizzaSabor} from '../../../../src/pizza-sabores/esquemas/pizza-sabores.entity';
import {EmpresaConfig} from '../../../../src/empresa/esquemas/empresa.entity';

/** Detalle mínimo válido para probar vincularProductoAOrden. */
function detalle(overrides: Partial<DetalleLinea> = {}): DetalleLinea {
	return {
		ordenId: 1,
		nombre: 'Pizza - Grande (Paisa)',
		cantidad: 1,
		precioUnitario: 45000,
		varianteId: 5,
		base: null,
		productoId: 2,
		productoBase: 'Pizza',
		varianteNombre: 'Grande',
		tamano: 'grande',
		categoria: 'pizza',
		precioLista: 45000,
		precioManual: false,
		sabores: [],
		...overrides,
	};
}

const GRUPO_PIZZA_TEST = {
	id: 1,
	nombre: 'Pizza',
	maxSabores: 3,
	varianteEsSabor: false,
	usaTamano: true,
	recargoExtraDesde: 3,
	recargoExtraPequena: 3000,
	recargoExtraMediana: 3500,
	recargoExtraGrande: 4000,
};
const GRUPO_CALZONE_TEST = {
	id: 2,
	nombre: 'Calzone',
	maxSabores: 2,
	varianteEsSabor: true,
	usaTamano: false,
	recargoExtraDesde: null,
	recargoExtraPequena: 0,
	recargoExtraMediana: 0,
	recargoExtraGrande: 0,
};

const sabor = (saborId: number, nombre: string, grupoId: number, r: [number, number, number] = [0, 0, 0]) => ({
	saborId,
	nombre,
	grupoId,
	recargoPequena: String(r[0]),
	recargoMediana: String(r[1]),
	recargoGrande: String(r[2]),
});
const CATALOGO_SABORES = [
	sabor(1, 'Paisa', 1, [1000, 2000, 2000]),
	sabor(2, 'Carnes', 1),
	sabor(3, 'Jamón y Queso', 1),
	sabor(4, 'De Casa', 2),
	sabor(5, 'Carnes', 2),
];

describe('ProductProcessingService', () => {
	let service: ProductProcessingService;
	let mockVariantesRepo: any;
	let mockOrdenesProductosRepo: any;
	let mockSaboresLineaRepo: any;
	let mockSaboresRepo: any;
	let mockEmpresaConfigRepo: any;

	beforeEach(async () => {
		mockVariantesRepo = {findOne: jest.fn()};
		mockOrdenesProductosRepo = {save: jest.fn().mockResolvedValue({id: '10'}), delete: jest.fn()};
		mockSaboresLineaRepo = {
			save: jest.fn().mockResolvedValue([]),
			create: jest.fn().mockImplementation((v) => v),
		};
		mockSaboresRepo = {
			findOne: jest.fn(),
			// find({where:{grupoId, nombre?: In([...])}}): catálogo del grupo, o solo los nombres exactos pedidos.
			find: jest.fn().mockImplementation(({where}: any) => {
				const delGrupo = CATALOGO_SABORES.filter((s) => s.grupoId === where.grupoId);
				const nombres: string[] | undefined = where.nombre?.value;
				return Promise.resolve(nombres ? delGrupo.filter((s) => nombres.includes(s.nombre)) : delGrupo);
			}),
		};
		mockEmpresaConfigRepo = {findOne: jest.fn().mockResolvedValue({recargoLeche: 1000})};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ProductProcessingService,
				{provide: getRepositoryToken(ProductoVariantes), useValue: mockVariantesRepo},
				{provide: getRepositoryToken(OrdenesProductos), useValue: mockOrdenesProductosRepo},
				{provide: getRepositoryToken(OrdenProductoSabor), useValue: mockSaboresLineaRepo},
				{provide: getRepositoryToken(PizzaSabor), useValue: mockSaboresRepo},
				{provide: getRepositoryToken(EmpresaConfig), useValue: mockEmpresaConfigRepo},
			],
		}).compile();

		service = module.get<ProductProcessingService>(ProductProcessingService);
	});

	/** Línea guardada en la N-ésima llamada a save del repo de líneas. */
	const lineaGuardada = (n = 0) => mockOrdenesProductosRepo.save.mock.calls[n][0];
	/** Filas de sabores guardadas en la N-ésima llamada. */
	const saboresGuardados = (n = 0) => mockSaboresLineaRepo.save.mock.calls[n][0];

	// ==================== construirNombreProducto ====================

	describe('construirNombreProducto', () => {
		it('construye nombre para pizza con un sabor', () => {
			const result = service.construirNombreProducto({tipo: 'pizza', tamano: 'grande', sabor1: 'paisa'} as any);
			expect(result).toBe('pizza grande paisa');
		});

		it('construye nombre para pizza con dos sabores', () => {
			const result = service.construirNombreProducto({
				tipo: 'Pizza',
				tamano: 'mediana',
				sabor1: 'paisa',
				sabor2: 'hawaiana',
			} as any);
			expect(result).toBe('Pizza mediana paisa y hawaiana');
		});

		it('construye nombre para pizza con tres sabores', () => {
			const result = service.construirNombreProducto({
				tipo: 'Pizza',
				tamano: 'grande',
				sabor1: 'paisa',
				sabor2: 'hawaiana',
				sabor3: 'bbq',
			} as any);
			expect(result).toBe('Pizza grande paisa y hawaiana y bbq');
		});

		it('construye nombre para producto no-pizza', () => {
			const result = service.construirNombreProducto({tipo: 'Chuzo'} as any);
			expect(result).toBe('Chuzo');
		});

		it('construye nombre para producto no-pizza con tamaño', () => {
			const result = service.construirNombreProducto({tipo: 'Bebida', tamano: 'grande'} as any);
			expect(result).toBe('Bebida grande');
		});

		it('usa "Producto" como fallback cuando tipo es undefined', () => {
			const result = service.construirNombreProducto({tipo: undefined} as any);
			expect(result).toBe('Producto');
		});
	});

	// ==================== vincularProductoAOrden ====================

	describe('vincularProductoAOrden', () => {
		it('guarda texto y detalle estructurado, marcando detalle_version v1', async () => {
			await service.vincularProductoAOrden(detalle({cantidad: 2, precioUnitario: 25000}));

			expect(mockOrdenesProductosRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					ordenId: 1,
					producto: 'Pizza - Grande (Paisa)',
					cantidad: 2,
					precioUnitario: 25000,
					varianteId: 5,
					productoId: 2,
					productoBase: 'Pizza',
					varianteNombre: 'Grande',
					tamano: 'grande',
					categoria: 'pizza',
					precioLista: 45000,
					precioManual: false,
					detalleVersion: 'v1',
				}),
			);
		});

		it('no escribe filas de sabores si la línea no tiene', async () => {
			await service.vincularProductoAOrden(detalle({sabores: []}));
			expect(mockSaboresLineaRepo.save).not.toHaveBeenCalled();
		});

		it('escribe una fila por sabor con posición y fracción 1/n', async () => {
			await service.vincularProductoAOrden(
				detalle({
					sabores: [
						{saborId: 1, nombre: 'Paisa'},
						{saborId: null, nombre: 'Inventado'},
					],
				}),
			);

			expect(saboresGuardados()).toEqual([
				{ordenProductoId: '10', saborId: 1, saborNombre: 'Paisa', posicion: 1, fraccion: 0.5},
				{ordenProductoId: '10', saborId: null, saborNombre: 'Inventado', posicion: 2, fraccion: 0.5},
			]);
		});

		it('redondea la fracción de 3 sabores a 4 decimales', async () => {
			await service.vincularProductoAOrden(
				detalle({
					sabores: [
						{saborId: 1, nombre: 'Paisa'},
						{saborId: 2, nombre: 'Carnes'},
						{saborId: 4, nombre: 'De Casa'},
					],
				}),
			);
			expect(saboresGuardados().map((s: any) => s.fraccion)).toEqual([0.3333, 0.3333, 0.3333]);
		});

		it('usa los repos del manager cuando se provee', async () => {
			const managerOPRepo = {save: jest.fn().mockResolvedValue({id: '7'})};
			const managerSaboresRepo = {save: jest.fn(), create: jest.fn().mockImplementation((v) => v)};
			const manager = {
				getRepository: jest
					.fn()
					.mockImplementation((entity) => (entity === OrdenesProductos ? managerOPRepo : managerSaboresRepo)),
			};

			await service.vincularProductoAOrden(detalle({sabores: [{saborId: 1, nombre: 'Paisa'}]}), manager as any);

			expect(manager.getRepository).toHaveBeenCalledWith(OrdenesProductos);
			expect(manager.getRepository).toHaveBeenCalledWith(OrdenProductoSabor);
			expect(managerOPRepo.save).toHaveBeenCalled();
			expect(managerSaboresRepo.save.mock.calls[0][0][0]).toEqual(
				expect.objectContaining({ordenProductoId: '7', saborId: 1}),
			);
			expect(mockOrdenesProductosRepo.save).not.toHaveBeenCalled();
		});
	});

	// ==================== eliminarProductosDeOrden ====================

	describe('eliminarProductosDeOrden', () => {
		it('elimina por ordenId usando el repo directo', async () => {
			mockOrdenesProductosRepo.delete.mockResolvedValue({affected: 3});

			await service.eliminarProductosDeOrden(5);

			expect(mockOrdenesProductosRepo.delete).toHaveBeenCalledWith({ordenId: 5});
		});

		it('usa el repo del manager cuando se provee', async () => {
			const managerRepo = {delete: jest.fn().mockResolvedValue({})};
			const manager = {getRepository: jest.fn().mockReturnValue(managerRepo)};

			await service.eliminarProductosDeOrden(3, manager as any);

			expect(manager.getRepository).toHaveBeenCalledWith(OrdenesProductos);
			expect(managerRepo.delete).toHaveBeenCalledWith({ordenId: 3});
		});
	});

	// ==================== procesarProductos ====================

	describe('procesarProductos', () => {
		const variante = (nombre: string, precio: number, producto: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
			varianteId: 1,
			precio,
			nombre,
			producto,
			...extra,
		});
		const pizza = (extra: Record<string, unknown> = {}) => ({
			productoId: 2,
			productoNombre: 'Pizza',
			personalizacion: 'pizza',
			saborGrupo: GRUPO_PIZZA_TEST,
			...extra,
		});
		const calzone = () => ({productoId: 6, productoNombre: 'Calzone', personalizacion: 'calzone', saborGrupo: GRUPO_CALZONE_TEST});

		it('lanza BadRequestException si no se encuentra la variante', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(null);

			await expect(service.procesarProductos(1, [{varianteId: 99, cantidad: 1} as any])).rejects.toThrow(
				BadRequestException,
			);
		});

		it('pide la variante con el grupo de sabores de su producto', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(variante('Grande', 20000, {productoNombre: 'Chuzo'}));

			await service.procesarProductos(1, [{varianteId: 1, cantidad: 1} as any]);

			expect(mockVariantesRepo.findOne).toHaveBeenCalledWith(
				expect.objectContaining({relations: ['producto', 'producto.saborGrupo']}),
			);
		});

		it('calcula total sin sabores', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(variante('Grande', 20000, {productoNombre: 'Chuzo'}));

			const result = await service.procesarProductos(1, [{varianteId: 1, cantidad: 2} as any]);

			expect(result.total).toBe(40000);
			expect(result.items).toHaveLength(1);
			expect(result.items[0].precioUnitario).toBe(20000);
		});

		it('un producto sin grupo no cobra recargos aunque lleguen sabores', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(variante('Grande', 20000, {productoNombre: 'Hamburguesa'}));

			const result = await service.procesarProductos(1, [{varianteId: 1, cantidad: 1, sabor1: 'Paisa'} as any]);

			expect(result.total).toBe(20000);
			expect(mockSaboresLineaRepo.save).not.toHaveBeenCalled();
		});

		it('agrega el recargo del sabor en variante grande', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(variante('Grande', 30000, pizza()));

			const result = await service.procesarProductos(1, [{varianteId: 1, cantidad: 1, sabor1: 'Paisa'} as any]);

			expect(result.total).toBe(32000);
			expect(result.items[0].precioUnitario).toBe(32000);
		});

		it('aplica recargoPequena cuando la variante es pequeña', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(variante('Pequeña', 15000, pizza()));

			const result = await service.procesarProductos(1, [{varianteId: 1, cantidad: 1, sabor1: 'Paisa'} as any]);

			expect(result.total).toBe(16000);
		});

		it('aplica recargoMediana cuando la variante es mediana', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(variante('Mediana', 22000, pizza()));

			const result = await service.procesarProductos(1, [{varianteId: 1, cantidad: 1, sabor1: 'Paisa'} as any]);

			expect(result.total).toBe(24000);
		});

		it('el tamaño explícito de la variante manda sobre el que sugiere su nombre', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(variante('Familiar', 40000, pizza(), {tamano: 'pequena'}));

			const result = await service.procesarProductos(1, [{varianteId: 1, cantidad: 1, sabor1: 'Paisa'} as any]);

			expect(result.total).toBe(41000); // recargoPequena de Paisa
			expect(lineaGuardada()).toEqual(expect.objectContaining({tamano: 'pequena'}));
		});

		it('un sabor sin recargo no cobra nada y se cobra el mayor entre varios, no la suma', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(variante('Grande', 30000, pizza()));

			const sinRecargo = await service.procesarProductos(1, [{varianteId: 1, cantidad: 1, sabor1: 'Carnes'} as any]);
			const mayor = await service.procesarProductos(1, [
				{varianteId: 1, cantidad: 1, sabor1: 'Paisa', sabor2: 'Carnes'} as any,
			]);

			expect(sinRecargo.total).toBe(30000);
			expect(mayor.total).toBe(32000);
		});

		it('agrega el recargo extra del grupo desde 3 sabores', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(variante('Grande', 30000, pizza()));

			const result = await service.procesarProductos(1, [
				{varianteId: 1, cantidad: 1, sabor1: 'Carnes', sabor2: 'De Casa', sabor3: 'Jamón y Queso'} as any,
			]);

			expect(result.total).toBe(34000); // 30000 + 4000 (extra grande del grupo)
		});

		it('suma recargo del sabor y recargo extra por 3 sabores', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(variante('Grande', 30000, pizza()));

			const result = await service.procesarProductos(1, [
				{varianteId: 1, cantidad: 1, sabor1: 'Paisa', sabor2: 'De Casa', sabor3: 'Carnes'} as any,
			]);

			expect(result.total).toBe(36000); // 30000 + 2000 + 4000
		});

		it('el calzone cobra la columna "grande" del sabor y no tiene recargo por cantidad', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(variante('De Casa', 25000, calzone()));

			const result = await service.procesarProductos(1, [
				{varianteId: 1, cantidad: 1, sabor1: 'De Casa', sabor2: 'Carnes'} as any,
			]);

			expect(result.total).toBe(25000);
			expect(lineaGuardada().producto).toBe('Calzone (De Casa + Carnes)');
		});

		it('procesa múltiples productos y acumula el total correctamente', async () => {
			mockVariantesRepo.findOne
				.mockResolvedValueOnce(variante('Grande', 20000, {productoNombre: 'Chuzo'}))
				.mockResolvedValueOnce(variante('Pequeño', 10000, {productoNombre: 'Bebida'}, {varianteId: 2}));

			const result = await service.procesarProductos(1, [
				{varianteId: 1, cantidad: 1} as any,
				{varianteId: 2, cantidad: 2} as any,
			]);

			expect(result.total).toBe(40000);
			expect(result.items).toHaveLength(2);
		});

		it('usa los repos del manager cuando se provee', async () => {
			const managerERepo = {findOne: jest.fn().mockResolvedValue({recargoLeche: 1000})};
			const managerVRepo = {
				findOne: jest.fn().mockResolvedValue(variante('Mediana', 10000, {productoNombre: 'Bebida'})),
			};
			const managerSRepo = {};
			const managerOPRepo = {save: jest.fn().mockResolvedValue({id: '1'})};
			const manager = {
				getRepository: jest.fn().mockImplementation((entity) => {
					if (entity === EmpresaConfig) return managerERepo;
					if (entity === ProductoVariantes) return managerVRepo;
					if (entity === PizzaSabor) return managerSRepo;
					if (entity === OrdenesProductos) return managerOPRepo;
					return {};
				}),
			};

			await service.procesarProductos(1, [{varianteId: 1, cantidad: 1} as any], manager as any);

			expect(managerVRepo.findOne).toHaveBeenCalled();
			expect(managerOPRepo.save).toHaveBeenCalled();
		});

		// ── Detalle estructurado ────────────────────────────────────────────

		it('persiste producto, variante, tamaño y categoría de una pizza', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(
				variante('Grande', 45000, pizza({categoria: null}), {varianteId: 3, productoId: 2}),
			);

			await service.procesarProductos(1, [{varianteId: 3, cantidad: 1, sabor1: 'Carnes'} as any]);

			expect(lineaGuardada()).toEqual(
				expect.objectContaining({
					producto: 'Pizza - Grande (Carnes)',
					productoId: 2,
					productoBase: 'Pizza',
					varianteNombre: 'Grande',
					tamano: 'grande',
					categoria: 'pizza',
					precioLista: 45000,
					precioManual: false,
					detalleVersion: 'v1',
				}),
			);
		});

		it('respeta la categoría configurada en el producto', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(
				variante('Coca Cola Personal', 6000, {productoId: 9, productoNombre: 'GASEOSA', categoria: 'bebida'}, {varianteId: 8}),
			);

			await service.procesarProductos(1, [{varianteId: 8, cantidad: 1} as any]);

			// "Personal" NO es tamaño fuera de un grupo con tamaños.
			expect(lineaGuardada()).toEqual(expect.objectContaining({categoria: 'bebida', tamano: null}));
		});

		it('no asigna tamaño a una adición aunque la variante se llame Grande', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(
				variante('Grande', 12000, {productoId: 5, productoNombre: 'Adición de Queso'}, {varianteId: 4}),
			);

			await service.procesarProductos(1, [{varianteId: 4, cantidad: 1} as any]);

			expect(lineaGuardada()).toEqual(expect.objectContaining({categoria: 'adicion', tamano: null}));
			expect(mockSaboresLineaRepo.save).not.toHaveBeenCalled();
		});

		it('resuelve sabores sin distinguir mayúsculas ni tildes, deduplica y marca los desconocidos', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(variante('Grande', 45000, pizza(), {varianteId: 3}));

			await service.procesarProductos(1, [
				{varianteId: 3, cantidad: 1, sabor1: 'jamon y queso', sabor2: 'PAISA', sabor3: 'Paisa'} as any,
			]);

			const filas = saboresGuardados();
			expect(filas.map((f: any) => [f.saborId, f.saborNombre, f.posicion, f.fraccion])).toEqual([
				[3, 'Jamón y Queso', 1, 0.5],
				[1, 'Paisa', 2, 0.5],
			]);

			// Un sabor que no existe queda "sin clasificar" (saborId null) con su nombre.
			mockSaboresLineaRepo.save.mockClear();
			await service.procesarProductos(1, [{varianteId: 3, cantidad: 1, sabor1: 'Marciana'} as any]);
			expect(saboresGuardados()[0]).toEqual(
				expect.objectContaining({saborId: null, saborNombre: 'Marciana', fraccion: 1}),
			);
		});

		it('el recargo se busca solo entre los sabores del grupo; con minúsculas no cobra pero sí clasifica', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(variante('Grande', 45000, pizza(), {varianteId: 3}));

			const result = await service.procesarProductos(1, [{varianteId: 3, cantidad: 1, sabor1: 'paisa'} as any]);

			expect(mockSaboresRepo.find).toHaveBeenCalledWith({
				where: {grupoId: GRUPO_PIZZA_TEST.id, nombre: expect.anything()},
			});
			// Comparación exacta (como siempre): 'paisa' no encuentra 'Paisa' y no cobra recargo…
			expect(result.total).toBe(45000);
			// …pero el id del sabor sí se resuelve para la analítica.
			expect(saboresGuardados()[0]).toEqual(expect.objectContaining({saborId: 1, saborNombre: 'Paisa'}));
		});

		it('un calzone sin sabores toma la variante como sabor solo si coincide con uno real', async () => {
			mockVariantesRepo.findOne.mockResolvedValueOnce(variante('De Casa', 25000, calzone(), {varianteId: 20}));
			await service.procesarProductos(1, [{varianteId: 20, cantidad: 1} as any]);
			expect(lineaGuardada()).toEqual(
				expect.objectContaining({producto: 'Calzone', categoria: 'calzone', tamano: null}),
			);
			expect(saboresGuardados()[0]).toEqual(
				expect.objectContaining({saborId: 4, saborNombre: 'De Casa', fraccion: 1}),
			);

			mockSaboresLineaRepo.save.mockClear();
			mockVariantesRepo.findOne.mockResolvedValueOnce(variante('UNIDAD', 25000, calzone(), {varianteId: 21}));
			await service.procesarProductos(1, [{varianteId: 21, cantidad: 1} as any]);
			expect(mockSaboresLineaRepo.save).not.toHaveBeenCalled();
		});

		it('registra precio manual sin recargos y conserva el precio de lista calculado', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(variante('Grande', 45000, pizza(), {varianteId: 3}));

			const result = await service.procesarProductos(1, [
				{varianteId: 3, cantidad: 2, sabor1: 'Paisa', precioUnitario: 40000} as any,
			]);

			expect(result.total).toBe(80000);
			expect(lineaGuardada()).toEqual(
				expect.objectContaining({precioUnitario: 40000, precioLista: 47000, precioManual: true}),
			);
		});

		it('carga el catálogo de sabores una sola vez por grupo y por orden', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(variante('Grande', 45000, pizza(), {varianteId: 3}));

			await service.procesarProductos(1, [
				{varianteId: 3, cantidad: 1, sabor1: 'Paisa'} as any,
				{varianteId: 3, cantidad: 1, sabor1: 'Carnes'} as any,
			]);

			const cargasCatalogo = mockSaboresRepo.find.mock.calls.filter((c: any[]) => !c[0].where.nombre);
			expect(cargasCatalogo).toHaveLength(1);
		});
	});
});
