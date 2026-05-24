import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FacturasPagosService } from '../../../src/facturas-pagos/facturas-pagos.service';
import { FacturasPagos } from '../../../src/facturas-pagos/esquemas/facturas-pagos.entity';
import { CajaMovimientosService } from '../../../src/caja-movimientos/caja-movimientos.service';

const makeQb = () => {
	const qb: any = {};
	['where', 'andWhere', 'orderBy', 'take', 'skip'].forEach(m => {
		qb[m] = jest.fn().mockReturnValue(qb);
	});
	qb.getMany = jest.fn();
	qb.getManyAndCount = jest.fn();
	return qb;
};

describe('FacturasPagosService', () => {
	let service: FacturasPagosService;
	let mockRepo: any;
	let qb: any;
	let mockCajaMovimientosService: any;

	beforeEach(async () => {
		qb = makeQb();
		mockRepo = {
			createQueryBuilder: jest.fn().mockReturnValue(qb),
			findOneBy: jest.fn(),
			save: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		};

		mockCajaMovimientosService = {
			registrarSalida: jest.fn().mockResolvedValue(undefined),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				FacturasPagosService,
				{ provide: getRepositoryToken(FacturasPagos), useValue: mockRepo },
				{ provide: CajaMovimientosService, useValue: mockCajaMovimientosService },
			],
		}).compile();

		service = module.get<FacturasPagosService>(FacturasPagosService);
	});

	// ==================== findAll ====================

	describe('findAll', () => {
		it('retorna datos paginados con from y to', async () => {
			const data = [{ pagosId: 1 }];
			qb.getManyAndCount.mockResolvedValue([data, 1]);

			const result = await service.findAll({ from: '2025-01-01', to: '2025-01-31', page: 1, limit: 50 });

			expect(result.data).toEqual(data);
			expect(result.total).toBe(1);
			expect(qb.where).toHaveBeenCalledWith(
				expect.stringContaining('BETWEEN'),
				expect.objectContaining({ from: '2025-01-01', to: '2025-01-31' }),
			);
		});

		it('filtra solo con from cuando falta to', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);

			await service.findAll({ from: '2025-01-01' });

			expect(qb.where).toHaveBeenCalledWith(
				expect.stringContaining('>='),
				expect.objectContaining({ from: '2025-01-01' }),
			);
		});

		it('filtra solo con to cuando falta from', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);

			await service.findAll({ to: '2025-01-31' });

			expect(qb.where).toHaveBeenCalledWith(
				expect.stringContaining('<='),
				expect.objectContaining({ to: '2025-01-31' }),
			);
		});

		it('no filtra cuando no hay from ni to', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);

			await service.findAll({});

			expect(qb.where).not.toHaveBeenCalled();
		});

		it('calcula totalPages correctamente', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 25]);

			const result = await service.findAll({ limit: 10 });

			expect(result.totalPages).toBe(3);
		});
	});

	// ==================== findByDay ====================

	describe('findByDay', () => {
		it('filtra pagos por la fecha de hoy', async () => {
			qb.getMany.mockResolvedValue([]);

			await service.findByDay();

			expect(qb.where).toHaveBeenCalledWith(
				expect.stringContaining('fechaFactura = :today'),
				expect.any(Object),
			);
		});
	});

	// ==================== findPendingByDay ====================

	describe('findPendingByDay', () => {
		it('filtra pagos pendientes del día', async () => {
			qb.getMany.mockResolvedValue([]);

			await service.findPendingByDay();

			expect(qb.where).toHaveBeenCalledWith(
				expect.stringContaining('estado = :pendiente'),
			);
		});
	});

	// ==================== findOne ====================

	describe('findOne', () => {
		it('retorna el pago cuando existe', async () => {
			const pago = { pagosId: 1, total: 50000 };
			mockRepo.findOneBy.mockResolvedValue(pago);

			const result = await service.findOne(1);

			expect(result).toEqual(pago);
		});

		it('lanza NotFoundException cuando no existe', async () => {
			mockRepo.findOneBy.mockResolvedValue(null);

			await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
		});
	});

	// ==================== create ====================

	describe('create', () => {
		it('guarda el pago con fechaFactura asignada automáticamente si no se provee', async () => {
			const data: any = { total: 50000 };
			mockRepo.save.mockResolvedValue({ pagosId: 1, ...data });

			await service.create(data);

			expect(data.fechaFactura).toBeDefined();
			expect(mockRepo.save).toHaveBeenCalledWith(data);
		});

		it('conserva fechaFactura si ya viene en los datos', async () => {
			const data: any = { total: 50000, fechaFactura: '2025-01-15' };
			mockRepo.save.mockResolvedValue(data);

			await service.create(data);

			expect(data.fechaFactura).toBe('2025-01-15');
		});
	});

	// ==================== update ====================

	describe('update', () => {
		it('actualiza el pago con los campos dados', async () => {
			mockRepo.update.mockResolvedValue({ affected: 1 });

			await service.update(1, { estado: 'pagado' } as any);

			expect(mockRepo.update).toHaveBeenCalledWith(1, { estado: 'pagado' });
		});
	});

	// ==================== remove ====================

	describe('remove', () => {
		it('elimina el pago por id', async () => {
			mockRepo.delete.mockResolvedValue({ affected: 1 });

			await service.remove(5);

			expect(mockRepo.delete).toHaveBeenCalledWith(5);
		});
	});
});
