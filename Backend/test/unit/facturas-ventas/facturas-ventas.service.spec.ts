import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FacturasVentasService } from '../../../src/facturas-ventas/facturas-ventas.service';
import { FacturasVentas } from '../../../src/facturas-ventas/esquemas/facturas-ventas.entity';
import { CajaMovimientosService } from '../../../src/caja-movimientos/caja-movimientos.service';

const makeQb = () => ({
	leftJoinAndSelect: jest.fn().mockReturnThis(),
	orderBy: jest.fn().mockReturnThis(),
	take: jest.fn().mockReturnThis(),
	skip: jest.fn().mockReturnThis(),
	where: jest.fn().mockReturnThis(),
	andWhere: jest.fn().mockReturnThis(),
	getCount: jest.fn().mockResolvedValue(0),
	getMany: jest.fn().mockResolvedValue([]),
});

describe('FacturasVentasService', () => {
	let service: FacturasVentasService;
	let qb: ReturnType<typeof makeQb>;
	let mockRepo: any;
	let mockCajaMovimientosService: any;

	beforeEach(async () => {
		qb = makeQb();

		mockRepo = {
			createQueryBuilder: jest.fn(() => qb),
			findOne: jest.fn(),
			save: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			manager: { transaction: jest.fn() },
		};

		mockCajaMovimientosService = {
			registrarEntrada: jest.fn().mockResolvedValue(undefined),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				FacturasVentasService,
				{ provide: getRepositoryToken(FacturasVentas), useValue: mockRepo },
				{ provide: CajaMovimientosService, useValue: mockCajaMovimientosService },
			],
		}).compile();

		service = module.get<FacturasVentasService>(FacturasVentasService);
	});

	// ==================== findAll ====================

	describe('findAll', () => {
		it('retorna lista paginada con valores por defecto', async () => {
			const facturas = [{ facturaId: 1, total: 30000, estado: 'pagada' }];
			qb.getCount.mockResolvedValue(1);
			qb.getMany.mockResolvedValue(facturas);

			const result = await service.findAll({});

			expect(result.data).toEqual(facturas);
			expect(result.total).toBe(1);
			expect(result.page).toBe(1);
			expect(result.limit).toBe(50);
			expect(result.totalPages).toBe(1);
		});

		it('aplica filtro de rango de fechas completo', async () => {
			qb.getCount.mockResolvedValue(0);
			qb.getMany.mockResolvedValue([]);

			await service.findAll({ from: '2024-01-01', to: '2024-01-31' });

			expect(qb.where).toHaveBeenCalledWith(
				'f.fechaFactura BETWEEN :from AND :to',
				expect.objectContaining({ from: expect.any(Date), to: expect.any(Date) }),
			);
		});

		it('aplica filtro solo desde cuando to está ausente', async () => {
			qb.getCount.mockResolvedValue(0);
			qb.getMany.mockResolvedValue([]);

			await service.findAll({ from: '2024-01-01' });

			expect(qb.where).toHaveBeenCalledWith('f.fechaFactura >= :from', expect.any(Object));
		});

		it('aplica filtro solo hasta cuando from está ausente', async () => {
			qb.getCount.mockResolvedValue(0);
			qb.getMany.mockResolvedValue([]);

			await service.findAll({ to: '2024-01-31' });

			expect(qb.where).toHaveBeenCalledWith('f.fechaFactura <= :to', expect.any(Object));
		});

		it('calcula totalPages correctamente', async () => {
			qb.getCount.mockResolvedValue(100);
			qb.getMany.mockResolvedValue(Array(10).fill({}));

			const result = await service.findAll({ limit: 10 });

			expect(result.totalPages).toBe(10);
		});

		it('aplica paginación con take y skip', async () => {
			qb.getCount.mockResolvedValue(0);
			qb.getMany.mockResolvedValue([]);

			await service.findAll({ page: 3, limit: 15 });

			expect(qb.take).toHaveBeenCalledWith(15);
			expect(qb.skip).toHaveBeenCalledWith(30);
		});
	});

	// ==================== findByDay ====================

	describe('findByDay', () => {
		it('retorna las facturas del día actual', async () => {
			const facturas = [{ facturaId: 1 }, { facturaId: 2 }];
			qb.getMany.mockResolvedValue(facturas);

			const result = await service.findByDay();

			expect(result).toEqual(facturas);
			expect(qb.where).toHaveBeenCalledWith(
				'f.fechaFactura BETWEEN :start AND :end',
				expect.objectContaining({ start: expect.any(Date), end: expect.any(Date) }),
			);
		});
	});

	// ==================== getDayStats ====================

	describe('getDayStats', () => {
		it('calcula correctamente los totales del día', async () => {
			const facturas = [
				{ facturaId: 1, total: 30000, estado: 'pagada' },
				{ facturaId: 2, total: 20000, estado: 'pagada' },
				{ facturaId: 3, total: 15000, estado: 'pendiente' },
			];
			qb.getMany.mockResolvedValue(facturas);

			const result = await service.getDayStats();

			expect(result.totalDia).toBe(65000);
			expect(result.totalPagado).toBe(50000);
			expect(result.totalPendiente).toBe(15000);
			expect(result.count).toBe(3);
		});

		it('excluye facturas canceladas de la consulta', async () => {
			qb.getMany.mockResolvedValue([]);

			await service.getDayStats();

			expect(qb.andWhere).toHaveBeenCalledWith('f.estado != :cancelado', { cancelado: 'cancelado' });
		});

		it('retorna ceros cuando no hay facturas en el día', async () => {
			qb.getMany.mockResolvedValue([]);

			const result = await service.getDayStats();

			expect(result.totalDia).toBe(0);
			expect(result.totalPagado).toBe(0);
			expect(result.totalPendiente).toBe(0);
			expect(result.count).toBe(0);
		});

		it('maneja totales con valor null o undefined sin error', async () => {
			const facturas = [
				{ facturaId: 1, total: null, estado: 'pagada' },
				{ facturaId: 2, total: undefined, estado: 'pendiente' },
			];
			qb.getMany.mockResolvedValue(facturas);

			const result = await service.getDayStats();

			expect(result.totalDia).toBe(0);
			expect(isNaN(result.totalDia)).toBe(false);
		});
	});

	// ==================== findOne ====================

	describe('findOne', () => {
		it('retorna la factura cuando existe', async () => {
			const factura = { facturaId: 1, total: 30000, estado: 'pagada' };
			mockRepo.findOne.mockResolvedValue(factura);

			const result = await service.findOne(1);

			expect(result).toEqual(factura);
			expect(mockRepo.findOne).toHaveBeenCalledWith(
				expect.objectContaining({ where: { facturaId: 1 } }),
			);
		});

		it('lanza NotFoundException cuando la factura no existe', async () => {
			mockRepo.findOne.mockResolvedValue(null);

			await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
		});
	});

	// ==================== create ====================

	describe('create', () => {
		it('guarda y retorna la factura creada', async () => {
			const dto = { clienteNombre: 'Juan', total: 50000, idempotencyKey: 'key-1' };
			const saved = { facturaId: 1, ...dto };
			mockRepo.save.mockResolvedValue(saved);

			const result = await service.create(dto as any);

			expect(result).toEqual(saved);
			expect(mockRepo.save).toHaveBeenCalledWith(dto);
		});
	});

	// ==================== update ====================

	describe('update', () => {
		it('hace simple update cuando el estado NO es pagada', async () => {
			mockRepo.update.mockResolvedValue({ affected: 1 });

			await service.update(1, { clienteNombre: 'Pedro' });

			expect(mockRepo.update).toHaveBeenCalledWith(1, { clienteNombre: 'Pedro' });
		});

		it('usa transacción cuando el estado cambia a pagada', async () => {
			const updateQb = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({}),
			};
			const facturasRepo = {
				update: jest.fn().mockResolvedValue({ affected: 1 }),
				findOne: jest.fn().mockResolvedValue({ facturaId: 1, estado: 'pagada' }),
			};
			const ordenesRepo = {
				createQueryBuilder: jest.fn(() => updateQb),
			};
			mockRepo.manager.transaction.mockImplementation(async (cb: Function) =>
				cb({
					getRepository: jest.fn()
						.mockReturnValueOnce(facturasRepo)
						.mockReturnValueOnce(ordenesRepo),
				}),
			);

			const result = await service.update(1, { estado: 'pagada', metodo: 'efectivo' });

			expect(facturasRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ estado: 'pagada' }));
			expect(updateQb.execute).toHaveBeenCalled();
			expect(result).toEqual({ facturaId: 1, estado: 'pagada' });
		});

		it('marca las ordenes como completadas al pagar la factura', async () => {
			const updateQb = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({}),
			};
			const facturasRepo = {
				update: jest.fn().mockResolvedValue({}),
				findOne: jest.fn().mockResolvedValue({ facturaId: 1 }),
			};
			const ordenesRepo = { createQueryBuilder: jest.fn(() => updateQb) };
			mockRepo.manager.transaction.mockImplementation(async (cb: Function) =>
				cb({ getRepository: jest.fn().mockReturnValueOnce(facturasRepo).mockReturnValueOnce(ordenesRepo) }),
			);

			await service.update(1, { estado: 'pagada' });

			expect(updateQb.set).toHaveBeenCalledWith({ estadoOrden: 'completada' });
		});
	});

	// ==================== remove ====================

	describe('remove', () => {
		it('elimina la factura por ID', async () => {
			mockRepo.delete.mockResolvedValue({ affected: 1 });

			await service.remove(1);

			expect(mockRepo.delete).toHaveBeenCalledWith(1);
		});
	});
});
