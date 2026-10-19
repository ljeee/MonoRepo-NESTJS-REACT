import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {ConflictException, NotFoundException} from '@nestjs/common';
import {QueryFailedError} from 'typeorm';
import {SaborGruposService} from '../../../src/pizza-sabores/sabor-grupos.service';
import {SaborGruposController} from '../../../src/pizza-sabores/sabor-grupos.controller';
import {SaborGrupo} from '../../../src/pizza-sabores/esquemas/sabor-grupo.entity';
import {ROLES_KEY} from '../../../src/auth/decorators/roles.decorator';
import {IS_PUBLIC_KEY} from '../../../src/auth/decorators/public.decorator';
import {Role} from '../../../src/auth/roles.enum';

const errorDeBd = (code: string) => Object.assign(new QueryFailedError('q', [], new Error('x')), {code});

describe('SaborGruposService', () => {
	let service: SaborGruposService;
	let repo: any;

	beforeEach(async () => {
		repo = {
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn((g: any) => g),
			save: jest.fn((g: any) => Promise.resolve({id: 9, ...g})),
			update: jest.fn(),
			delete: jest.fn(),
			manager: {query: jest.fn()},
		};
		const module: TestingModule = await Test.createTestingModule({
			providers: [SaborGruposService, {provide: getRepositoryToken(SaborGrupo), useValue: repo}],
		}).compile();
		service = module.get(SaborGruposService);
	});

	it('findAll ordena por orden e id', async () => {
		repo.find.mockResolvedValue([]);
		await service.findAll();
		expect(repo.find).toHaveBeenCalledWith({order: {orden: 'ASC', id: 'ASC'}});
	});

	it('findOne lanza 404 si no existe', async () => {
		repo.findOne.mockResolvedValue(null);
		await expect(service.findOne(5)).rejects.toThrow(NotFoundException);
	});

	it('create recorta el nombre', async () => {
		const r = await service.create({nombre: '  Hamburguesa ', maxSabores: 1} as any);
		expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({nombre: 'Hamburguesa'}));
		expect(r.id).toBe(9);
	});

	it('create con nombre repetido → 409', async () => {
		repo.save.mockRejectedValue(errorDeBd('23505'));
		await expect(service.create({nombre: 'Pizza'} as any)).rejects.toThrow(ConflictException);
	});

	it('update con nombre repetido → 409', async () => {
		repo.findOne.mockResolvedValue({id: 1});
		repo.update.mockRejectedValue(errorDeBd('23505'));
		await expect(service.update(1, {nombre: 'Calzone'})).rejects.toThrow(ConflictException);
	});

	it('update aplica los cambios recortando el nombre', async () => {
		repo.findOne.mockResolvedValue({id: 1, nombre: 'Pizza'});
		await service.update(1, {nombre: ' Pizza XL ', maxSabores: 4});
		expect(repo.update).toHaveBeenCalledWith(1, {nombre: 'Pizza XL', maxSabores: 4});
	});

	describe('remove', () => {
		it('rechaza borrar un grupo con sabores o productos', async () => {
			repo.findOne.mockResolvedValue({id: 1});
			repo.manager.query.mockResolvedValue([{sabores: 12, productos: 1}]);
			await expect(service.remove(1)).rejects.toThrow(ConflictException);
			expect(repo.delete).not.toHaveBeenCalled();
		});

		it('borra un grupo vacío', async () => {
			repo.findOne.mockResolvedValue({id: 1});
			repo.manager.query.mockResolvedValue([{sabores: 0, productos: 0}]);
			await expect(service.remove(1)).resolves.toEqual({deleted: true});
			expect(repo.delete).toHaveBeenCalledWith(1);
		});
	});
});

describe('SaborGruposController (permisos)', () => {
	const proto = SaborGruposController.prototype;

	it('la lista es pública (ClientWeb la necesita)', () => {
		expect(Reflect.getMetadata(IS_PUBLIC_KEY, proto.findAll)).toBe(true);
	});

	it.each(['create', 'update', 'remove'] as const)('%s es solo para admin', (metodo) => {
		expect(Reflect.getMetadata(ROLES_KEY, proto[metodo])).toEqual([Role.Admin]);
	});
});
