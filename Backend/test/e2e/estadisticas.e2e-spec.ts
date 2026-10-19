import {Test, TestingModule} from '@nestjs/testing';
import {INestApplication, ValidationPipe} from '@nestjs/common';
import request from 'supertest';
import {EstadisticasController} from '../../src/estadisticas/estadisticas.controller';
import {EstadisticasService} from '../../src/estadisticas/estadisticas.service';
import {AnaliticaController} from '../../src/estadisticas/analitica/analitica.controller';
import {AnaliticaService} from '../../src/estadisticas/analitica/analitica.service';

const mockAnalitica = {
	resumen: jest.fn(),
	productos: jest.fn(),
	resumenGeneral: jest.fn(),
	clientePerfil: jest.fn(),
};

const mockService = {
};

describe('EstadisticasController (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [EstadisticasController, AnaliticaController],
			providers: [
				{provide: EstadisticasService, useValue: mockService},
				{provide: AnaliticaService, useValue: mockAnalitica},
			],
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

	describe('GET /estadisticas/cliente/:telefono/historial', () => {
		it('retorna el historial del cliente', async () => {
			mockAnalitica.clientePerfil.mockResolvedValue({totalOrdenes: 3, gastoTotal: 150000});

			const res = await request(app.getHttpServer())
				.get('/estadisticas/cliente/3001234567/historial')
				.expect(200);

			expect(res.body.totalOrdenes).toBe(3);
			expect(mockAnalitica.clientePerfil).toHaveBeenCalledWith('3001234567');
		});
	});

	describe('GET /estadisticas/resumen', () => {
		it('delega en el resumen general con el rango', async () => {
			mockAnalitica.resumenGeneral.mockResolvedValue({ventas: {facturado: 1}});
			await request(app.getHttpServer()).get('/estadisticas/resumen?from=2026-05-01&to=2026-05-31').expect(200);
			expect(mockAnalitica.resumenGeneral).toHaveBeenCalledWith('2026-05-01', '2026-05-31');
		});

		it('rechaza fechas mal formadas', async () => {
			await request(app.getHttpServer()).get('/estadisticas/resumen?from=mayo&to=2026-05-31').expect(400);
		});
	});

	describe('endpoints legados retirados (A2)', () => {
		it.each(['productos-top', 'sabores-top', 'variantes-top', 'ventas-por-hora', 'ventas-por-dia', 'domiciliarios', 'metodos-pago', 'resumen-periodo', 'clientes-frecuentes'])(
			'GET /estadisticas/%s ya no existe (lo reemplaza /estadisticas/analitica/*)',
			async (ruta) => {
				await request(app.getHttpServer()).get(`/estadisticas/${ruta}?from=2026-05-01&to=2026-05-31`).expect(404);
			},
		);
	});

	describe('GET /estadisticas/analitica/*', () => {
		it('convierte los filtros del query (listas, números, booleanos)', async () => {
			mockAnalitica.resumen.mockResolvedValue({});
			await request(app.getHttpServer())
				.get('/estadisticas/analitica/resumen?from=2026-05-01&to=2026-05-31&tipoPedido=mesa,domicilio&productoId=1,2&comparar=false&precioManual=true')
				.expect(200);
			expect(mockAnalitica.resumen).toHaveBeenCalledWith(
				expect.objectContaining({
					tipoPedido: ['mesa', 'domicilio'],
					productoId: [1, 2],
					comparar: false,
					precioManual: true,
				}),
			);
		});

		it('400 con un valor fuera de catálogo', async () => {
			await request(app.getHttpServer())
				.get('/estadisticas/analitica/productos?from=2026-05-01&to=2026-05-31&agrupar=cliente')
				.expect(400);
		});
	});
});
