import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {NotFoundException} from '@nestjs/common';
import {DomiciliariosService} from '../../../src/domiciliarios/domiciliarios.service';
import {Domiciliarios} from '../../../src/domiciliarios/esquemas/domiciliarios.entity';

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
			providers: [DomiciliariosService, {provide: getRepositoryToken(Domiciliarios), useValue: mockRepo}],
		}).compile();

		service = module.get<DomiciliariosService>(DomiciliariosService);
	});

	describe('findAll', () => {
		it('devuelve la lista de domiciliarios con relaciones', async () => {
			const list = [{telefono: '3001'}, {telefono: '3002'}];
			mockRepo.find.mockResolvedValue(list);

			const result = await service.findAll();

			expect(result).toEqual(list);
			expect(mockRepo.find).toHaveBeenCalledWith(
				expect.objectContaining({relations: expect.arrayContaining(['domicilios'])}),
			);
		});

		it('aplica paginación correctamente', async () => {
			mockRepo.find.mockResolvedValue([]);

			await service.findAll(3, 50);

			expect(mockRepo.find).toHaveBeenCalledWith(expect.objectContaining({take: 50, skip: 100}));
		});
	});

	describe('actualizarUbicacion', () => {
		it('guarda la posición con la hora del GPS cuando es razonable', async () => {
			mockRepo.update.mockResolvedValue({affected: 1});
			const hace2min = Date.now() - 120_000;

			await service.actualizarUbicacion('3001234567', 6.2, -75.5, hace2min);

			const [, cambios] = mockRepo.update.mock.calls[0];
			expect(cambios.ultimaUbicacionFecha.getTime()).toBe(hace2min);
		});

		it('ignora una hora futura o de hace más de un día y usa la del servidor', async () => {
			mockRepo.update.mockResolvedValue({affected: 1});

			await service.actualizarUbicacion('3001234567', 6.2, -75.5, Date.now() + 3600_000);
			await service.actualizarUbicacion('3001234567', 6.2, -75.5, Date.now() - 3 * 24 * 3600_000);

			for (const [, cambios] of mockRepo.update.mock.calls) {
				expect(Math.abs(cambios.ultimaUbicacionFecha.getTime() - Date.now())).toBeLessThan(5000);
			}
		});

		it('responde 404 si no hay domiciliario con ese teléfono (no finge que guardó)', async () => {
			mockRepo.update.mockResolvedValue({affected: 0});

			await expect(service.actualizarUbicacion('3009999999', 6.2, -75.5)).rejects.toThrow(NotFoundException);
		});
	});

	describe('findOne', () => {
		it('retorna el domiciliario cuando existe', async () => {
			const dom = {telefono: '3001234567'};
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
			const data = {telefono: '3001234567', nombre: 'Carlos'} as any;
			mockRepo.save.mockResolvedValue(data);

			const result = await service.create(data);

			expect(result).toEqual(data);
			expect(mockRepo.save).toHaveBeenCalledWith(data);
		});
	});

	describe('update', () => {
		it('actualiza el domiciliario con los campos dados', async () => {
			mockRepo.update.mockResolvedValue({affected: 1});

			await service.update('3001234567', {nombre: 'Pedro'} as any);

			expect(mockRepo.update).toHaveBeenCalledWith('3001234567', {nombre: 'Pedro'});
		});
	});

	describe('remove', () => {
		it('elimina el domiciliario por teléfono', async () => {
			mockRepo.delete.mockResolvedValue({affected: 1});

			await service.remove('3001234567');

			expect(mockRepo.delete).toHaveBeenCalledWith('3001234567');
		});
	});
});
