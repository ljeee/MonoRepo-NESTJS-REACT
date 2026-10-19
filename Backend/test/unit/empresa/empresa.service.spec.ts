import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {BadRequestException, ConflictException, NotFoundException} from '@nestjs/common';
import {EmpresaService} from '../../../src/empresa/empresa.service';
import {EmpresaConfig} from '../../../src/empresa/esquemas/empresa.entity';
import {CuentaTransferencia} from '../../../src/empresa/esquemas/cuenta-transferencia.entity';

describe('EmpresaService', () => {
	let service: EmpresaService;
	let mockRepo: any;
	let mockCuentaRepo: any;
	let txManager: any;

	beforeEach(async () => {
		mockRepo = {
			count: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			findOne: jest.fn(),
		};

		mockCuentaRepo = {
			find: jest.fn().mockResolvedValue([]),
			count: jest.fn().mockResolvedValue(0),
			create: jest.fn().mockImplementation((dto) => dto),
			save: jest.fn().mockImplementation((dto) => Promise.resolve({id: 1, ...dto})),
			findOne: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			manager: {query: jest.fn().mockResolvedValue([{n: 0}]), transaction: jest.fn()},
		};
		txManager = {
			getRepository: jest.fn().mockReturnValue(mockCuentaRepo),
			query: jest.fn().mockResolvedValue([]),
		};
		mockCuentaRepo.manager.transaction.mockImplementation(async (cb: Function) => cb(txManager));

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EmpresaService,
				{provide: getRepositoryToken(EmpresaConfig), useValue: mockRepo},
				{provide: getRepositoryToken(CuentaTransferencia), useValue: mockCuentaRepo},
			],
		}).compile();

		service = module.get<EmpresaService>(EmpresaService);
	});

	// ==================== onModuleInit ====================

	describe('onModuleInit', () => {
		it('crea la configuración por defecto cuando la tabla está vacía', async () => {
			mockRepo.count.mockResolvedValue(0);
			const config = {nit: '1026147348', razonSocial: 'Dfiruexpo Pizzería S.A.S'};
			mockRepo.create.mockReturnValue(config);
			mockRepo.save.mockResolvedValue(config);

			await service.onModuleInit();

			expect(mockRepo.save).toHaveBeenCalled();
		});

		it('no crea nada cuando ya existe la configuración', async () => {
			mockRepo.count.mockResolvedValue(1);

			await service.onModuleInit();

			expect(mockRepo.save).not.toHaveBeenCalled();
		});
	});

	// ==================== getConfig ====================

	describe('getConfig', () => {
		it('retorna la configuración existente', async () => {
			const config = {nit: '123', razonSocial: 'Empresa Test'};
			mockRepo.findOne.mockResolvedValue(config);

			const result = await service.getConfig();

			expect(result).toEqual(config);
		});

		it('retorna null cuando no existe configuración', async () => {
			mockRepo.findOne.mockResolvedValue(null);

			const result = await service.getConfig();

			expect(result).toBeNull();
		});
	});

	// ==================== updateConfig ====================

	describe('updateConfig', () => {
		it('actualiza la configuración existente', async () => {
			const existing = {nit: '123', razonSocial: 'Viejo'};
			const updated = {...existing, razonSocial: 'Nuevo'};
			mockRepo.findOne.mockResolvedValue(existing);
			mockRepo.save.mockResolvedValue(updated);

			const result = await service.updateConfig({razonSocial: 'Nuevo'} as any);

			expect(result).toEqual(updated);
			expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({razonSocial: 'Nuevo'}));
		});

		it('crea la configuración si no existe', async () => {
			mockRepo.findOne.mockResolvedValue(null);
			const dto = {nit: '999', razonSocial: 'Nueva Empresa'} as any;
			mockRepo.create.mockReturnValue(dto);
			mockRepo.save.mockResolvedValue({...dto});

			await service.updateConfig(dto);

			expect(mockRepo.create).toHaveBeenCalledWith(dto);
			expect(mockRepo.save).toHaveBeenCalled();
		});
	});

	// ==================== arqueo opcional ====================

	describe('updateConfig — arqueoCaja', () => {
		it('al volver a encender el arqueo marca el momento (obliga a contar de nuevo)', async () => {
			const config: any = {id: 1, arqueoCaja: false, arqueoDesde: null};
			mockRepo.findOne.mockResolvedValue(config);
			mockRepo.save.mockImplementation((c: any) => Promise.resolve(c));

			const antes = Date.now();
			const r: any = await service.updateConfig({arqueoCaja: true});

			expect(r.arqueoCaja).toBe(true);
			expect(r.arqueoDesde).toBeInstanceOf(Date);
			expect(r.arqueoDesde.getTime()).toBeGreaterThanOrEqual(antes);
		});

		it('apagarlo no cambia el momento', async () => {
			const desde = new Date('2026-10-01T10:00:00Z');
			mockRepo.findOne.mockResolvedValue({id: 1, arqueoCaja: true, arqueoDesde: desde});
			mockRepo.save.mockImplementation((c: any) => Promise.resolve(c));

			const r: any = await service.updateConfig({arqueoCaja: false});

			expect(r.arqueoCaja).toBe(false);
			expect(r.arqueoDesde).toBe(desde);
		});

		it('guardar "encendido" estando ya encendido no reinicia el momento', async () => {
			const desde = new Date('2026-10-01T10:00:00Z');
			mockRepo.findOne.mockResolvedValue({id: 1, arqueoCaja: true, arqueoDesde: desde});
			mockRepo.save.mockImplementation((c: any) => Promise.resolve(c));

			const r: any = await service.updateConfig({arqueoCaja: true, nombreComercial: 'Dfiru'});

			expect(r.arqueoDesde).toBe(desde);
		});

		it('editar otros datos del negocio no toca el arqueo', async () => {
			mockRepo.findOne.mockResolvedValue({id: 1, arqueoCaja: false, arqueoDesde: null});
			mockRepo.save.mockImplementation((c: any) => Promise.resolve(c));

			const r: any = await service.updateConfig({nombreComercial: 'Otro nombre'});

			expect(r.arqueoCaja).toBe(false);
			expect(r.arqueoDesde).toBeNull();
		});
	});
	// ==================== cuentas de transferencia ====================

	describe('cuentas de transferencia', () => {
		beforeEach(() => {
			mockCuentaRepo.find.mockResolvedValue([
				{id: 1, nombre: 'Nequi', activa: true},
				{id: 2, nombre: 'Bancolombia', activa: true},
			]);
		});

		it('no permite crear dos cuentas con el mismo nombre (sin importar mayúsculas)', async () => {
			await expect(service.crearCuentaTransferencia('  nequi ')).rejects.toThrow(ConflictException);
			await expect(service.crearCuentaTransferencia('   ')).rejects.toThrow(BadRequestException);
		});

		it('crea la cuenta con el nombre limpio', async () => {
			await service.crearCuentaTransferencia('  Daviplata ');

			expect(mockCuentaRepo.create).toHaveBeenCalledWith({nombre: 'Daviplata', activa: true});
		});

		it('renombrar una cuenta propaga el nombre a sus facturas', async () => {
			mockCuentaRepo.findOne.mockResolvedValue({id: 1, nombre: 'Nequi', activa: true});

			await service.actualizarCuentaTransferencia(1, {nombre: 'Nequi Jeferson'});

			expect(txManager.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE facturas_ventas'), [
				'Nequi Jeferson',
				1,
			]);
		});

		it('desactivarla (sin renombrar) no toca las facturas', async () => {
			mockCuentaRepo.findOne.mockResolvedValue({id: 1, nombre: 'Nequi', activa: true});

			const r = await service.actualizarCuentaTransferencia(1, {activa: false});

			expect(r.activa).toBe(false);
			expect(txManager.query).not.toHaveBeenCalled();
		});

		it('renombrar a un nombre que ya usa otra cuenta se rechaza', async () => {
			mockCuentaRepo.findOne.mockResolvedValue({id: 1, nombre: 'Nequi', activa: true});

			await expect(service.actualizarCuentaTransferencia(1, {nombre: 'bancolombia'})).rejects.toThrow(
				ConflictException,
			);
		});

		it('cuenta inexistente → NotFound', async () => {
			mockCuentaRepo.findOne.mockResolvedValue(null);

			await expect(service.actualizarCuentaTransferencia(9, {activa: false})).rejects.toThrow(NotFoundException);
		});

		it('no se elimina una cuenta con facturas: hay que desactivarla', async () => {
			mockCuentaRepo.manager.query.mockResolvedValue([{n: 12}]);

			await expect(service.eliminarCuentaTransferencia(1)).rejects.toThrow(ConflictException);
			expect(mockCuentaRepo.delete).not.toHaveBeenCalled();
		});

		it('una cuenta sin facturas sí se elimina', async () => {
			mockCuentaRepo.manager.query.mockResolvedValue([{n: 0}]);

			await service.eliminarCuentaTransferencia(2);

			expect(mockCuentaRepo.delete).toHaveBeenCalledWith(2);
		});
	});
});
