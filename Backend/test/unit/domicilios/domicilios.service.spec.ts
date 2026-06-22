import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {NotFoundException} from '@nestjs/common';
import {DomiciliosService} from '../../../src/domicilios/domicilios.service';
import {Domicilios} from '../../../src/domicilios/esquemas/domicilios.entity';

const makeQb = () => {
	const qb: any = {};
	['leftJoinAndSelect', 'where', 'andWhere', 'orderBy', 'take', 'skip'].forEach((m) => {
		qb[m] = jest.fn().mockReturnValue(qb);
	});
	qb.getMany = jest.fn();
	return qb;
};

describe('DomiciliosService', () => {
	let service: DomiciliosService;
	let mockRepo: any;
	let qb: any;

	beforeEach(async () => {
		qb = makeQb();
		mockRepo = {
			createQueryBuilder: jest.fn().mockReturnValue(qb),
			findOne: jest.fn(),
			save: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [DomiciliosService, {provide: getRepositoryToken(Domicilios), useValue: mockRepo}],
		}).compile();

		service = module.get<DomiciliosService>(DomiciliosService);
	});

	// ==================== findAll ====================

	describe('findAll', () => {
		it('retorna la lista paginada de domicilios', async () => {
			const list = [{domicilioId: 1}, {domicilioId: 2}];
			qb.getMany.mockResolvedValue(list);

			const result = await service.findAll();

			expect(result).toEqual(list);
			expect(qb.orderBy).toHaveBeenCalledWith('d.fechaCreado', 'DESC');
		});

		it('aplica paginación correctamente', async () => {
			qb.getMany.mockResolvedValue([]);

			await service.findAll(3, 20);

			expect(qb.take).toHaveBeenCalledWith(20);
			expect(qb.skip).toHaveBeenCalledWith(40);
		});
	});

	// ==================== findByDay ====================

	describe('findByDay', () => {
		it('filtra por fecha de hoy', async () => {
			qb.getMany.mockResolvedValue([]);

			await service.findByDay();

			expect(qb.where).toHaveBeenCalledWith(
				expect.stringContaining('BETWEEN'),
				expect.objectContaining({start: expect.any(Date), end: expect.any(Date)}),
			);
		});
	});

	// ==================== findSinAsignarHoy ====================

	describe('findSinAsignarHoy', () => {
		it('filtra domicilios sin domiciliario asignado hoy', async () => {
			qb.getMany.mockResolvedValue([]);

			await service.findSinAsignarHoy();

			expect(qb.where).toHaveBeenCalledWith(
				expect.stringContaining('telefonoDomiciliarioAsignado IS NULL'),
				expect.any(Object),
			);
			expect(qb.andWhere).toHaveBeenCalledWith(
				expect.stringContaining('estadoDomicilio NOT IN'),
				expect.objectContaining({excluir: ['cancelado', 'entregado']}),
			);
		});
	});

	// ==================== findPendingByDay ====================

	describe('findPendingByDay', () => {
		it('filtra domicilios pendientes del día', async () => {
			qb.getMany.mockResolvedValue([]);

			await service.findPendingByDay();

			expect(qb.where).toHaveBeenCalledWith(expect.stringContaining('estadoDomicilio = :pendiente'));
		});
	});

	// ==================== findByUser ====================

	describe('findByUser', () => {
		it('filtra por teléfono del domiciliario con rango del día', async () => {
			qb.getMany.mockResolvedValue([]);

			await service.findByUser('3001234567');

			expect(qb.where).toHaveBeenCalledWith(
				expect.stringContaining('telefonoDomiciliarioAsignado = :telefono'),
				expect.objectContaining({telefono: '3001234567'}),
			);
			expect(qb.andWhere).toHaveBeenCalled();
		});

		it('no filtra por fecha cuando all=true', async () => {
			qb.getMany.mockResolvedValue([]);

			await service.findByUser('3001234567', true);

			expect(qb.andWhere).not.toHaveBeenCalled();
		});
	});

	// ==================== findOne ====================

	describe('findOne', () => {
		it('retorna el domicilio cuando existe', async () => {
			const dom = {domicilioId: 1};
			mockRepo.findOne.mockResolvedValue(dom);

			const result = await service.findOne(1);

			expect(result).toEqual(dom);
		});

		it('lanza NotFoundException cuando no existe', async () => {
			mockRepo.findOne.mockResolvedValue(null);

			await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
		});
	});

	// ==================== create / update / remove ====================

	describe('create', () => {
		it('guarda y retorna el domicilio', async () => {
			const data = {telefono: '3001234567', direccionEntrega: 'Calle 10'} as any;
			mockRepo.save.mockResolvedValue(data);

			const result = await service.create(data);

			expect(result).toEqual(data);
		});
	});

	describe('update', () => {
		it('actualiza el domicilio con los campos dados', async () => {
			mockRepo.update.mockResolvedValue({affected: 1});

			await service.update(1, {estadoDomicilio: 'entregado'} as any);

			expect(mockRepo.update).toHaveBeenCalledWith(1, {estadoDomicilio: 'entregado'});
		});
	});

	describe('remove', () => {
		it('elimina el domicilio por id', async () => {
			mockRepo.delete.mockResolvedValue({affected: 1});

			await service.remove(3);

			expect(mockRepo.delete).toHaveBeenCalledWith(3);
		});
	});
});
