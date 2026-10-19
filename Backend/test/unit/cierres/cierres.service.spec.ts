import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {BadRequestException} from '@nestjs/common';
import {CierresService} from '../../../src/cierres/cierres.service';
import {CierreCaja} from '../../../src/cierres/esquemas/cierre.entity';
import {EstadisticasService} from '../../../src/estadisticas/estadisticas.service';
import {AnaliticaService} from '../../../src/estadisticas/analitica/analitica.service';
import {MailService} from '../../../src/common/services/mail.service';
import {ConfigService} from '@nestjs/config';
import {EmpresaService} from '../../../src/empresa/empresa.service';
import {LibroDiarioService} from '../../../src/contabilidad/libro-diario/libro-diario.service';

describe('CierresService', () => {
	let service: CierresService;
	let mockRepo: any;
	let mockStatsService: any;
	let mockAnaliticaService: any;
	let mockMailService: any;
	let mockConfig: any;
	let mockEmpresaService: any;
	let mockLibroDiario: any;

	beforeEach(async () => {
		mockRepo = {
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			find: jest.fn(),
			delete: jest.fn(),
		};
		mockStatsService = {
			facturasDetalle: jest.fn().mockResolvedValue([]),
		};
		mockAnaliticaService = {
			topProductosCierre: jest.fn().mockResolvedValue([{producto: 'Pizza - Grande', totalVendido: 3, ingresos: 135000}]),
			// Misma foto de dinero que ven las pantallas (GET /estadisticas/resumen).
			resumenGeneral: jest.fn().mockResolvedValue({
				ventas: {
					facturado: 100000,
					cobrado: 80000,
					porCobrar: 20000,
					facturas: 5,
					ticket: 20000,
					ordenes: 4,
					canceladas: 1,
					cobradoPorMetodo: {efectivo: 50000, transferencia: 30000},
					porMetodo: [
						{clave: 'efectivo', facturas: 2, facturado: 40000},
						{clave: 'transferencia', facturas: 1, facturado: 20000},
						{clave: 'mixto', facturas: 1, facturado: 20000},
					],
					porCuenta: [
						{cuentaId: 1, cuenta: 'Nequi', sinAsignar: false, facturas: 1, monto: 20000},
						{cuentaId: null, cuenta: 'Sin asignar', sinAsignar: true, facturas: 1, monto: 10000},
					],
					porEstado: [
						{clave: 'cobrada', facturas: 4, facturado: 80000, cobrado: 80000, porCobrar: 0},
						{clave: 'pendiente', facturas: 1, facturado: 20000, cobrado: 0, porCobrar: 20000},
					],
				},
				gastos: {total: 15000, pagados: 10000, pendientes: 5000, cantidad: 2},
				balance: {devengado: 85000, cobrado: 70000},
			}),
		};
		mockAnaliticaService.domiciliarios = jest.fn().mockResolvedValue({filas: [], totales: {domicilios: 0, sinRepartidor: 0, asignados: 0, entregados: 0, costoDomicilios: 0, aPagar: 0}, porDia: []});
		mockMailService = {configurado: jest.fn().mockReturnValue(true)};
		mockLibroDiario = {
			destinatarios: jest.fn().mockResolvedValue(['dueno@x.com', 'conta@x.com']),
			enviar: jest.fn().mockResolvedValue({enviadoA: ['dueno@x.com', 'conta@x.com'], adjuntos: []}),
		};
		mockConfig = {get: jest.fn().mockReturnValue('test@example.com')};
		mockEmpresaService = {getConfig: jest.fn().mockResolvedValue({razonSocial: 'Test'})};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CierresService,
				{provide: getRepositoryToken(CierreCaja), useValue: mockRepo},
				{provide: EstadisticasService, useValue: mockStatsService},
				{provide: AnaliticaService, useValue: mockAnaliticaService},
				{provide: MailService, useValue: mockMailService},
				{provide: ConfigService, useValue: mockConfig},
				{provide: EmpresaService, useValue: mockEmpresaService},
				{provide: LibroDiarioService, useValue: mockLibroDiario},
			],
		}).compile();

		service = module.get<CierresService>(CierresService);
	});

	// ==================== generalCierre ====================

	describe('generalCierre', () => {
		it('los totales del cierre salen de la misma foto de dinero que las pantallas (resumenGeneral)', async () => {
			mockRepo.findOne.mockResolvedValue(null);
			mockRepo.create.mockImplementation((v: unknown) => v);
			mockRepo.save.mockImplementation((v: unknown) => Promise.resolve(v));

			const result = await service.generalCierre('2025-01-01', 'user-id');

			expect(mockAnaliticaService.resumenGeneral).toHaveBeenCalledWith('2025-01-01', '2025-01-01');
			expect(result).toEqual(
				expect.objectContaining({
					totalVentas: 100000,
					totalEgresos: 15000,
					balanceNeto: 70000,
					totalFacturas: 5,
					totalOrdenes: 5,
					ticketPromedio: 20000,
				}),
			);
		});

		it('el detalle por método es lo COBRADO (mixtas repartidas) con las cuentas de transferencia y lo por cobrar', async () => {
			mockRepo.findOne.mockResolvedValue(null);
			mockRepo.create.mockImplementation((v: unknown) => v);
			mockRepo.save.mockImplementation((v: unknown) => Promise.resolve(v));

			const result = await service.generalCierre('2025-01-01', 'user-id');

			expect(result.metodosPago).toEqual([
				{metodo: 'efectivo', cantidad: 3, total: 50000, porCuenta: [], porcentaje: 63},
				{
					metodo: 'transferencia',
					cantidad: 2,
					total: 30000,
					porcentaje: 38,
					porCuenta: [
						{cuentaNombre: 'Nequi', cantidad: 1, total: 20000},
						{cuentaNombre: 'Sin asignar', cantidad: 1, total: 10000},
					],
				},
				{metodo: 'por_cobrar', cantidad: 1, total: 20000, porCuenta: [], porcentaje: 0},
			]);
			// Efectivo + transferencia = cobrado
			const cobrado = result.metodosPago.filter((m: any) => m.metodo !== 'por_cobrar').reduce((t: number, m: any) => t + m.total, 0);
			expect(cobrado).toBe(80000);
		});

		it('guarda el top de productos agrupado por producto + variante (AnaliticaService)', async () => {
			mockRepo.findOne.mockResolvedValue(null);
			mockRepo.create.mockImplementation((v: unknown) => v);
			mockRepo.save.mockImplementation((v: unknown) => Promise.resolve(v));

			const result = await service.generalCierre('2025-01-01', 'user-id');

			expect(mockAnaliticaService.topProductosCierre).toHaveBeenCalledWith('2025-01-01', 5);
			expect(result.productosTop).toEqual([{producto: 'Pizza - Grande', totalVendido: 3, ingresos: 135000}]);
		});

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

		it('con enviarEmail=true envía UN correo con los dos libros en PDF (lo arma LibroDiarioService) a dueño y contadora', async () => {
			mockRepo.findOne.mockResolvedValue(null);
			mockRepo.create.mockReturnValue({cierreId: 1, fecha: '2025-01-01', observaciones: 'Sin novedad'});
			mockRepo.save.mockResolvedValue({cierreId: 1, fecha: '2025-01-01', observaciones: 'Sin novedad'});

			await service.generalCierre('2025-01-01', 'user-id', 'Sin novedad', false, true);

			expect(mockLibroDiario.enviar).toHaveBeenCalledTimes(1);
			expect(mockLibroDiario.enviar).toHaveBeenCalledWith('2025-01-01', '2025-01-01', {observaciones: 'Sin novedad', motivo: 'cierre'});
		});

		it('un error al enviar el correo no hace fallar el cierre', async () => {
			mockLibroDiario.enviar.mockRejectedValue(new Error('SMTP caído'));
			mockRepo.findOne.mockResolvedValue(null);
			mockRepo.create.mockReturnValue({cierreId: 1});
			mockRepo.save.mockResolvedValue({cierreId: 1});

			await expect(service.generalCierre('2025-01-01', 'user-id', undefined, false, true)).resolves.toEqual({cierreId: 1});
		});

		it('sin servidor de correo (MAIL_HOST) o sin destinatarios no intenta enviar', async () => {
			mockRepo.findOne.mockResolvedValue(null);
			mockRepo.create.mockReturnValue({cierreId: 1});
			mockRepo.save.mockResolvedValue({cierreId: 1});

			mockMailService.configurado.mockReturnValue(false);
			await service.generalCierre('2025-01-01', 'user-id', undefined, true, true);
			mockMailService.configurado.mockReturnValue(true);
			mockLibroDiario.destinatarios.mockResolvedValue([]);
			await service.generalCierre('2025-01-01', 'user-id', undefined, true, true);

			expect(mockLibroDiario.enviar).not.toHaveBeenCalled();
		});

		it('no envía correo cuando enviarEmail=false (ediciones que actualizan el cierre)', async () => {
			mockRepo.findOne.mockResolvedValue(null);
			mockRepo.create.mockReturnValue({cierreId: 1});
			mockRepo.save.mockResolvedValue({cierreId: 1});

			await service.generalCierre('2025-01-01', 'user-id', undefined, false, false);

			expect(mockLibroDiario.destinatarios).not.toHaveBeenCalled();
			expect(mockLibroDiario.enviar).not.toHaveBeenCalled();
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
		it('retorna TODOS los cierres ordenados por fecha DESC (sin tope silencioso)', async () => {
			const list = [{fecha: '2025-01-02'}, {fecha: '2025-01-01'}];
			mockRepo.find.mockResolvedValue(list);

			const result = await service.getHistory();

			expect(result).toEqual(list);
			expect(mockRepo.find).toHaveBeenCalledWith({order: {fecha: 'DESC'}});
		});

		it('con límite devuelve solo los más recientes', async () => {
			mockRepo.find.mockResolvedValue([]);

			await service.getHistory(30);

			expect(mockRepo.find).toHaveBeenCalledWith({order: {fecha: 'DESC'}, take: 30});
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
