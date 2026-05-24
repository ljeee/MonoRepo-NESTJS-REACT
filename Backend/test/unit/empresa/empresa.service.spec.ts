import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmpresaService } from '../../../src/empresa/empresa.service';
import { EmpresaConfig } from '../../../src/empresa/esquemas/empresa.entity';

describe('EmpresaService', () => {
	let service: EmpresaService;
	let mockRepo: any;

	beforeEach(async () => {
		mockRepo = {
			count: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			findOne: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EmpresaService,
				{ provide: getRepositoryToken(EmpresaConfig), useValue: mockRepo },
			],
		}).compile();

		service = module.get<EmpresaService>(EmpresaService);
	});

	// ==================== onModuleInit ====================

	describe('onModuleInit', () => {
		it('crea la configuración por defecto cuando la tabla está vacía', async () => {
			mockRepo.count.mockResolvedValue(0);
			const config = { nit: '1026147348', razonSocial: 'Dfiruexpo Pizzería S.A.S' };
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
			const config = { nit: '123', razonSocial: 'Empresa Test' };
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
			const existing = { nit: '123', razonSocial: 'Viejo' };
			const updated = { ...existing, razonSocial: 'Nuevo' };
			mockRepo.findOne.mockResolvedValue(existing);
			mockRepo.save.mockResolvedValue(updated);

			const result = await service.updateConfig({ razonSocial: 'Nuevo' } as any);

			expect(result).toEqual(updated);
			expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ razonSocial: 'Nuevo' }));
		});

		it('crea la configuración si no existe', async () => {
			mockRepo.findOne.mockResolvedValue(null);
			const dto = { nit: '999', razonSocial: 'Nueva Empresa' } as any;
			mockRepo.create.mockReturnValue(dto);
			mockRepo.save.mockResolvedValue({ ...dto });

			await service.updateConfig(dto);

			expect(mockRepo.create).toHaveBeenCalledWith(dto);
			expect(mockRepo.save).toHaveBeenCalled();
		});
	});
});
