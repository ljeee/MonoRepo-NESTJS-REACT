import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OrdenesService } from '../../../src/ordenes/ordenes.service';
import { Ordenes } from '../../../src/ordenes/esquemas/ordenes.entity';
import { OrdenesGateway } from '../../../src/ordenes/ordenes.gateway';
import { FacturaCreationService } from '../../../src/ordenes/services/factura-creation.service';
import { DomicilioCreationService } from '../../../src/ordenes/services/domicilio-creation.service';
import { ProductProcessingService } from '../../../src/ordenes/services/product-processing.service';
import { CierresService } from '../../../src/cierres/cierres.service';
import { InventarioCajasService } from '../../../src/inventario-cajas/inventario-cajas.service';
import { CajaMovimientosService } from '../../../src/caja-movimientos/caja-movimientos.service';

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
	let mockInventarioService: any;
	let mockCajaMovimientosService: any;

	beforeEach(async () => {
		qb = makeQb();

		mockRepo = {
			createQueryBuilder: jest.fn(() => qb),
			findOne: jest.fn(),
			save: jest.fn(),
			delete: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			manager: { transaction: jest.fn() },
		};

		mockGateway = {
			emitirNuevaOrden: jest.fn(),
			emitirOrdenActualizada: jest.fn(),
		};

		mockFacturaService = {
			generarDescripcionFactura: jest.fn().mockReturnValue('1 pizza grande paisa'),
			crearFactura: jest.fn().mockResolvedValue({ facturaId: 1, total: 0 }),
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
			procesarProductos: jest.fn().mockResolvedValue({ total: 50000 }),
			eliminarProductosDeOrden: jest.fn().mockResolvedValue(undefined),
			construirNombreProducto: jest.fn().mockReturnValue('pizza grande paisa'),
		};

		mockCierresService = {
			updateCierreIfExists: jest.fn().mockResolvedValue(undefined),
		};

		mockInventarioService = {
			descontarCajasParaOrden: jest.fn().mockResolvedValue(undefined),
		};

		mockCajaMovimientosService = {
			registrarEntrada: jest.fn().mockResolvedValue(undefined),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				OrdenesService,
				{ provide: getRepositoryToken(Ordenes), useValue: mockRepo },
				{ provide: OrdenesGateway, useValue: mockGateway },
				{ provide: FacturaCreationService, useValue: mockFacturaService },
				{ provide: DomicilioCreationService, useValue: mockDomicilioService },
				{ provide: ProductProcessingService, useValue: mockProductService },
				{ provide: CierresService, useValue: mockCierresService },
				{ provide: InventarioCajasService, useValue: mockInventarioService },
				{ provide: CajaMovimientosService, useValue: mockCajaMovimientosService },
			],
		}).compile();

		service = module.get<OrdenesService>(OrdenesService);
	});

	// ==================== findAll ====================

	describe('findAll', () => {
		it('retorna lista paginada con valores por defecto', async () => {
			const orden = { ordenId: 1, estadoOrden: 'pendiente', fechaOrden: new Date() };
			qb.getManyAndCount.mockResolvedValue([[orden], 1]);

			const result = await service.findAll({});

			expect(result).toEqual({ data: [orden], total: 1, page: 1, limit: 50, totalPages: 1 });
		});

		it('aplica filtro de estado', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);
			await service.findAll({ estado: 'pendiente' });
			expect(qb.andWhere).toHaveBeenCalledWith('o.estadoOrden = :estado', { estado: 'pendiente' });
		});

		it('aplica filtro de rango de fechas completo', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);
			await service.findAll({ from: '2024-01-01', to: '2024-01-31' });
			expect(qb.andWhere).toHaveBeenCalledWith(
				'o.fechaOrden BETWEEN :from AND :to',
				expect.objectContaining({ from: expect.any(Date), to: expect.any(Date) }),
			);
		});

		it('aplica filtro solo desde when to está ausente', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);
			await service.findAll({ from: '2024-01-01' });
			expect(qb.andWhere).toHaveBeenCalledWith('o.fechaOrden >= :from', expect.any(Object));
		});

		it('aplica filtro solo hasta when from está ausente', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);
			await service.findAll({ to: '2024-01-31' });
			expect(qb.andWhere).toHaveBeenCalledWith('o.fechaOrden <= :to', expect.any(Object));
		});

		it('calcula totalPages correctamente con múltiples páginas', async () => {
			qb.getManyAndCount.mockResolvedValue([Array(10).fill({}), 25]);
			const result = await service.findAll({ limit: 10 });
			expect(result.totalPages).toBe(3);
		});

		it('respeta page y limit personalizados', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);
			await service.findAll({ page: 2, limit: 20 });
			expect(qb.take).toHaveBeenCalledWith(20);
			expect(qb.skip).toHaveBeenCalledWith(20);
		});
	});

	// ==================== findOne ====================

	describe('findOne', () => {
		it('retorna la orden cuando existe', async () => {
			const orden = { ordenId: 1, estadoOrden: 'pendiente' };
			mockRepo.findOne.mockResolvedValue(orden);

			const result = await service.findOne(1);

			expect(result).toEqual(orden);
			expect(mockRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { ordenId: 1 } }));
		});

		it('lanza NotFoundException cuando la orden no existe', async () => {
			mockRepo.findOne.mockResolvedValue(null);
			await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
		});
	});

	// ==================== findByDay ====================

	describe('findByDay', () => {
		it('retorna las ordenes del día actual', async () => {
			const ordenes = [{ ordenId: 1 }, { ordenId: 2 }];
			qb.getMany.mockResolvedValue(ordenes);

			const result = await service.findByDay();

			expect(result).toEqual(ordenes);
			expect(qb.where).toHaveBeenCalledWith(
				'o.fechaOrden BETWEEN :start AND :end',
				expect.objectContaining({ start: expect.any(Date), end: expect.any(Date) }),
			);
		});

		it('aplica filtro de estado cuando se provee', async () => {
			qb.getMany.mockResolvedValue([]);
			await service.findByDay('pendiente');
			expect(qb.andWhere).toHaveBeenCalledWith('o.estadoOrden = :estado', { estado: 'pendiente' });
		});
	});

	// ==================== remove ====================

	describe('remove', () => {
		it('elimina la orden cuando la factura no está pagada', async () => {
			mockRepo.findOne.mockResolvedValue({ ordenId: 1, factura: { estado: 'pendiente' } });
			mockRepo.delete.mockResolvedValue({ affected: 1 });

			await service.remove(1);

			expect(mockRepo.delete).toHaveBeenCalledWith(1);
		});

		it('lanza BadRequestException cuando la factura está pagada', async () => {
			mockRepo.findOne.mockResolvedValue({ ordenId: 1, factura: { estado: 'pagada' } });

			await expect(service.remove(1)).rejects.toThrow(BadRequestException);
			expect(mockRepo.delete).not.toHaveBeenCalled();
		});

		it('elimina la orden aunque no tenga factura asociada', async () => {
			mockRepo.findOne.mockResolvedValue({ ordenId: 1, factura: null });
			mockRepo.delete.mockResolvedValue({ affected: 1 });

			await service.remove(1);

			expect(mockRepo.delete).toHaveBeenCalledWith(1);
		});
	});

	// ==================== cancel ====================

	describe('cancel', () => {
		const setupCancel = (orden: any) => {
			const fullOrden = { ...orden, estadoOrden: 'cancelado', fechaOrden: new Date() };
			const oRepo = {
				findOne: jest.fn()
					.mockResolvedValueOnce(orden)
					.mockResolvedValueOnce(fullOrden),
				save: jest.fn().mockResolvedValue(undefined),
			};
			mockRepo.manager.transaction.mockImplementation(async (cb: Function) =>
				cb({ getRepository: jest.fn().mockReturnValue(oRepo) }),
			);
			return { oRepo, fullOrden };
		};

		it('cancela correctamente una orden en estado pendiente', async () => {
			const orden = { ordenId: 1, estadoOrden: 'pendiente', facturaId: 5, observaciones: null, fechaOrden: new Date() };
			const { oRepo } = setupCancel(orden);

			await service.cancel(1, 'cliente pidió cancelar', 'user-1');

			const saved = oRepo.save.mock.calls[0][0];
			expect(saved.estadoOrden).toBe('cancelado');
			expect(mockFacturaService.cancelarFactura).toHaveBeenCalledWith(5, expect.anything());
			expect(mockGateway.emitirOrdenActualizada).toHaveBeenCalled();
		});

		it('cancela correctamente una orden en estado preparacion', async () => {
			const orden = { ordenId: 1, estadoOrden: 'preparacion', facturaId: 5, observaciones: null, fechaOrden: new Date() };
			const { oRepo } = setupCancel(orden);

			await service.cancel(1, '', 'user-1');

			expect(oRepo.save).toHaveBeenCalled();
		});

		it('agrega la razón a las observaciones existentes', async () => {
			const orden = { ordenId: 1, estadoOrden: 'pendiente', facturaId: 5, observaciones: 'sin cebolla', fechaOrden: new Date() };
			const { oRepo } = setupCancel(orden);

			await service.cancel(1, 'mal pedido', 'user-1');

			const saved = oRepo.save.mock.calls[0][0];
			expect(saved.observaciones).toContain('sin cebolla');
			expect(saved.observaciones).toContain('mal pedido');
		});

		it('guarda el userId del usuario que cancela', async () => {
			const orden = { ordenId: 1, estadoOrden: 'pendiente', facturaId: 5, observaciones: null, fechaOrden: new Date() };
			const { oRepo } = setupCancel(orden);

			await service.cancel(1, '', 'user-abc');

			const saved = oRepo.save.mock.calls[0][0];
			expect(saved.usuarioCancelacionId).toBe('user-abc');
		});

		it('lanza BadRequestException si la orden ya está completada', async () => {
			const orden = { ordenId: 1, estadoOrden: 'completada', facturaId: 5 };
			setupCancel(orden);

			await expect(service.cancel(1, 'razón', 'user-1')).rejects.toThrow(BadRequestException);
		});

		it('lanza NotFoundException si la orden no existe', async () => {
			const oRepo = { findOne: jest.fn().mockResolvedValue(null) };
			mockRepo.manager.transaction.mockImplementation(async (cb: Function) =>
				cb({ getRepository: jest.fn().mockReturnValue(oRepo) }),
			);

			await expect(service.cancel(999, 'razón', 'user-1')).rejects.toThrow(NotFoundException);
		});

		it('actualiza cierre del día después de cancelar', async () => {
			const orden = { ordenId: 1, estadoOrden: 'pendiente', facturaId: 5, fechaOrden: new Date() };
			setupCancel(orden);

			await service.cancel(1, '', 'user-1');

			expect(mockCierresService.updateCierreIfExists).toHaveBeenCalled();
		});
	});

	// ==================== completar ====================

	describe('completar', () => {
		const setupCompletar = (orden: any) => {
			const fullOrden = { ...orden, estadoOrden: 'completada', fechaOrden: new Date() };
			const oRepo = {
				findOne: jest.fn()
					.mockResolvedValueOnce(orden)
					.mockResolvedValueOnce(fullOrden),
				save: jest.fn().mockResolvedValue(undefined),
			};
			mockRepo.manager.transaction.mockImplementation(async (cb: Function) =>
				cb({ getRepository: jest.fn().mockReturnValue(oRepo) }),
			);
			return { oRepo, fullOrden };
		};

		it('completa la orden y actualiza la factura', async () => {
			const orden = { ordenId: 1, estadoOrden: 'pendiente', facturaId: 5, updatedAt: new Date(), fechaOrden: new Date() };
			const { oRepo } = setupCompletar(orden);

			await service.completar(1, 'efectivo', 'user-1', '127.0.0.1');

			expect(mockFacturaService.updateFactura).toHaveBeenCalledWith(
				5,
				expect.objectContaining({ metodo: 'efectivo', estado: 'pagada' }),
				expect.anything(),
			);
			const saved = oRepo.save.mock.calls[0][0];
			expect(saved.estadoOrden).toBe('completada');
		});

		it('guarda userId e IP en la factura al completar', async () => {
			const orden = { ordenId: 1, estadoOrden: 'pendiente', facturaId: 5, updatedAt: new Date(), fechaOrden: new Date() };
			setupCompletar(orden);

			await service.completar(1, 'transferencia', 'user-cajero', '192.168.1.1');

			expect(mockFacturaService.updateFactura).toHaveBeenCalledWith(
				5,
				expect.objectContaining({ usuarioCobroId: 'user-cajero', ipDispositivo: '192.168.1.1' }),
				expect.anything(),
			);
		});

		it('retorna la orden existente si la idempotencyKey ya fue procesada', async () => {
			const orden = { ordenId: 1, estadoOrden: 'completada', facturaId: 5, updatedAt: new Date() };
			setupCompletar(orden);
			mockFacturaService.findByIdempotencyKey.mockResolvedValue({ facturaId: 5 });
			mockRepo.findOne.mockResolvedValue({ ...orden, fechaOrden: new Date() });

			await service.completar(1, 'efectivo', 'user-1', '127.0.0.1', 'key-duplicada');

			expect(mockFacturaService.updateFactura).not.toHaveBeenCalled();
		});

		it('lanza ConflictException por modificación concurrente (>1s de diferencia)', async () => {
			const serverDate = new Date('2024-01-01T12:00:00.000Z');
			const clientDate = new Date('2024-01-01T11:00:00.000Z');
			const orden = { ordenId: 1, estadoOrden: 'pendiente', facturaId: 5, updatedAt: serverDate };
			setupCompletar(orden);

			await expect(
				service.completar(1, 'efectivo', 'user-1', '127.0.0.1', undefined, clientDate.toISOString()),
			).rejects.toThrow(ConflictException);
		});

		it('no lanza ConflictException con diferencia de tiempo menor a 1 segundo', async () => {
			const serverDate = new Date('2024-01-01T12:00:00.000Z');
			const clientDate = new Date('2024-01-01T12:00:00.500Z');
			const orden = { ordenId: 1, estadoOrden: 'pendiente', facturaId: 5, updatedAt: serverDate, fechaOrden: new Date() };
			setupCompletar(orden);
			mockFacturaService.findByIdempotencyKey.mockResolvedValue(null);

			await expect(
				service.completar(1, 'efectivo', 'user-1', '127.0.0.1', undefined, clientDate.toISOString()),
			).resolves.toBeDefined();
		});

		it('lanza NotFoundException si la orden no existe', async () => {
			const oRepo = { findOne: jest.fn().mockResolvedValue(null) };
			mockRepo.manager.transaction.mockImplementation(async (cb: Function) =>
				cb({ getRepository: jest.fn().mockReturnValue(oRepo) }),
			);

			await expect(service.completar(999, 'efectivo', 'user-1', '127.0.0.1')).rejects.toThrow(NotFoundException);
		});

		it('emite evento WebSocket después de completar', async () => {
			const orden = { ordenId: 1, estadoOrden: 'pendiente', facturaId: 5, updatedAt: new Date(), fechaOrden: new Date() };
			setupCompletar(orden);

			await service.completar(1, 'efectivo', 'user-1', '127.0.0.1');

			expect(mockGateway.emitirOrdenActualizada).toHaveBeenCalled();
		});

		it('actualiza cierre del día después de completar', async () => {
			const orden = { ordenId: 1, estadoOrden: 'pendiente', facturaId: 5, updatedAt: new Date(), fechaOrden: new Date() };
			setupCompletar(orden);

			await service.completar(1, 'efectivo', 'user-1', '127.0.0.1');

			expect(mockCierresService.updateCierreIfExists).toHaveBeenCalled();
		});
	});

	// ==================== update ====================

	describe('update', () => {
		const setupUpdate = (orden: any) => {
			const fullOrden = { ...orden, fechaOrden: new Date() };
			const oRepo = {
				findOne: jest.fn()
					.mockResolvedValueOnce(orden)
					.mockResolvedValueOnce(fullOrden),
				update: jest.fn().mockResolvedValue({ affected: 1 }),
			};
			mockRepo.manager.transaction.mockImplementation(async (cb: Function) =>
				cb({ getRepository: jest.fn().mockReturnValue(oRepo) }),
			);
			return { oRepo, fullOrden };
		};

		it('lanza BadRequestException si la factura ya está pagada', async () => {
			const orden = { ordenId: 1, tipoPedido: 'mesa', factura: { estado: 'pagada' }, fechaOrden: new Date() };
			setupUpdate(orden);

			await expect(service.update(1, { observaciones: 'nueva nota' })).rejects.toThrow(BadRequestException);
		});

		it('actualiza campos básicos de la orden', async () => {
			const orden = { ordenId: 1, tipoPedido: 'mesa', factura: { estado: 'pendiente' }, fechaOrden: new Date() };
			const { oRepo } = setupUpdate(orden);

			await service.update(1, { observaciones: 'sin cebolla' });

			expect(oRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ observaciones: 'sin cebolla' }));
		});

		it('emite evento WebSocket después de actualizar', async () => {
			const orden = { ordenId: 1, tipoPedido: 'mesa', factura: { estado: 'pendiente' }, fechaOrden: new Date() };
			setupUpdate(orden);

			await service.update(1, { observaciones: 'nota' });

			expect(mockGateway.emitirOrdenActualizada).toHaveBeenCalled();
		});
	});
});
