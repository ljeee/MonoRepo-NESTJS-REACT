import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PizzaSaboresService } from '../../../src/pizza-sabores/pizza-sabores.service';
import { PizzaSabor } from '../../../src/pizza-sabores/esquemas/pizza-sabores.entity';

describe('PizzaSaboresService', () => {
	let service: PizzaSaboresService;
	let mockRepo: any;

	beforeEach(async () => {
		mockRepo = {
			count: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			find: jest.fn(),
			findOne: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PizzaSaboresService,
				{ provide: getRepositoryToken(PizzaSabor), useValue: mockRepo },
			],
		}).compile();

		service = module.get<PizzaSaboresService>(PizzaSaboresService);
	});

	// ==================== onModuleInit ====================

	describe('onModuleInit', () => {
		it('hace seed cuando la tabla está vacía', async () => {
			mockRepo.count.mockResolvedValue(0);
			mockRepo.create.mockImplementation((s: any) => s);
			mockRepo.save.mockResolvedValue([]);

			await service.onModuleInit();

			expect(mockRepo.save).toHaveBeenCalled();
			const saved = mockRepo.save.mock.calls[0][0];
			expect(saved.length).toBeGreaterThan(0);
		});

		it('no hace seed cuando ya hay sabores', async () => {
			mockRepo.count.mockResolvedValue(5);

			await service.onModuleInit();

			expect(mockRepo.save).not.toHaveBeenCalled();
		});
	});

	// ==================== findAll ====================

	describe('findAll', () => {
		it('retorna todos los sabores ordenados', async () => {
			const list = [{ saborId: 1, nombre: 'De Casa' }];
			mockRepo.find.mockResolvedValue(list);

			const result = await service.findAll();

			expect(result).toEqual(list);
			expect(mockRepo.find).toHaveBeenCalledWith(
				expect.objectContaining({ order: { tipo: 'ASC', nombre: 'ASC' } }),
			);
		});
	});

	// ==================== update ====================

	describe('update', () => {
		it('actualiza los campos provistos y retorna el sabor actualizado', async () => {
			const updated = { saborId: 1, nombre: 'Nuevo', recargoGrande: 2000 };
			mockRepo.update.mockResolvedValue({ affected: 1 });
			mockRepo.findOne.mockResolvedValue(updated);

			const result = await service.update(1, { nombre: 'Nuevo', recargoGrande: 2000 });

			expect(mockRepo.update).toHaveBeenCalledWith(
				1,
				expect.objectContaining({ nombre: 'Nuevo', recargoGrande: 2000 }),
			);
			expect(result).toEqual(updated);
		});

		it('no incluye campos que son undefined en el update', async () => {
			mockRepo.update.mockResolvedValue({ affected: 1 });
			mockRepo.findOne.mockResolvedValue({ saborId: 1 });

			await service.update(1, { activo: false });

			const updateArg = mockRepo.update.mock.calls[0][1];
			expect(updateArg).not.toHaveProperty('nombre');
			expect(updateArg.activo).toBe(false);
		});
	});

	// ==================== create ====================

	describe('create', () => {
		it('crea y guarda un nuevo sabor', async () => {
			const dto = { nombre: 'BBQ', tipo: 'especial', recargoPequena: 1000, recargoMediana: 2000, recargoGrande: 2000, activo: true } as any;
			mockRepo.create.mockReturnValue(dto);
			mockRepo.save.mockResolvedValue({ saborId: 5, ...dto });

			const result = await service.create(dto);

			expect(mockRepo.create).toHaveBeenCalledWith(dto);
			expect(result.saborId).toBe(5);
		});
	});

	// ==================== delete ====================

	describe('delete', () => {
		it('retorna deleted=true cuando el sabor fue eliminado', async () => {
			mockRepo.delete.mockResolvedValue({ affected: 1 });

			const result = await service.delete(1);

			expect(result).toEqual({ deleted: true });
		});

		it('retorna deleted=false cuando no se encontró el sabor', async () => {
			mockRepo.delete.mockResolvedValue({ affected: 0 });

			const result = await service.delete(99);

			expect(result).toEqual({ deleted: false });
		});
	});
});
