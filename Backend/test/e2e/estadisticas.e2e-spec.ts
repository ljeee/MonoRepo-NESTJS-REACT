import {Test, TestingModule} from '@nestjs/testing';
import {INestApplication, ValidationPipe} from '@nestjs/common';
import request from 'supertest';
import {EstadisticasController} from '../../src/estadisticas/estadisticas.controller';
import {EstadisticasService} from '../../src/estadisticas/estadisticas.service';

const mockService = {
	productosTop: jest.fn(),
	saboresTop: jest.fn(),
	variantesTop: jest.fn(),
	ventasPorHora: jest.fn(),
	ventasPorDia: jest.fn(),
	metodosPago: jest.fn(),
	resumenPeriodo: jest.fn(),
	clientesFrecuentes: jest.fn(),
	domiciliariosStats: jest.fn(),
	clienteHistorial: jest.fn(),
};

describe('EstadisticasController (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [EstadisticasController],
			providers: [{provide: EstadisticasService, useValue: mockService}],
		}).compile();

		app = module.createNestApplication();
		app.use((req: any, _res: any, next: () => void) => {
			req.user = {id: 'test-id', username: 'admin1', roles: ['admin']};
			next();
		});
		app.useGlobalPipes(
			new ValidationPipe({whitelist: true, transform: true, transformOptions: {enableImplicitConversion: true}}),
		);
		await app.init();
	});

	afterAll(() => app.close());
	beforeEach(() => jest.clearAllMocks());

	describe('GET /estadisticas/productos-top', () => {
		it('retorna los productos top', async () => {
			mockService.productosTop.mockResolvedValue([{producto: 'Pizza', totalVendido: 5}]);

			const res = await request(app.getHttpServer())
				.get('/estadisticas/productos-top?from=2025-01-01&to=2025-01-31')
				.expect(200);

			expect(res.body).toHaveLength(1);
			expect(mockService.productosTop).toHaveBeenCalledWith('2025-01-01', '2025-01-31', 10);
		});

		it('usa el limit personalizado', async () => {
			mockService.productosTop.mockResolvedValue([]);

			await request(app.getHttpServer())
				.get('/estadisticas/productos-top?from=2025-01-01&to=2025-01-31&limit=5')
				.expect(200);

			expect(mockService.productosTop).toHaveBeenCalledWith('2025-01-01', '2025-01-31', 5);
		});
	});

	describe('GET /estadisticas/sabores-top', () => {
		it('retorna los sabores top', async () => {
			mockService.saboresTop.mockResolvedValue([{sabor: 'paisa', cantidad: 3}]);

			const res = await request(app.getHttpServer())
				.get('/estadisticas/sabores-top?from=2025-01-01&to=2025-01-31')
				.expect(200);

			expect(res.body[0].sabor).toBe('paisa');
			expect(mockService.saboresTop).toHaveBeenCalledWith('2025-01-01', '2025-01-31', 10);
		});
	});

	describe('GET /estadisticas/variantes-top', () => {
		it('retorna las variantes top', async () => {
			mockService.variantesTop.mockResolvedValue([{variante: 'Grande', totalVendido: 8}]);

			const res = await request(app.getHttpServer())
				.get('/estadisticas/variantes-top?from=2025-01-01&to=2025-01-31')
				.expect(200);

			expect(res.body[0].variante).toBe('Grande');
		});
	});

	describe('GET /estadisticas/ventas-por-hora', () => {
		it('retorna ventas por hora sin parámetros', async () => {
			mockService.ventasPorHora.mockResolvedValue([{hora: 12, cantidad: 3, total: 90000}]);

			const res = await request(app.getHttpServer()).get('/estadisticas/ventas-por-hora').expect(200);

			expect(res.body[0].hora).toBe(12);
			expect(mockService.ventasPorHora).toHaveBeenCalledWith(undefined, undefined, undefined);
		});

		it('pasa fecha específica al servicio', async () => {
			mockService.ventasPorHora.mockResolvedValue([]);

			await request(app.getHttpServer()).get('/estadisticas/ventas-por-hora?fecha=2025-01-15').expect(200);

			expect(mockService.ventasPorHora).toHaveBeenCalledWith('2025-01-15', undefined, undefined);
		});
	});

	describe('GET /estadisticas/ventas-por-dia', () => {
		it('retorna ventas por día', async () => {
			mockService.ventasPorDia.mockResolvedValue([{fecha: '2025-01-01', cantidad: 4, total: 80000}]);

			const res = await request(app.getHttpServer())
				.get('/estadisticas/ventas-por-dia?from=2025-01-01&to=2025-01-31')
				.expect(200);

			expect(res.body[0].total).toBe(80000);
			expect(mockService.ventasPorDia).toHaveBeenCalledWith('2025-01-01', '2025-01-31');
		});
	});

	describe('GET /estadisticas/metodos-pago', () => {
		it('retorna distribución de métodos de pago', async () => {
			mockService.metodosPago.mockResolvedValue([{metodo: 'efectivo', total: 75000, porcentaje: 75}]);

			const res = await request(app.getHttpServer())
				.get('/estadisticas/metodos-pago?from=2025-01-01&to=2025-01-31')
				.expect(200);

			expect(res.body[0].metodo).toBe('efectivo');
		});
	});

	describe('GET /estadisticas/resumen-periodo', () => {
		it('retorna el resumen del período', async () => {
			const resumen = {totalVentas: 100000, balanceNeto: 80000, ticketPromedio: 20000};
			mockService.resumenPeriodo.mockResolvedValue(resumen);

			const res = await request(app.getHttpServer())
				.get('/estadisticas/resumen-periodo?from=2025-01-01&to=2025-01-31')
				.expect(200);

			expect(res.body.totalVentas).toBe(100000);
		});
	});

	describe('GET /estadisticas/clientes-frecuentes', () => {
		it('retorna los clientes frecuentes', async () => {
			mockService.clientesFrecuentes.mockResolvedValue([{clienteNombre: 'Juan', totalOrdenes: 5}]);

			const res = await request(app.getHttpServer()).get('/estadisticas/clientes-frecuentes').expect(200);

			expect(res.body[0].clienteNombre).toBe('Juan');
			expect(mockService.clientesFrecuentes).toHaveBeenCalledWith(10);
		});
	});

	describe('GET /estadisticas/domiciliarios', () => {
		it('retorna stats de domiciliarios', async () => {
			mockService.domiciliariosStats.mockResolvedValue([{nombre: 'Carlos', entregas: 3}]);

			const res = await request(app.getHttpServer())
				.get('/estadisticas/domiciliarios?from=2025-01-01&to=2025-01-31')
				.expect(200);

			expect(res.body[0].nombre).toBe('Carlos');
		});
	});

	describe('GET /estadisticas/cliente/:telefono/historial', () => {
		it('retorna el historial del cliente', async () => {
			mockService.clienteHistorial.mockResolvedValue({totalOrdenes: 3, gastoTotal: 150000});

			const res = await request(app.getHttpServer())
				.get('/estadisticas/cliente/3001234567/historial')
				.expect(200);

			expect(res.body.totalOrdenes).toBe(3);
			expect(mockService.clienteHistorial).toHaveBeenCalledWith('3001234567');
		});
	});
});
