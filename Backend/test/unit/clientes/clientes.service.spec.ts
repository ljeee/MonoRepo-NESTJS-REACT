import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ClientesService } from '../../../src/clientes/clientes.service';
import { Clientes } from '../../../src/clientes/esquemas/clientes.entity';
import { ClienteDirecciones } from '../../../src/clientes/esquemas/cliente-direcciones.entity';

describe('ClientesService', () => {
	let service: ClientesService;
	let mockRepo: any;
	let mockDireccionesRepo: any;

	beforeEach(async () => {
		mockRepo = {
			find: jest.fn(),
			findOne: jest.fn(),
			save: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		};
		mockDireccionesRepo = {
			find: jest.fn(),
			findOne: jest.fn(),
			save: jest.fn(),
			delete: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ClientesService,
				{ provide: getRepositoryToken(Clientes), useValue: mockRepo },
				{ provide: getRepositoryToken(ClienteDirecciones), useValue: mockDireccionesRepo },
			],
		}).compile();

		service = module.get<ClientesService>(ClientesService);
	});

	// ==================== findAll ====================

	describe('findAll', () => {
		it('retorna clientes con relaciones', async () => {
			const list = [{ telefono: '3001' }];
			mockRepo.find.mockResolvedValue(list);

			const result = await service.findAll();

			expect(result).toEqual(list);
			expect(mockRepo.find).toHaveBeenCalledWith(
				expect.objectContaining({ relations: ['direcciones', 'domicilios'] }),
			);
		});

		it('aplica paginación correctamente', async () => {
			mockRepo.find.mockResolvedValue([]);

			await service.findAll(2, 10);

			expect(mockRepo.find).toHaveBeenCalledWith(
				expect.objectContaining({ take: 10, skip: 10 }),
			);
		});
	});

	// ==================== findOne ====================

	describe('findOne', () => {
		it('retorna el cliente cuando existe', async () => {
			const cliente = { telefono: '3001234567', clienteNombre: 'Juan' };
			mockRepo.findOne.mockResolvedValue(cliente);

			const result = await service.findOne('3001234567');

			expect(result).toEqual(cliente);
		});

		it('lanza NotFoundException cuando no existe', async () => {
			mockRepo.findOne.mockResolvedValue(null);

			await expect(service.findOne('9999')).rejects.toThrow(NotFoundException);
		});
	});

	// ==================== create / update / remove ====================

	describe('create', () => {
		it('guarda y retorna el nuevo cliente', async () => {
			const data = { telefono: '3001234567', clienteNombre: 'Juan' } as any;
			mockRepo.save.mockResolvedValue(data);

			const result = await service.create(data);

			expect(result).toEqual(data);
		});
	});

	describe('update', () => {
		it('actualiza el cliente con los campos dados', async () => {
			mockRepo.update.mockResolvedValue({ affected: 1 });

			await service.update('3001234567', { clienteNombre: 'Pedro' } as any);

			expect(mockRepo.update).toHaveBeenCalledWith('3001234567', { clienteNombre: 'Pedro' });
		});
	});

	describe('remove', () => {
		it('elimina el cliente por teléfono', async () => {
			mockRepo.delete.mockResolvedValue({ affected: 1 });

			await service.remove('3001234567');

			expect(mockRepo.delete).toHaveBeenCalledWith('3001234567');
		});
	});

	// ==================== getDirecciones ====================

	describe('getDirecciones', () => {
		it('retorna las direcciones del cliente ordenadas por id DESC', async () => {
			const dirs = [{ id: 2, direccion: 'Calle 2' }, { id: 1, direccion: 'Calle 1' }];
			mockDireccionesRepo.find.mockResolvedValue(dirs);

			const result = await service.getDirecciones('3001234567');

			expect(result).toEqual(dirs);
			expect(mockDireccionesRepo.find).toHaveBeenCalledWith(
				expect.objectContaining({ where: { telefonoCliente: '3001234567' } }),
			);
		});
	});

	// ==================== addDireccion ====================

	describe('addDireccion', () => {
		it('retorna la dirección existente sin duplicar', async () => {
			const existe = { id: 1, direccion: 'Calle 10 #5-20' };
			mockDireccionesRepo.findOne.mockResolvedValue(existe);

			const result = await service.addDireccion('3001234567', { direccion: 'Calle 10 #5-20' });

			expect(result).toEqual(existe);
			expect(mockDireccionesRepo.save).not.toHaveBeenCalled();
		});

		it('guarda la dirección si no existe', async () => {
			mockDireccionesRepo.findOne.mockResolvedValue(null);
			const nueva = { id: 2, direccion: 'Calle 20' };
			mockDireccionesRepo.save.mockResolvedValue(nueva);

			const result = await service.addDireccion('3001234567', { direccion: '  Calle 20  ' });

			expect(result).toEqual(nueva);
			expect(mockDireccionesRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({ telefonoCliente: '3001234567', direccion: 'Calle 20' }),
			);
		});
	});

	// ==================== removeDireccion ====================

	describe('removeDireccion', () => {
		it('elimina la dirección por id', async () => {
			mockDireccionesRepo.delete.mockResolvedValue({ affected: 1 });

			await service.removeDireccion(5);

			expect(mockDireccionesRepo.delete).toHaveBeenCalledWith(5);
		});
	});
});
