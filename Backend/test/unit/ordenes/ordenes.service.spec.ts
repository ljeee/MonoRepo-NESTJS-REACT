import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {BadRequestException, ConflictException, NotFoundException} from '@nestjs/common';
import {OrdenesService} from '../../../src/ordenes/ordenes.service';
import {Ordenes} from '../../../src/ordenes/esquemas/ordenes.entity';
import {OrdenesGateway} from '../../../src/ordenes/ordenes.gateway';
import {FacturaCreationService} from '../../../src/ordenes/services/factura-creation.service';
import {DomicilioCreationService} from '../../../src/ordenes/services/domicilio-creation.service';
import {ProductProcessingService} from '../../../src/ordenes/services/product-processing.service';
import {CierresService} from '../../../src/cierres/cierres.service';
import {CajaMovimientosService} from '../../../src/caja-movimientos/caja-movimientos.service';
import {ConsumoOrdenService} from '../../../src/inventario/consumo-orden.service';
import {EstadisticasGateway} from '../../../src/estadisticas/estadisticas.gateway';
import {CajaMovimiento} from '../../../src/caja-movimientos/esquemas/caja-movimiento.entity';

const makeQb = () => ({
	leftJoinAndSelect: jest.fn().mockReturnThis(),
	orderBy: jest.fn().mockReturnThis(),
	take: jest.fn().mockReturnThis(),
	skip: jest.fn().mockReturnThis(),
	andWhere: jest.fn().mockReturnThis(),
	where: jest.fn().mockReturnThis(),
	getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
	getMany: jest.fn().mockResolvedValue([]),
});

describe('OrdenesService', () => {
	let service: OrdenesService;
	let qb: ReturnType<typeof makeQb>;
	let mockRepo: any;
	let mockGateway: any;
	let mockFacturaService: any;
	let mockDomicilioService: any;
	let mockProductService: any;
	let mockCierresService: any;
	let mockCajaMovimientosService: any;
	let mockConsumoOrden: any;
	let mockEstadisticasGateway: any;

	beforeEach(async () => {
		qb = makeQb();

		mockRepo = {
			createQueryBuilder: jest.fn(() => qb),
			findOne: jest.fn(),
			save: jest.fn(),
			delete: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			manager: {transaction: jest.fn()},
		};

		mockGateway = {
			emitirNuevaOrden: jest.fn(),
			emitirOrdenActualizada: jest.fn(),
		};

		mockFacturaService = {
			generarDescripcionFactura: jest.fn().mockReturnValue('1 pizza grande paisa'),
			crearFactura: jest.fn().mockResolvedValue({facturaId: 1, total: 0}),
			updateFacturaTotal: jest.fn().mockResolvedValue(undefined),
			updateFactura: jest.fn().mockResolvedValue(undefined),
			cancelarFactura: jest.fn().mockResolvedValue(undefined),
			findByIdempotencyKey: jest.fn().mockResolvedValue(null),
		};

		mockDomicilioService = {
			esDomicilio: jest.fn().mockReturnValue(false),
			procesarDomicilio: jest.fn().mockResolvedValue(undefined),
			updateDomicilioPorOrden: jest.fn().mockResolvedValue(undefined),
		};

		mockProductService = {
			procesarProductos: jest.fn().mockResolvedValue({total: 50000}),
			eliminarProductosDeOrden: jest.fn().mockResolvedValue(undefined),
			construirNombreProducto: jest.fn().mockReturnValue('pizza grande paisa'),
		};

		mockCierresService = {
			updateCierreIfExists: jest.fn().mockResolvedValue(undefined),
		};

		mockCajaMovimientosService = {
			compensarFactura: jest.fn().mockResolvedValue([]),
			registrarEntrada: jest.fn().mockResolvedValue(undefined),
		};

		mockConsumoOrden = {
			reconciliar: jest.fn().mockResolvedValue(false),
		};

		mockEstadisticasGateway = {
			emitirActualizacionStats: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				OrdenesService,
				{provide: getRepositoryToken(Ordenes), useValue: mockRepo},
				{provide: OrdenesGateway, useValue: mockGateway},
				{provide: FacturaCreationService, useValue: mockFacturaService},
				{provide: DomicilioCreationService, useValue: mockDomicilioService},
				{provide: ProductProcessingService, useValue: mockProductService},
				{provide: CierresService, useValue: mockCierresService},
				{provide: CajaMovimientosService, useValue: mockCajaMovimientosService},
				{provide: ConsumoOrdenService, useValue: mockConsumoOrden},
				{provide: EstadisticasGateway, useValue: mockEstadisticasGateway},
			],
		}).compile();

		service = module.get<OrdenesService>(OrdenesService);
	});

	// ==================== findAll ====================

	describe('findAll', () => {
		it('retorna lista paginada con valores por defecto', async () => {
			const orden = {ordenId: 1, estadoOrden: 'pendiente', fechaOrden: new Date()};
			qb.getManyAndCount.mockResolvedValue([[orden], 1]);

			const result = await service.findAll({});

			expect(result).toEqual({data: [orden], total: 1, page: 1, limit: 50, totalPages: 1});
		});

		it('aplica filtro de estado', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);
			await service.findAll({estado: 'pendiente'});
			expect(qb.andWhere).toHaveBeenCalledWith('o.estadoOrden = :estado', {estado: 'pendiente'});
		});

		it('aplica filtro de rango de fechas completo', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);
			await service.findAll({from: '2024-01-01', to: '2024-01-31'});
			expect(qb.andWhere).toHaveBeenCalledWith(
				'o.fechaOrden BETWEEN :from AND :to',
				expect.objectContaining({from: expect.any(Date), to: expect.any(Date)}),
			);
		});

		it('aplica filtro solo desde when to está ausente', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);
			await service.findAll({from: '2024-01-01'});
			expect(qb.andWhere).toHaveBeenCalledWith('o.fechaOrden >= :from', expect.any(Object));
		});

		it('aplica filtro solo hasta when from está ausente', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);
			await service.findAll({to: '2024-01-31'});
			expect(qb.andWhere).toHaveBeenCalledWith('o.fechaOrden <= :to', expect.any(Object));
		});

		it('calcula totalPages correctamente con múltiples páginas', async () => {
			qb.getManyAndCount.mockResolvedValue([Array(10).fill({}), 25]);
			const result = await service.findAll({limit: 10});
			expect(result.totalPages).toBe(3);
		});

		it('respeta page y limit personalizados', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);
			await service.findAll({page: 2, limit: 20});
			expect(qb.take).toHaveBeenCalledWith(20);
			expect(qb.skip).toHaveBeenCalledWith(20);
		});
	});

	// ==================== findOne ====================

	describe('findOne', () => {
		it('retorna la orden cuando existe', async () => {
			const orden = {ordenId: 1, estadoOrden: 'pendiente'};
			mockRepo.findOne.mockResolvedValue(orden);

			const result = await service.findOne(1);

			expect(result).toEqual(orden);
			expect(mockRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({where: {ordenId: 1}}));
		});

		it('lanza NotFoundException cuando la orden no existe', async () => {
			mockRepo.findOne.mockResolvedValue(null);
			await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
		});
	});

	// ==================== findByDay ====================

	describe('findByDay', () => {
		it('retorna las ordenes del día actual', async () => {
			const ordenes = [{ordenId: 1}, {ordenId: 2}];
			qb.getMany.mockResolvedValue(ordenes);

			const result = await service.findByDay();

			expect(result).toEqual(ordenes);
			expect(qb.where).toHaveBeenCalledWith(
				'o.fechaOrden BETWEEN :start AND :end',
				expect.objectContaining({start: expect.any(Date), end: expect.any(Date)}),
			);
		});

		it('aplica filtro de estado cuando se provee', async () => {
			qb.getMany.mockResolvedValue([]);
			await service.findByDay('pendiente');
			expect(qb.andWhere).toHaveBeenCalledWith('o.estadoOrden = :estado', {estado: 'pendiente'});
		});
	});

	// ==================== remove ====================

	describe('remove', () => {
		let txManager: any;
		beforeEach(() => {
			txManager = {getRepository: jest.fn().mockReturnValue(mockRepo)};
			mockRepo.manager.transaction.mockImplementation(async (cb: Function) => cb(txManager));
		});

		it('elimina la orden cuando la factura no está pagada', async () => {
			mockRepo.findOne.mockResolvedValue({ordenId: 1, factura: {estado: 'pendiente'}});
			mockRepo.delete.mockResolvedValue({affected: 1});

			await service.remove(1);

			expect(mockRepo.delete).toHaveBeenCalledWith(1);
		});

		it('devuelve el inventario de la orden ANTES de borrarla, en la misma transacción', async () => {
			mockRepo.findOne.mockResolvedValue({ordenId: 1, factura: {estado: 'pendiente'}});
			const orden: string[] = [];
			mockConsumoOrden.reconciliar.mockImplementation(async () => orden.push('reconciliar'));
			mockRepo.delete.mockImplementation(async () => orden.push('delete'));

			await service.remove(1);

			expect(mockConsumoOrden.reconciliar).toHaveBeenCalledWith(1, txManager, {eliminada: true});
			expect(orden).toEqual(['reconciliar', 'delete']);
		});

		it('lanza BadRequestException cuando la factura está pagada', async () => {
			mockRepo.findOne.mockResolvedValue({ordenId: 1, factura: {estado: 'pagada'}});

			await expect(service.remove(1)).rejects.toThrow(BadRequestException);
			expect(mockRepo.delete).not.toHaveBeenCalled();
			expect(mockConsumoOrden.reconciliar).not.toHaveBeenCalled();
		});

		it('elimina la orden aunque no tenga factura asociada', async () => {
			mockRepo.findOne.mockResolvedValue({ordenId: 1, factura: null});
			mockRepo.delete.mockResolvedValue({affected: 1});

			await service.remove(1);

			expect(mockRepo.delete).toHaveBeenCalledWith(1);
		});
	});

	// ==================== cancel ====================

	describe('cancel', () => {
		const setupCancel = (orden: any) => {
			const fullOrden = {...orden, estadoOrden: 'cancelado', fechaOrden: new Date()};
			const oRepo = {
				findOne: jest.fn().mockResolvedValueOnce(orden).mockResolvedValueOnce(fullOrden),
				save: jest.fn().mockResolvedValue(undefined),
				delete: jest.fn().mockResolvedValue(undefined),
			};
			mockRepo.manager.transaction.mockImplementation(async (cb: Function) =>
				cb({getRepository: jest.fn().mockReturnValue(oRepo)}),
			);
			return {oRepo, fullOrden};
		};

		it('cancela correctamente una orden en estado pendiente', async () => {
			const orden = {
				ordenId: 1,
				estadoOrden: 'pendiente',
				facturaId: 5,
				observaciones: null,
				fechaOrden: new Date(),
			};
			const {oRepo} = setupCancel(orden);

			await service.cancel(1, 'cliente pidió cancelar', 'user-1');

			const saved = oRepo.save.mock.calls[0][0];
			expect(saved.estadoOrden).toBe('cancelado');
			expect(mockFacturaService.cancelarFactura).toHaveBeenCalledWith(5, expect.anything());
			expect(mockConsumoOrden.reconciliar).toHaveBeenCalledWith(1, expect.anything());
			expect(mockGateway.emitirOrdenActualizada).toHaveBeenCalled();
		});

		it('cancela correctamente una orden en estado preparacion', async () => {
			const orden = {
				ordenId: 1,
				estadoOrden: 'preparacion',
				facturaId: 5,
				observaciones: null,
				fechaOrden: new Date(),
			};
			const {oRepo} = setupCancel(orden);

			await service.cancel(1, '', 'user-1');

			expect(oRepo.save).toHaveBeenCalled();
		});

		it('agrega la razón a las observaciones existentes', async () => {
			const orden = {
				ordenId: 1,
				estadoOrden: 'pendiente',
				facturaId: 5,
				observaciones: 'sin cebolla',
				fechaOrden: new Date(),
			};
			const {oRepo} = setupCancel(orden);

			await service.cancel(1, 'mal pedido', 'user-1');

			const saved = oRepo.save.mock.calls[0][0];
			expect(saved.observaciones).toContain('sin cebolla');
			expect(saved.observaciones).toContain('mal pedido');
		});

		it('guarda el userId del usuario que cancela', async () => {
			const orden = {
				ordenId: 1,
				estadoOrden: 'pendiente',
				facturaId: 5,
				observaciones: null,
				fechaOrden: new Date(),
			};
			const {oRepo} = setupCancel(orden);

			await service.cancel(1, '', 'user-abc');

			const saved = oRepo.save.mock.calls[0][0];
			expect(saved.usuarioCancelacionId).toBe('user-abc');
		});

		it('lanza BadRequestException si la orden ya está completada', async () => {
			const orden = {ordenId: 1, estadoOrden: 'completada', facturaId: 5};
			setupCancel(orden);

			await expect(service.cancel(1, 'razón', 'user-1')).rejects.toThrow(BadRequestException);
		});

		it('lanza NotFoundException si la orden no existe', async () => {
			const oRepo = {findOne: jest.fn().mockResolvedValue(null)};
			mockRepo.manager.transaction.mockImplementation(async (cb: Function) =>
				cb({getRepository: jest.fn().mockReturnValue(oRepo)}),
			);

			await expect(service.cancel(999, 'razón', 'user-1')).rejects.toThrow(NotFoundException);
		});

		it('actualiza cierre del día después de cancelar', async () => {
			const orden = {ordenId: 1, estadoOrden: 'pendiente', facturaId: 5, fechaOrden: new Date()};
			setupCancel(orden);

			await service.cancel(1, '', 'user-1');

			expect(mockCierresService.updateCierreIfExists).toHaveBeenCalled();
		});
	});

	// ==================== completar ====================

	describe('completar', () => {
		const setupCompletar = (orden: any) => {
			const fullOrden = {...orden, estadoOrden: 'completada', fechaOrden: new Date()};
			const oRepo = {
				findOne: jest.fn().mockResolvedValueOnce(orden).mockResolvedValueOnce(fullOrden),
				save: jest.fn().mockResolvedValue(undefined),
			};
			const cajaRepo = {
				save: jest.fn().mockResolvedValue(undefined),
			};
			/** cuentas_transferencia que existen: 1 = Nequi, 2 = Bancolombia. */
			const query = jest.fn(async (sql: string, params: unknown[]) => {
				const cuentas = [{id: 1, nombre: 'Nequi'}, {id: 2, nombre: 'Bancolombia'}];
				if (/WHERE id = \$1/.test(sql)) return cuentas.filter((c) => c.id === params[0]);
				if (/lower\(nombre\)/.test(sql)) return cuentas.filter((c) => c.nombre.toLowerCase() === String(params[0]).toLowerCase());
				return [];
			});
			mockRepo.manager.transaction.mockImplementation(async (cb: Function) =>
				cb({
					query,
					getRepository: jest.fn().mockImplementation((entity) => {
						if (entity === CajaMovimiento) return cajaRepo;
						return oRepo;
					}),
				}),
			);
			return {oRepo, cajaRepo, fullOrden};
		};

		it('completa la orden y actualiza la factura', async () => {
			const orden = {
				ordenId: 1,
				estadoOrden: 'pendiente',
				facturaId: 5,
				updatedAt: new Date(),
				fechaOrden: new Date(),
			};
			const {oRepo} = setupCompletar(orden);

			await service.completar(1, 'efectivo', 'user-1', '127.0.0.1');

			expect(mockFacturaService.updateFactura).toHaveBeenCalledWith(
				5,
				expect.objectContaining({metodo: 'efectivo', estado: 'pagado'}),
				expect.anything(),
			);
			const saved = oRepo.save.mock.calls[0][0];
			expect(saved.estadoOrden).toBe('completada');
		});

		it('guarda userId e IP en la factura al completar', async () => {
			const orden = {
				ordenId: 1,
				estadoOrden: 'pendiente',
				facturaId: 5,
				updatedAt: new Date(),
				fechaOrden: new Date(),
			};
			setupCompletar(orden);

			await service.completar(1, 'transferencia', 'user-cajero', '192.168.1.1', undefined, undefined, undefined, undefined, undefined, 1);

			expect(mockFacturaService.updateFactura).toHaveBeenCalledWith(
				5,
				expect.objectContaining({usuarioCobroId: 'user-cajero', ipDispositivo: '192.168.1.1'}),
				expect.anything(),
			);
		});

		describe('cuenta de transferencia obligatoria', () => {
			const orden = () => ({ordenId: 1, estadoOrden: 'pendiente', facturaId: 5, updatedAt: new Date(), fechaOrden: new Date(), factura: {total: 40000, estado: 'pendiente'}});

			it('cobrar por transferencia o QR sin cuenta se rechaza y no toca la factura', async () => {
				setupCompletar(orden());

				await expect(service.completar(1, 'qr', 'u', 'ip')).rejects.toThrow(/cuenta/);
				expect(mockFacturaService.updateFactura).not.toHaveBeenCalled();
			});

			it('una cuenta inexistente se rechaza', async () => {
				setupCompletar(orden());

				await expect(service.completar(1, 'transferencia', 'u', 'ip', undefined, undefined, undefined, undefined, undefined, 99)).rejects.toThrow(/no existe/);
			});

			it('el nombre de la cuenta sale de la tabla, no de lo que mande el cliente', async () => {
				setupCompletar(orden());

				await service.completar(1, 'transferencia', 'u', 'ip', undefined, undefined, undefined, undefined, undefined, 2, 'Nombre inventado');

				expect(mockFacturaService.updateFactura).toHaveBeenCalledWith(5, expect.objectContaining({cuentaTransferenciaId: 2, cuentaTransferenciaNombre: 'Bancolombia'}), expect.anything());
			});

			it('un pago mixto exige la cuenta; el efectivo solo no la pide ni deja una cuenta pegada', async () => {
				setupCompletar(orden());
				await expect(service.completar(1, 'efectivo_transferencia', 'u', 'ip', undefined, undefined, 10000, 30000)).rejects.toThrow(/cuenta/);

				setupCompletar(orden());
				await service.completar(1, 'efectivo', 'u', 'ip', undefined, undefined, undefined, undefined, undefined, 1);
				expect(mockFacturaService.updateFactura).toHaveBeenCalledWith(5, expect.objectContaining({cuentaTransferenciaId: null, cuentaTransferenciaNombre: null}), expect.anything());
			});
		});

		describe('un reintento del mismo cobro no duplica la caja (la llave del cliente puede cambiar)', () => {
			const pagada = (extra: any = {}) => ({
				ordenId: 1,
				estadoOrden: 'pendiente',
				facturaId: 5,
				updatedAt: new Date(),
				fechaOrden: new Date(),
				factura: {total: 40000, estado: 'pagado', metodo: 'efectivo', pagoEfectivo: 40000, pagoTransferencia: 0},
				...extra,
			});

			it('misma forma de pago sobre una factura ya pagada: no actualiza la factura ni registra otra entrada de caja', async () => {
				const {cajaRepo, oRepo} = setupCompletar(pagada());

				await service.completar(1, 'efectivo', 'u', 'ip', 'llave-nueva-en-el-reintento', undefined, undefined, undefined, {'50000': 1});

				expect(mockFacturaService.updateFactura).not.toHaveBeenCalled();
				expect(cajaRepo.save).not.toHaveBeenCalled();
				expect(mockCajaMovimientosService.compensarFactura).not.toHaveBeenCalled();
				expect(oRepo.save.mock.calls[0][0].estadoOrden).toBe('completada'); // la orden sí queda completada
			});

			it('otra forma de pago sobre una factura ya pagada es una corrección: primero sale el efectivo anterior', async () => {
				setupCompletar(pagada());

				await service.completar(1, 'qr', 'u', 'ip', undefined, undefined, undefined, undefined, undefined, 1);

				expect(mockCajaMovimientosService.compensarFactura).toHaveBeenCalledWith(5, 'cobro corregido', expect.anything());
				expect(mockFacturaService.updateFactura).toHaveBeenCalledWith(5, expect.objectContaining({metodo: 'qr', pagoTransferencia: 40000}), expect.anything());
			});
		});

		it('retorna la orden existente si la idempotencyKey ya fue procesada', async () => {
			const orden = {ordenId: 1, estadoOrden: 'completada', facturaId: 5, updatedAt: new Date()};
			setupCompletar(orden);
			mockFacturaService.findByIdempotencyKey.mockResolvedValue({facturaId: 5});
			mockRepo.findOne.mockResolvedValue({...orden, fechaOrden: new Date()});

			await service.completar(1, 'efectivo', 'user-1', '127.0.0.1', 'key-duplicada');

			expect(mockFacturaService.updateFactura).not.toHaveBeenCalled();
		});

		it('lanza ConflictException por modificación concurrente (>1s de diferencia)', async () => {
			const serverDate = new Date('2024-01-01T12:00:00.000Z');
			const clientDate = new Date('2024-01-01T11:00:00.000Z');
			const orden = {ordenId: 1, estadoOrden: 'pendiente', facturaId: 5, updatedAt: serverDate};
			setupCompletar(orden);

			await expect(
				service.completar(1, 'efectivo', 'user-1', '127.0.0.1', undefined, clientDate.toISOString()),
			).rejects.toThrow(ConflictException);
		});

		it('no lanza ConflictException con diferencia de tiempo menor a 1 segundo', async () => {
			const serverDate = new Date('2024-01-01T12:00:00.000Z');
			const clientDate = new Date('2024-01-01T12:00:00.500Z');
			const orden = {
				ordenId: 1,
				estadoOrden: 'pendiente',
				facturaId: 5,
				updatedAt: serverDate,
				fechaOrden: new Date(),
			};
			setupCompletar(orden);
			mockFacturaService.findByIdempotencyKey.mockResolvedValue(null);

			await expect(
				service.completar(1, 'efectivo', 'user-1', '127.0.0.1', undefined, clientDate.toISOString()),
			).resolves.toBeDefined();
		});

		it('lanza NotFoundException si la orden no existe', async () => {
			const oRepo = {findOne: jest.fn().mockResolvedValue(null)};
			mockRepo.manager.transaction.mockImplementation(async (cb: Function) =>
				cb({getRepository: jest.fn().mockReturnValue(oRepo)}),
			);

			await expect(service.completar(999, 'efectivo', 'user-1', '127.0.0.1')).rejects.toThrow(NotFoundException);
		});

		it('emite evento WebSocket después de completar', async () => {
			const orden = {
				ordenId: 1,
				estadoOrden: 'pendiente',
				facturaId: 5,
				updatedAt: new Date(),
				fechaOrden: new Date(),
			};
			setupCompletar(orden);

			await service.completar(1, 'efectivo', 'user-1', '127.0.0.1');

			expect(mockGateway.emitirOrdenActualizada).toHaveBeenCalled();
		});

		it('actualiza cierre del día después de completar', async () => {
			const orden = {
				ordenId: 1,
				estadoOrden: 'pendiente',
				facturaId: 5,
				updatedAt: new Date(),
				fechaOrden: new Date(),
			};
			setupCompletar(orden);

			await service.completar(1, 'efectivo', 'user-1', '127.0.0.1');

			expect(mockCierresService.updateCierreIfExists).toHaveBeenCalled();
		});
	});

	// ==================== update ====================

	describe('update', () => {
		const setupUpdate = (orden: any, despues?: any) => {
			const fullOrden = {...orden, fechaOrden: new Date()};
			// 1ª lectura: antes de actualizar. Si cambia el tipo de pedido, la relectura (2ª) trae el valor nuevo.
			const oRepo = {
				findOne: jest.fn().mockResolvedValueOnce(orden).mockResolvedValue(despues ? {...despues, fechaOrden: new Date()} : fullOrden),
				update: jest.fn().mockResolvedValue({affected: 1}),
			};
			const domiciliosRepo = {delete: jest.fn().mockResolvedValue({affected: 1})};
			mockRepo.manager.transaction.mockImplementation(async (cb: Function) =>
				cb({getRepository: jest.fn((entidad: any) => (entidad?.name === 'Domicilios' ? domiciliosRepo : oRepo))}),
			);
			return {oRepo, fullOrden, domiciliosRepo};
		};

		it('lanza BadRequestException si la factura ya está pagada', async () => {
			const orden = {ordenId: 1, tipoPedido: 'mesa', factura: {estado: 'pagada'}, fechaOrden: new Date()};
			setupUpdate(orden);

			await expect(service.update(1, {observaciones: 'nueva nota'})).rejects.toThrow(BadRequestException);
		});

		it('actualiza campos básicos de la orden', async () => {
			const orden = {ordenId: 1, tipoPedido: 'mesa', factura: {estado: 'pendiente'}, fechaOrden: new Date()};
			const {oRepo} = setupUpdate(orden);

			await service.update(1, {observaciones: 'sin cebolla'});

			expect(oRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({observaciones: 'sin cebolla'}));
		});

		describe('cambio de tipo de pedido (el tipo se relee DESPUÉS de actualizar)', () => {
			beforeEach(() => {
				mockDomicilioService.esDomicilio.mockImplementation((t?: string) => t === 'domicilio');
			});

			it('mesa → domicilio: se actualiza el domicilio y el envío entra al total', async () => {
				const antes = {ordenId: 1, facturaId: 9, tipoPedido: 'mesa', factura: {estado: 'pendiente'}, productos: [{precioUnitario: 20000, cantidad: 1}], domicilios: [{costoDomicilio: 5000}]};
				setupUpdate(antes, {...antes, tipoPedido: 'domicilio'});

				await service.update(1, {tipoPedido: 'domicilio', costoDomicilio: 5000} as any);

				expect(mockDomicilioService.updateDomicilioPorOrden).toHaveBeenCalled();
				expect(mockFacturaService.updateFactura).toHaveBeenCalledWith(9, expect.objectContaining({total: 25000}), expect.anything());
			});

			it('domicilio → mesa: se borra el domicilio y el envío sale del total', async () => {
				const antes = {ordenId: 1, facturaId: 9, tipoPedido: 'domicilio', factura: {estado: 'pendiente'}, productos: [{precioUnitario: 20000, cantidad: 1}], domicilios: [{costoDomicilio: 5000}]};
				const {domiciliosRepo} = setupUpdate(antes, {...antes, tipoPedido: 'mesa'});

				await service.update(1, {tipoPedido: 'mesa'} as any);

				expect(domiciliosRepo.delete).toHaveBeenCalledWith({ordenId: 1});
				expect(mockDomicilioService.updateDomicilioPorOrden).not.toHaveBeenCalled();
				expect(mockFacturaService.updateFactura).toHaveBeenCalledWith(9, expect.objectContaining({total: 20000}), expect.anything());
			});

			it('sin cambio de tipo no se toca el total si tampoco cambian los productos', async () => {
				const orden = {ordenId: 1, facturaId: 9, tipoPedido: 'mesa', factura: {estado: 'pendiente'}, productos: [], domicilios: []};
				setupUpdate(orden);

				await service.update(1, {observaciones: 'nota'});

				expect(mockFacturaService.updateFactura).not.toHaveBeenCalled();
			});
		});

		it('emite evento WebSocket después de actualizar', async () => {
			const orden = {ordenId: 1, tipoPedido: 'mesa', factura: {estado: 'pendiente'}, fechaOrden: new Date()};
			setupUpdate(orden);

			await service.update(1, {observaciones: 'nota'});

			expect(mockGateway.emitirOrdenActualizada).toHaveBeenCalled();
		});
	});
});
