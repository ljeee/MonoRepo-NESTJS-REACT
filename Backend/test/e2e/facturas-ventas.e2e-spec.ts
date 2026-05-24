import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { FacturasVentasController } from '../../src/facturas-ventas/facturas-ventas.controller';
import { FacturasVentasService } from '../../src/facturas-ventas/facturas-ventas.service';

const mockService = {
	findAll: jest.fn(),
	findByDay: jest.fn(),
	getDayStats: jest.fn(),
	findPendingByDay: jest.fn(),
	findOne: jest.fn(),
	create: jest.fn(),
	update: jest.fn(),
	remove: jest.fn(),
};

const mockFactura = {
	facturaId: 1,
	clienteNombre: 'Juan',
	metodo: 'efectivo',
	total: 50000,
	estado: 'pendiente',
	fechaFactura: '2025-01-01',
};

describe('FacturasVentasController (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [FacturasVentasController],
			providers: [{ provide: FacturasVentasService, useValue: mockService }],
		}).compile();

		app = module.createNestApplication();
		app.use((req: any, _res: any, next: () => void) => {
			req.user = { id: 'test-id', username: 'cajero1', roles: ['cajero'] };
			next();
		});
		app.useGlobalPipes(
			new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
		);
		await app.init();
	});

	afterAll(() => app.close());
	beforeEach(() => jest.clearAllMocks());

	// ── GET /facturas-ventas ──────────────────────────────────────────────────

	describe('GET /facturas-ventas', () => {
		it('retorna lista paginada', async () => {
			mockService.findAll.mockResolvedValue({ data: [mockFactura], total: 1, page: 1, limit: 100, totalPages: 1 });

			const res = await request(app.getHttpServer()).get('/facturas-ventas').expect(200);

			expect(res.body.data).toHaveLength(1);
			expect(mockService.findAll).toHaveBeenCalled();
		});

		it('pasa parámetros from/to/page/limit al servicio', async () => {
			mockService.findAll.mockResolvedValue({ data: [], total: 0, page: 2, limit: 50, totalPages: 0 });

			await request(app.getHttpServer())
				.get('/facturas-ventas?from=2025-01-01&to=2025-01-31&page=2&limit=50')
				.expect(200);

			expect(mockService.findAll).toHaveBeenCalledWith(
				expect.objectContaining({ from: '2025-01-01', to: '2025-01-31', page: 2, limit: 50 }),
			);
		});

		it('retorna 400 si el rango de fechas excede 365 días', async () => {
			await request(app.getHttpServer())
				.get('/facturas-ventas?from=2023-01-01&to=2025-01-01')
				.expect(400);
		});
	});

	// ── GET /facturas-ventas/dia ──────────────────────────────────────────────

	describe('GET /facturas-ventas/dia', () => {
		it('retorna facturas del día', async () => {
			mockService.findByDay.mockResolvedValue([mockFactura]);

			const res = await request(app.getHttpServer()).get('/facturas-ventas/dia').expect(200);

			expect(res.body).toHaveLength(1);
			expect(mockService.findByDay).toHaveBeenCalled();
		});
	});

	// ── GET /facturas-ventas/dia/stats ────────────────────────────────────────

	describe('GET /facturas-ventas/dia/stats', () => {
		it('retorna estadísticas del día', async () => {
			const stats = { totalDia: 150000, totalPagado: 100000, totalPendiente: 50000 };
			mockService.getDayStats.mockResolvedValue(stats);

			const res = await request(app.getHttpServer()).get('/facturas-ventas/dia/stats').expect(200);

			expect(res.body.totalDia).toBe(150000);
		});
	});

	// ── GET /facturas-ventas/dia/pendientes ───────────────────────────────────

	describe('GET /facturas-ventas/dia/pendientes', () => {
		it('retorna facturas pendientes del día', async () => {
			mockService.findPendingByDay.mockResolvedValue([mockFactura]);

			const res = await request(app.getHttpServer()).get('/facturas-ventas/dia/pendientes').expect(200);

			expect(res.body).toHaveLength(1);
			expect(mockService.findPendingByDay).toHaveBeenCalled();
		});
	});

	// ── GET /facturas-ventas/:id ──────────────────────────────────────────────

	describe('GET /facturas-ventas/:id', () => {
		it('retorna la factura por ID', async () => {
			mockService.findOne.mockResolvedValue(mockFactura);

			const res = await request(app.getHttpServer()).get('/facturas-ventas/1').expect(200);

			expect(res.body.facturaId).toBe(1);
			expect(mockService.findOne).toHaveBeenCalledWith(1);
		});
	});

	// ── POST /facturas-ventas ─────────────────────────────────────────────────

	describe('POST /facturas-ventas', () => {
		it('crea una factura nueva', async () => {
			mockService.create.mockResolvedValue(mockFactura);

			const res = await request(app.getHttpServer())
				.post('/facturas-ventas')
				.send({ clienteNombre: 'Juan', metodo: 'efectivo' })
				.expect(201);

			expect(res.body.facturaId).toBe(1);
			expect(mockService.create).toHaveBeenCalled();
		});
	});

	// ── PATCH /facturas-ventas/:id ────────────────────────────────────────────

	describe('PATCH /facturas-ventas/:id', () => {
		it('actualiza la factura', async () => {
			const updated = { ...mockFactura, estado: 'pagado' };
			mockService.update.mockResolvedValue(updated);

			const res = await request(app.getHttpServer())
				.patch('/facturas-ventas/1')
				.send({ estado: 'pagado' })
				.expect(200);

			expect(res.body.estado).toBe('pagado');
			expect(mockService.update).toHaveBeenCalledWith(1, expect.objectContaining({ estado: 'pagado' }));
		});
	});

	// ── DELETE /facturas-ventas/:id ───────────────────────────────────────────

	describe('DELETE /facturas-ventas/:id', () => {
		it('elimina la factura', async () => {
			mockService.remove.mockResolvedValue({ affected: 1 });

			const res = await request(app.getHttpServer()).delete('/facturas-ventas/1').expect(200);

			expect(res.body.affected).toBe(1);
			expect(mockService.remove).toHaveBeenCalledWith(1);
		});
	});
});
