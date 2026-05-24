import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { OrdenesProductosService } from '../../../src/ordenes-productos/ordenes-productos.service';
import { OrdenesProductos } from '../../../src/ordenes-productos/esquemas/ordenes-productos.entity';

describe('OrdenesProductosService', () => {
	let service: OrdenesProductosService;
	let mockRepo: any;

	beforeEach(async () => {
		mockRepo = {
			find: jest.fn(),
			findOne: jest.fn(),
			save: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				OrdenesProductosService,
				{ provide: getRepositoryToken(OrdenesProductos), useValue: mockRepo },
			],
		}).compile();

		service = module.get<OrdenesProductosService>(OrdenesProductosService);
	});

	describe('findAll', () => {
		it('retorna los productos de ordenes con relaciones', async () => {
			const list = [{ id: 1, producto: 'Pizza Grande' }];
			mockRepo.find.mockResolvedValue(list);

			const result = await service.findAll();

			expect(result).toEqual(list);
			expect(mockRepo.find).toHaveBeenCalledWith(
				expect.objectContaining({ relations: ['orden', 'productoObj'] }),
			);
		});

		it('aplica paginación correctamente', async () => {
			mockRepo.find.mockResolvedValue([]);

			await service.findAll(2, 50);

			expect(mockRepo.find).toHaveBeenCalledWith(
				expect.objectContaining({ take: 50, skip: 50 }),
			);
		});
	});

	describe('findOne', () => {
		it('retorna el registro cuando existe', async () => {
			const item = { id: 1, producto: 'Pizza' };
			mockRepo.findOne.mockResolvedValue(item);

			const result = await service.findOne(1);

			expect(result).toEqual(item);
		});

		it('lanza NotFoundException cuando no existe', async () => {
			mockRepo.findOne.mockResolvedValue(null);

			await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
		});
	});

	describe('create', () => {
		it('guarda y retorna el registro', async () => {
			const data = { ordenId: 1, producto: 'Pizza Grande', cantidad: 2 } as any;
			mockRepo.save.mockResolvedValue(data);

			const result = await service.create(data);

			expect(result).toEqual(data);
			expect(mockRepo.save).toHaveBeenCalledWith(data);
		});
	});

	describe('update', () => {
		it('actualiza el registro con los campos dados', async () => {
			mockRepo.update.mockResolvedValue({ affected: 1 });

			await service.update(1, { cantidad: 3 } as any);

			expect(mockRepo.update).toHaveBeenCalledWith(1, { cantidad: 3 });
		});
	});

	describe('remove', () => {
		it('elimina el registro por id', async () => {
			mockRepo.delete.mockResolvedValue({ affected: 1 });

			await service.remove(5);

			expect(mockRepo.delete).toHaveBeenCalledWith(5);
		});
	});
});
