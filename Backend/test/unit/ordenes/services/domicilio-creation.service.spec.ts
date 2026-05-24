import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DomicilioCreationService } from '../../../../src/ordenes/services/domicilio-creation.service';
import { Clientes } from '../../../../src/clientes/esquemas/clientes.entity';
import { ClienteDirecciones } from '../../../../src/clientes/esquemas/cliente-direcciones.entity';
import { Domiciliarios } from '../../../../src/domiciliarios/esquemas/domiciliarios.entity';
import { Domicilios } from '../../../../src/domicilios/esquemas/domicilios.entity';

describe('DomicilioCreationService', () => {
	let service: DomicilioCreationService;
	let mockClientesRepo: any;
	let mockDireccionesRepo: any;
	let mockDomiciliariosRepo: any;
	let mockDomiciliosRepo: any;

	beforeEach(async () => {
		mockClientesRepo = { findOne: jest.fn(), save: jest.fn() };
		mockDireccionesRepo = { findOne: jest.fn(), save: jest.fn() };
		mockDomiciliariosRepo = { findOne: jest.fn(), save: jest.fn() };
		mockDomiciliosRepo = { findOne: jest.fn(), save: jest.fn(), create: jest.fn(), update: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DomicilioCreationService,
				{ provide: getRepositoryToken(Clientes), useValue: mockClientesRepo },
				{ provide: getRepositoryToken(ClienteDirecciones), useValue: mockDireccionesRepo },
				{ provide: getRepositoryToken(Domiciliarios), useValue: mockDomiciliariosRepo },
				{ provide: getRepositoryToken(Domicilios), useValue: mockDomiciliosRepo },
			],
		}).compile();

		service = module.get<DomicilioCreationService>(DomicilioCreationService);
	});

	// ==================== esDomicilio ====================

	describe('esDomicilio', () => {
		it('retorna true cuando tipoPedido es domicilio', () => {
			expect(service.esDomicilio('domicilio')).toBe(true);
		});

		it('retorna false cuando tipoPedido es mesa', () => {
			expect(service.esDomicilio('mesa')).toBe(false);
		});

		it('retorna false cuando tipoPedido es undefined', () => {
			expect(service.esDomicilio(undefined)).toBe(false);
		});
	});

	// ==================== upsertCliente ====================

	describe('upsertCliente', () => {
		it('crea un nuevo cliente si no existe', async () => {
			mockClientesRepo.findOne.mockResolvedValue(null);
			mockClientesRepo.save.mockResolvedValue({ telefono: '3001234567' });
			mockDireccionesRepo.findOne.mockResolvedValue(null);
			mockDireccionesRepo.save.mockResolvedValue({});

			await service.upsertCliente('3001234567', 'Juan', 'Calle 10');

			expect(mockClientesRepo.save).toHaveBeenCalled();
		});

		it('retorna el cliente existente sin guardarlo de nuevo', async () => {
			const clienteExistente = { telefono: '3001234567', clienteNombre: 'Juan' };
			mockClientesRepo.findOne.mockResolvedValue(clienteExistente);
			mockDireccionesRepo.findOne.mockResolvedValue({ id: 1 }); // dirección ya existe

			const result = await service.upsertCliente('3001234567', 'Juan', 'Calle 10');

			expect(result).toEqual(clienteExistente);
			expect(mockClientesRepo.save).not.toHaveBeenCalled();
		});

		it('guarda una nueva dirección si no existe', async () => {
			mockClientesRepo.findOne.mockResolvedValue({ telefono: '3001234567' });
			mockDireccionesRepo.findOne.mockResolvedValue(null);
			mockDireccionesRepo.save.mockResolvedValue({});

			await service.upsertCliente('3001234567', 'Juan', 'Calle 10 #5-20');

			expect(mockDireccionesRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({ telefonoCliente: '3001234567', direccion: 'Calle 10 #5-20' }),
			);
		});

		it('no guarda dirección si está vacía', async () => {
			mockClientesRepo.findOne.mockResolvedValue({ telefono: '3001234567' });

			await service.upsertCliente('3001234567', 'Juan', '   ');

			expect(mockDireccionesRepo.save).not.toHaveBeenCalled();
		});
	});

	// ==================== upsertDomiciliario ====================

	describe('upsertDomiciliario', () => {
		it('retorna el domiciliario existente', async () => {
			const dom = { telefono: '3111111111' };
			mockDomiciliariosRepo.findOne.mockResolvedValue(dom);

			const result = await service.upsertDomiciliario('3111111111');

			expect(result).toEqual(dom);
			expect(mockDomiciliariosRepo.save).not.toHaveBeenCalled();
		});

		it('crea un nuevo domiciliario si no existe', async () => {
			mockDomiciliariosRepo.findOne.mockResolvedValue(null);
			mockDomiciliariosRepo.save.mockResolvedValue({ telefono: '3111111111' });

			await service.upsertDomiciliario('3111111111');

			expect(mockDomiciliariosRepo.save).toHaveBeenCalled();
		});
	});

	// ==================== crearDomicilio ====================

	describe('crearDomicilio', () => {
		it('crea y guarda el domicilio con todos los datos', async () => {
			const domCreado = { domicilioId: 1, facturaId: 10, ordenId: 5 };
			mockDomiciliosRepo.create.mockReturnValue(domCreado);
			mockDomiciliosRepo.save.mockResolvedValue(domCreado);

			const result = await service.crearDomicilio(10, 5, '3001234567', '3111111111', 'Calle 10', 5000);

			expect(mockDomiciliosRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					facturaId: 10,
					ordenId: 5,
					telefono: '3001234567',
					costoDomicilio: 5000,
				}),
			);
			expect(result).toEqual(domCreado);
		});

		it('usa costo 0 cuando no se provee costoDomicilio', async () => {
			mockDomiciliosRepo.create.mockReturnValue({});
			mockDomiciliosRepo.save.mockResolvedValue({});

			await service.crearDomicilio(1, 1, '3001234567', undefined, undefined);

			expect(mockDomiciliosRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({ costoDomicilio: 0 }),
			);
		});
	});

	// ==================== validarDatosDomicilio ====================

	describe('validarDatosDomicilio', () => {
		it('lanza BadRequestException si falta telefonoCliente', () => {
			expect(() =>
				service.validarDatosDomicilio({ tipoPedido: 'domicilio' } as any),
			).toThrow(BadRequestException);
		});

		it('no lanza excepción cuando telefonoCliente está presente', () => {
			expect(() =>
				service.validarDatosDomicilio({ tipoPedido: 'domicilio', telefonoCliente: '3001234567' } as any),
			).not.toThrow();
		});
	});

	// ==================== procesarDomicilio ====================

	describe('procesarDomicilio', () => {
		it('procesa un domicilio completo', async () => {
			mockClientesRepo.findOne.mockResolvedValue({ telefono: '3001234567' });
			mockDireccionesRepo.findOne.mockResolvedValue({ id: 1 });
			mockDomiciliariosRepo.findOne.mockResolvedValue({ telefono: '3111111111' });
			mockDomiciliosRepo.create.mockReturnValue({});
			mockDomiciliosRepo.save.mockResolvedValue({ domicilioId: 1 });

			const data = {
				tipoPedido: 'domicilio',
				telefonoCliente: '3001234567',
				nombreCliente: 'Juan',
				direccionCliente: 'Calle 10',
				telefonoDomiciliario: '3111111111',
				costoDomicilio: 5000,
			};

			await service.procesarDomicilio(data as any, 1, 1);

			expect(mockDomiciliosRepo.save).toHaveBeenCalled();
		});

		it('lanza BadRequestException si falta telefonoCliente', async () => {
			await expect(
				service.procesarDomicilio({ tipoPedido: 'domicilio' } as any, 1, 1),
			).rejects.toThrow(BadRequestException);
		});
	});

	// ==================== updateDomicilioPorOrden ====================

	describe('updateDomicilioPorOrden', () => {
		it('actualiza los datos del domicilio existente', async () => {
			const domExistente = { domicilioId: 7, ordenId: 1, telefono: '300', direccionEntrega: 'Calle 1' };
			mockDomiciliosRepo.findOne.mockResolvedValue(domExistente);
			mockDomiciliosRepo.update.mockResolvedValue({});
			mockClientesRepo.findOne.mockResolvedValue({ telefono: '300' });
			mockDireccionesRepo.findOne.mockResolvedValue({ id: 1 });

			await service.updateDomicilioPorOrden(1, { direccionCliente: 'Calle 2' });

			expect(mockDomiciliosRepo.update).toHaveBeenCalledWith(
				7,
				expect.objectContaining({ direccionEntrega: 'Calle 2' }),
			);
		});

		it('no actualiza si no hay cambios', async () => {
			const domExistente = { domicilioId: 7, ordenId: 1 };
			mockDomiciliosRepo.findOne.mockResolvedValue(domExistente);

			await service.updateDomicilioPorOrden(1, {});

			expect(mockDomiciliosRepo.update).not.toHaveBeenCalled();
		});

		it('no hace nada si no existe el domicilio y no hay datos suficientes', async () => {
			mockDomiciliosRepo.findOne.mockResolvedValue(null);

			await service.updateDomicilioPorOrden(1, {});

			expect(mockDomiciliosRepo.save).not.toHaveBeenCalled();
		});
	});
});
