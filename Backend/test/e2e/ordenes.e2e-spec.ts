import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { OrdenesController } from '../../src/ordenes/ordenes.controller';
import { OrdenesService } from '../../src/ordenes/ordenes.service';

const mockOrdenesService = {
	findAll: jest.fn(),
	findByDay: jest.fn(),
	findPendingByDay: jest.fn(),
	findOne: jest.fn(),
	create: jest.fn(),
	update: jest.fn(),
	remove: jest.fn(),
	completar: jest.fn(),
	cancel: jest.fn(),
};

const mockOrden = {
	ordenId: 1,
	facturaId: 10,
	tipoPedido: 'mesa',
	estadoOrden: 'pendiente',
	fechaOrden: new Date().toISOString(),
	factura: { facturaId: 10, total: 50000, estado: 'pendiente' },
	productos: [],
};

describe('OrdenesController (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			controllers: [OrdenesController],
			providers: [
				{ provide: OrdenesService, useValue: mockOrdenesService },
			],
		}).compile();

		app = moduleFixture.createNestApplication();

		// Inyectar usuario de prueba para endpoints que usan @GetUser()
		app.use((req: any, _res: any, next: () => void) => {
			req.user = { id: 'test-user-id', username: 'cajero1', roles: ['cajero'] };
			next();
		});

		app.useGlobalPipes(
			new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
		);

		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	// ==================== GET /ordenes ====================

	describe('GET /ordenes', () => {
		it('retorna 200 con lista paginada', async () => {
			const response = { data: [mockOrden], total: 1, page: 1, limit: 50, totalPages: 1 };
			mockOrdenesService.findAll.mockResolvedValue(response);

			const res = await request(app.getHttpServer()).get('/ordenes').expect(200);

			expect(res.body).toMatchObject({ total: 1, page: 1 });
			expect(mockOrdenesService.findAll).toHaveBeenCalled();
		});

		it('pasa los query params al servicio', async () => {
			mockOrdenesService.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 });

			await request(app.getHttpServer())
				.get('/ordenes?estado=pendiente&page=2&limit=10')
				.expect(200);

			expect(mockOrdenesService.findAll).toHaveBeenCalledWith(
				expect.objectContaining({ estado: 'pendiente', page: 2, limit: 10 }),
			);
		});
	});

	// ==================== GET /ordenes/dia ====================

	describe('GET /ordenes/dia', () => {
		it('retorna 200 con ordenes del día', async () => {
			mockOrdenesService.findByDay.mockResolvedValue([mockOrden]);

			const res = await request(app.getHttpServer()).get('/ordenes/dia').expect(200);

			expect(Array.isArray(res.body)).toBe(true);
			expect(mockOrdenesService.findByDay).toHaveBeenCalled();
		});

		it('pasa filtro de estado cuando se provee', async () => {
			mockOrdenesService.findByDay.mockResolvedValue([]);

			await request(app.getHttpServer()).get('/ordenes/dia?estado=completada').expect(200);

			expect(mockOrdenesService.findByDay).toHaveBeenCalledWith('completada');
		});
	});

	// ==================== GET /ordenes/dia/pendientes ====================

	describe('GET /ordenes/dia/pendientes', () => {
		it('retorna 200 con ordenes pendientes del día', async () => {
			mockOrdenesService.findPendingByDay.mockResolvedValue([mockOrden]);

			const res = await request(app.getHttpServer()).get('/ordenes/dia/pendientes').expect(200);

			expect(Array.isArray(res.body)).toBe(true);
		});
	});

	// ==================== GET /ordenes/:id ====================

	describe('GET /ordenes/:id', () => {
		it('retorna 200 con la orden cuando existe', async () => {
			mockOrdenesService.findOne.mockResolvedValue(mockOrden);

			const res = await request(app.getHttpServer()).get('/ordenes/1').expect(200);

			expect(res.body).toMatchObject({ ordenId: 1 });
			expect(mockOrdenesService.findOne).toHaveBeenCalledWith(1);
		});

		it('retorna 404 cuando la orden no existe', async () => {
			const { NotFoundException } = await import('@nestjs/common');
			mockOrdenesService.findOne.mockRejectedValue(new NotFoundException('Orden no encontrada'));

			await request(app.getHttpServer()).get('/ordenes/999').expect(404);
		});
	});

	// ==================== POST /ordenes ====================

	describe('POST /ordenes', () => {
		it('retorna 201 con la orden creada', async () => {
			mockOrdenesService.create.mockResolvedValue(mockOrden);

			const res = await request(app.getHttpServer())
				.post('/ordenes')
				.send({ tipoPedido: 'mesa' })
				.expect(201);

			expect(res.body).toMatchObject({ ordenId: 1 });
			expect(mockOrdenesService.create).toHaveBeenCalled();
		});

		it('retorna 400 cuando tipoPedido tiene un valor inválido', async () => {
			await request(app.getHttpServer())
				.post('/ordenes')
				.send({ tipoPedido: 'invalido' })
				.expect(400);
		});

		it('crea orden de tipo domicilio correctamente', async () => {
			mockOrdenesService.create.mockResolvedValue({ ...mockOrden, tipoPedido: 'domicilio' });

			const res = await request(app.getHttpServer())
				.post('/ordenes')
				.send({
					tipoPedido: 'domicilio',
					nombreCliente: 'Juan Pérez',
					telefonoCliente: '3001234567',
					direccionCliente: 'Calle 10 #5-20',
				})
				.expect(201);

			expect(mockOrdenesService.create).toHaveBeenCalledWith(
				expect.objectContaining({ tipoPedido: 'domicilio', nombreCliente: 'Juan Pérez' }),
			);
		});
	});

	// ==================== PATCH /ordenes/:id ====================

	describe('PATCH /ordenes/:id', () => {
		it('retorna 200 con la orden actualizada', async () => {
			const updated = { ...mockOrden, observaciones: 'sin cebolla' };
			mockOrdenesService.update.mockResolvedValue(updated);

			const res = await request(app.getHttpServer())
				.patch('/ordenes/1')
				.send({ observaciones: 'sin cebolla' })
				.expect(200);

			expect(mockOrdenesService.update).toHaveBeenCalledWith(1, expect.objectContaining({ observaciones: 'sin cebolla' }));
		});
	});

	// ==================== DELETE /ordenes/:id ====================

	describe('DELETE /ordenes/:id', () => {
		it('retorna 200 al eliminar correctamente', async () => {
			mockOrdenesService.remove.mockResolvedValue({ affected: 1 });

			await request(app.getHttpServer()).delete('/ordenes/1').expect(200);

			expect(mockOrdenesService.remove).toHaveBeenCalledWith(1);
		});

		it('retorna 400 cuando la orden no se puede eliminar', async () => {
			const { BadRequestException } = await import('@nestjs/common');
			mockOrdenesService.remove.mockRejectedValue(new BadRequestException('No se puede eliminar una orden pagada'));

			await request(app.getHttpServer()).delete('/ordenes/2').expect(400);
		});
	});

	// ==================== PATCH /ordenes/:id/completar ====================

	describe('PATCH /ordenes/:id/completar', () => {
		it('retorna 200 al completar la orden', async () => {
			const completed = { ...mockOrden, estadoOrden: 'completada' };
			mockOrdenesService.completar.mockResolvedValue(completed);

			const res = await request(app.getHttpServer())
				.patch('/ordenes/1/completar')
				.send({ metodo: 'efectivo' })
				.expect(200);

			expect(mockOrdenesService.completar).toHaveBeenCalledWith(
				1,
				'efectivo',
				'test-user-id',
				expect.any(String),
				undefined,
				undefined,
				undefined,
				undefined,
			);
		});

		it('pasa pagos mixtos al servicio', async () => {
			mockOrdenesService.completar.mockResolvedValue({ ...mockOrden, estadoOrden: 'completada' });

			await request(app.getHttpServer())
				.patch('/ordenes/1/completar')
				.send({ metodo: 'mixto', pagoEfectivo: 30000, pagoTransferencia: 20000 })
				.expect(200);

			expect(mockOrdenesService.completar).toHaveBeenCalledWith(
				1,
				'mixto',
				'test-user-id',
				expect.any(String),
				undefined,
				undefined,
				30000,
				20000,
			);
		});
	});

	// ==================== PATCH /ordenes/:id/cancel ====================

	describe('PATCH /ordenes/:id/cancel', () => {
		it('retorna 200 al cancelar la orden', async () => {
			const cancelled = { ...mockOrden, estadoOrden: 'cancelado' };
			mockOrdenesService.cancel.mockResolvedValue(cancelled);

			const res = await request(app.getHttpServer())
				.patch('/ordenes/1/cancel')
				.send({ reason: 'cliente se arrepintió' })
				.expect(200);

			expect(mockOrdenesService.cancel).toHaveBeenCalledWith(
				1,
				'cliente se arrepintió',
				'test-user-id',
			);
		});
	});
});
