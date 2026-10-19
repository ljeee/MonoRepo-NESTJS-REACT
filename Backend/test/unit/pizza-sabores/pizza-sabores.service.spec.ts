import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {BadRequestException, ConflictException} from '@nestjs/common';
import {QueryFailedError} from 'typeorm';
import {PizzaSaboresService} from '../../../src/pizza-sabores/pizza-sabores.service';
import {PizzaSabor} from '../../../src/pizza-sabores/esquemas/pizza-sabores.entity';
import {SaborGrupo} from '../../../src/pizza-sabores/esquemas/sabor-grupo.entity';

const errorDeBd = (code: string) => Object.assign(new QueryFailedError('q', [], new Error('x')), {code});

describe('PizzaSaboresService', () => {
	let service: PizzaSaboresService;
	let mockRepo: any;
	let mockGrupos: any;
	let qb: any;

	beforeEach(async () => {
		qb = {
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			orderBy: jest.fn().mockReturnThis(),
			addOrderBy: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue([]),
		};
		mockRepo = {
			count: jest.fn(),
			create: jest.fn((s: any) => s),
			save: jest.fn(),
			findOne: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			createQueryBuilder: jest.fn(() => qb),
		};
		mockGrupos = {
			findOne: jest.fn(),
			create: jest.fn((g: any) => g),
			save: jest.fn((g: any) => Promise.resolve({id: g.nombre === 'Pizza' ? 1 : 2, ...g})),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PizzaSaboresService,
				{provide: getRepositoryToken(PizzaSabor), useValue: mockRepo},
				{provide: getRepositoryToken(SaborGrupo), useValue: mockGrupos},
			],
		}).compile();

		service = module.get<PizzaSaboresService>(PizzaSaboresService);
	});

	describe('onModuleInit', () => {
		it('instalación nueva: crea los grupos Pizza y Calzone y los sabores de pizza con su grupo', async () => {
			mockRepo.count.mockResolvedValue(0);
			mockGrupos.findOne.mockImplementation(({where}: any) => Promise.resolve(where.nombre === 'Pizza' ? {id: 1, nombre: 'Pizza'} : null));
			mockRepo.save.mockResolvedValue([]);

			await service.onModuleInit();

			const gruposCreados = mockGrupos.save.mock.calls.map((c: any[]) => c[0].nombre);
			expect(gruposCreados).toEqual(['Calzone']); // Pizza ya existía
			const sabores = mockRepo.save.mock.calls[0][0];
			expect(sabores.length).toBeGreaterThan(10);
			expect(sabores.every((s: any) => s.grupoId === 1)).toBe(true);
			// Sin etiquetas tradicional/especial: el recargo es del propio sabor.
			expect(sabores.find((s: any) => s.nombre === 'Paisa')).toEqual(
				expect.objectContaining({recargoPequena: 1000, recargoMediana: 2000, recargoGrande: 2000}),
			);
			expect(sabores.find((s: any) => s.nombre === 'Carnes')).toEqual(expect.objectContaining({recargoGrande: 0}));
			expect(sabores.some((s: any) => s.nombre === 'RECARGO_3_SABORES')).toBe(false);
		});

		it('no hace nada cuando ya hay sabores', async () => {
			mockRepo.count.mockResolvedValue(5);

			await service.onModuleInit();

			expect(mockRepo.save).not.toHaveBeenCalled();
			expect(mockGrupos.save).not.toHaveBeenCalled();
		});
	});

	describe('findAll', () => {
		it('excluye la fila de configuración heredada y ordena por grupo y nombre', async () => {
			const lista = [{saborId: 1, nombre: 'De Casa'}];
			qb.getMany.mockResolvedValue(lista);

			await expect(service.findAll()).resolves.toEqual(lista);

			expect(qb.where).toHaveBeenCalledWith("s.tipo IS DISTINCT FROM 'configuracion'");
			expect(qb.addOrderBy).toHaveBeenCalledWith('s.nombre', 'ASC');
			expect(qb.andWhere).not.toHaveBeenCalled();
		});

		it('con grupoId limita a los sabores de ese grupo', async () => {
			await service.findAll(2);

			expect(qb.andWhere).toHaveBeenCalledWith('s.grupoId = :grupoId', {grupoId: 2});
		});
	});

	describe('update', () => {
		it('actualiza los campos provistos (incluido el grupo) y retorna el sabor', async () => {
			const updated = {saborId: 1, nombre: 'Nuevo', recargoGrande: 2000};
			mockRepo.update.mockResolvedValue({affected: 1});
			mockRepo.findOne.mockResolvedValue(updated);

			const result = await service.update(1, {nombre: ' Nuevo ', recargoGrande: 2000, grupoId: 2});

			expect(mockRepo.update).toHaveBeenCalledWith(1, {nombre: 'Nuevo', recargoGrande: 2000, grupoId: 2});
			expect(result).toEqual(updated);
		});

		it('ignora el tipo heredado y los campos undefined', async () => {
			mockRepo.update.mockResolvedValue({affected: 1});
			mockRepo.findOne.mockResolvedValue({saborId: 1});

			await service.update(1, {activo: false, tipo: 'especial'});

			const arg = mockRepo.update.mock.calls[0][1];
			expect(arg).toEqual({activo: false});
		});

		it('nombre repetido en el grupo → 409', async () => {
			mockRepo.update.mockRejectedValue(errorDeBd('23505'));

			await expect(service.update(1, {nombre: 'Paisa'})).rejects.toThrow(ConflictException);
		});

		it('grupo inexistente → 400', async () => {
			mockRepo.update.mockRejectedValue(errorDeBd('23503'));

			await expect(service.update(1, {grupoId: 999})).rejects.toThrow(BadRequestException);
		});
	});

	describe('create', () => {
		it('crea el sabor en su grupo; sin recargos cobra 0', async () => {
			mockRepo.save.mockImplementation((s: any) => Promise.resolve({saborId: 5, ...s}));

			const result = await service.create({nombre: ' Pollo BBQ ', grupoId: 1});

			expect(mockRepo.create).toHaveBeenCalledWith({
				nombre: 'Pollo BBQ',
				grupoId: 1,
				recargoPequena: 0,
				recargoMediana: 0,
				recargoGrande: 0,
				activo: true,
			});
			expect(result.saborId).toBe(5);
		});

		it('guarda los recargos que se envían', async () => {
			mockRepo.save.mockImplementation((s: any) => Promise.resolve({saborId: 6, ...s}));

			await service.create({nombre: 'Quesuda', grupoId: 1, recargoPequena: 2000, recargoMediana: 3000, recargoGrande: 3000});

			expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({recargoPequena: 2000, recargoGrande: 3000}));
		});

		it('mismo nombre en el mismo grupo → 409; en otro grupo se permite (índice por grupo y nombre)', async () => {
			mockRepo.save.mockRejectedValue(errorDeBd('23505'));

			await expect(service.create({nombre: 'Paisa', grupoId: 1})).rejects.toThrow(ConflictException);
		});
	});

	describe('delete', () => {
		it('retorna deleted=true cuando el sabor fue eliminado', async () => {
			mockRepo.delete.mockResolvedValue({affected: 1});

			await expect(service.delete(1)).resolves.toEqual({deleted: true});
		});

		it('retorna deleted=false cuando no se encontró el sabor', async () => {
			mockRepo.delete.mockResolvedValue({affected: 0});

			await expect(service.delete(99)).resolves.toEqual({deleted: false});
		});
	});
});
