import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DomiciliariosService } from '../../../src/domiciliarios/domiciliarios.service';
import { Domiciliarios } from '../../../src/domiciliarios/esquemas/domiciliarios.entity';

describe('DomiciliariosService', () => {
	let service: DomiciliariosService;
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
				DomiciliariosService,
				{ provide: getRepositoryToken(Domiciliarios), useValue: mockRepo },
			],
		}).compile();

		service = module.get<DomiciliariosService>(DomiciliariosService);
	});

	describe('findAll', () => {
		it('devuelve la lista de domiciliarios con relaciones', async () => {
			const list = [{ telefono: '3001' }, { telefono: '3002' }];
			mockRepo.find.mockResolvedValue(list);

			const result = await service.findAll();

			expect(result).toEqual(list);
			expect(mockRepo.find).toHaveBeenCalledWith(
				expect.objectContaining({ relations: ['domicilios'] }),
			);
		});

		it('aplica paginación correctamente', async () => {
			mockRepo.find.mockResolvedValue([]);

			await service.findAll(3, 50);

			expect(mockRepo.find).toHaveBeenCalledWith(
				expect.objectContaining({ take: 50, skip: 100 }),
			);
		});
	});

	describe('findOne', () => {
		it('retorna el domiciliario cuando existe', async () => {
			const dom = { telefono: '3001234567' };
			mockRepo.findOne.mockResolvedValue(dom);

			const result = await service.findOne('3001234567');

			expect(result).toEqual(dom);
		});

		it('lanza NotFoundException cuando no existe', async () => {
			mockRepo.findOne.mockResolvedValue(null);

			await expect(service.findOne('9999')).rejects.toThrow(NotFoundException);
		});
	});

	describe('create', () => {
		it('guarda y retorna el nuevo domiciliario', async () => {
			const data = { telefono: '3001234567', nombre: 'Carlos' } as any;
			mockRepo.save.mockResolvedValue(data);

			const result = await service.create(data);

			expect(result).toEqual(data);
			expect(mockRepo.save).toHaveBeenCalledWith(data);
		});
	});

	describe('update', () => {
		it('actualiza el domiciliario con los campos dados', async () => {
			mockRepo.update.mockResolvedValue({ affected: 1 });

			await service.update('3001234567', { nombre: 'Pedro' } as any);

			expect(mockRepo.update).toHaveBeenCalledWith('3001234567', { nombre: 'Pedro' });
		});
	});

	describe('remove', () => {
		it('elimina el domiciliario por teléfono', async () => {
			mockRepo.delete.mockResolvedValue({ affected: 1 });

			await service.remove('3001234567');

			expect(mockRepo.delete).toHaveBeenCalledWith('3001234567');
		});
	});
});
