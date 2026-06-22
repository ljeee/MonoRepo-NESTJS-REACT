import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {BadRequestException} from '@nestjs/common';
import {CierresService} from '../../../src/cierres/cierres.service';
import {CierreCaja} from '../../../src/cierres/esquemas/cierre.entity';
import {EstadisticasService} from '../../../src/estadisticas/estadisticas.service';
import {MailService} from '../../../src/common/services/mail.service';
import {ConfigService} from '@nestjs/config';
import {EmpresaService} from '../../../src/empresa/empresa.service';

describe('CierresService', () => {
	let service: CierresService;
	let mockRepo: any;
	let mockStatsService: any;
	let mockMailService: any;
	let mockConfig: any;
	let mockEmpresaService: any;

	beforeEach(async () => {
		mockRepo = {
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			find: jest.fn(),
			delete: jest.fn(),
		};
		mockStatsService = {
			resumenPeriodo: jest.fn().mockResolvedValue({
				totalVentas: 100000,
				totalEgresos: 0,
				balanceNeto: 100000,
				facturas: 5,
				ordenes: 4,
				cancelados: 1,
				ticketPromedio: 20000,
			}),
			metodosPago: jest.fn().mockResolvedValue([{metodo: 'efectivo', total: 100000}]),
			productosTop: jest.fn().mockResolvedValue([{producto: 'Pizza', totalVendido: 3}]),
			facturasDetalle: jest.fn().mockResolvedValue([]),
		};
		mockMailService = {sendCierreReport: jest.fn().mockResolvedValue(undefined)};
		mockConfig = {get: jest.fn().mockReturnValue('test@example.com')};
		mockEmpresaService = {getConfig: jest.fn().mockResolvedValue({razonSocial: 'Test'})};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CierresService,
				{provide: getRepositoryToken(CierreCaja), useValue: mockRepo},
				{provide: EstadisticasService, useValue: mockStatsService},
				{provide: MailService, useValue: mockMailService},
				{provide: ConfigService, useValue: mockConfig},
				{provide: EmpresaService, useValue: mockEmpresaService},
			],
		}).compile();

		service = module.get<CierresService>(CierresService);
	});

	// ==================== generalCierre ====================

	describe('generalCierre', () => {
		it('crea un nuevo cierre cuando no existe', async () => {
			mockRepo.findOne.mockResolvedValue(null);
			const cierre = {cierreId: 1, fecha: '2025-01-01', totalVentas: 100000};
			mockRepo.create.mockReturnValue(cierre);
			mockRepo.save.mockResolvedValue(cierre);

			const result = await service.generalCierre('2025-01-01', 'user-id');

			expect(mockRepo.save).toHaveBeenCalled();
			expect(result).toEqual(cierre);
		});

		it('actualiza un cierre existente cuando force=true', async () => {
			const existing = {cierreId: 1, fecha: '2025-01-01', observaciones: 'anterior'};
			mockRepo.findOne.mockResolvedValue(existing);
			const cierre = {...existing, totalVentas: 120000};
			mockRepo.create.mockReturnValue(cierre);
			mockRepo.save.mockResolvedValue(cierre);

			const result = await service.generalCierre('2025-01-01', 'user-id', undefined, true);

			expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({fecha: '2025-01-01'}));
			expect(result).toEqual(cierre);
		});

		it('lanza BadRequestException cuando ya existe y force=false', async () => {
			mockRepo.findOne.mockResolvedValue({cierreId: 1});

			await expect(service.generalCierre('2025-01-01', 'user-id')).rejects.toThrow(BadRequestException);
		});

		it('envía correo cuando enviarEmail=true y hay REPORT_EMAIL configurado', async () => {
			mockRepo.findOne.mockResolvedValue(null);
			const cierre = {cierreId: 1, fecha: '2025-01-01'};
			mockRepo.create.mockReturnValue(cierre);
			mockRepo.save.mockResolvedValue(cierre);

			await service.generalCierre('2025-01-01', 'user-id', undefined, false, true);

			expect(mockMailService.sendCierreReport).toHaveBeenCalledWith(
				'test@example.com',
				expect.objectContaining({cierreId: 1}),
			);
		});

		it('no envía correo cuando enviarEmail=false', async () => {
			mockRepo.findOne.mockResolvedValue(null);
			const cierre = {cierreId: 1};
			mockRepo.create.mockReturnValue(cierre);
			mockRepo.save.mockResolvedValue(cierre);

			await service.generalCierre('2025-01-01', 'user-id', undefined, false, false);

			expect(mockMailService.sendCierreReport).not.toHaveBeenCalled();
		});

		it('no envía correo cuando REPORT_EMAIL no está configurado', async () => {
			mockConfig.get.mockReturnValue(null);
			mockRepo.findOne.mockResolvedValue(null);
			const cierre = {cierreId: 1};
			mockRepo.create.mockReturnValue(cierre);
			mockRepo.save.mockResolvedValue(cierre);

			await service.generalCierre('2025-01-01', 'user-id', undefined, false, true);

			expect(mockMailService.sendCierreReport).not.toHaveBeenCalled();
		});
	});

	// ==================== updateCierreIfExists ====================

	describe('updateCierreIfExists', () => {
		it('actualiza el cierre si ya existe para esa fecha', async () => {
			mockRepo.findOne
				.mockResolvedValueOnce({cierreId: 1}) // dentro de updateCierreIfExists
				.mockResolvedValueOnce(null); // dentro de generalCierre → no force conflict
			const cierre = {cierreId: 1};
			mockRepo.create.mockReturnValue(cierre);
			mockRepo.save.mockResolvedValue(cierre);

			const result = await service.updateCierreIfExists('2025-01-01');

			expect(result).toEqual(cierre);
		});

		it('retorna null cuando no existe cierre para esa fecha', async () => {
			mockRepo.findOne.mockResolvedValue(null);

			const result = await service.updateCierreIfExists('2025-01-01');

			expect(result).toBeNull();
		});
	});

	// ==================== getHistory ====================

	describe('getHistory', () => {
		it('retorna los últimos 30 cierres ordenados por fecha DESC', async () => {
			const list = [{fecha: '2025-01-02'}, {fecha: '2025-01-01'}];
			mockRepo.find.mockResolvedValue(list);

			const result = await service.getHistory();

			expect(result).toEqual(list);
			expect(mockRepo.find).toHaveBeenCalledWith(expect.objectContaining({order: {fecha: 'DESC'}, take: 30}));
		});
	});

	// ==================== deleteCierre ====================

	describe('deleteCierre', () => {
		it('elimina el cierre por id', async () => {
			mockRepo.delete.mockResolvedValue({affected: 1});

			await service.deleteCierre('uuid-123');

			expect(mockRepo.delete).toHaveBeenCalledWith('uuid-123');
		});
	});
});
