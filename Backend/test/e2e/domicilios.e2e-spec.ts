import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DomiciliosController } from '../../src/domicilios/domicilios.controller';
import { DomiciliosService } from '../../src/domicilios/domicilios.service';

const mockService = {
	findAll: jest.fn(),
	findByDay: jest.fn(),
	findPendingByDay: jest.fn(),
	findSinAsignarHoy: jest.fn(),
	findByUser: jest.fn(),
	findOne: jest.fn(),
	create: jest.fn(),
	update: jest.fn(),
	remove: jest.fn(),
};

const mockDomicilio = {
	domicilioId: 1,
	telefono: '3001234567',
	direccionEntrega: 'Calle 10 #5-20',
	estadoDomicilio: 'pendiente',
	costoDomicilio: 5000,
};

const TEST_USER = { id: 'test-id', username: '3001111111', roles: ['domiciliario'] };

describe('DomiciliosController (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [DomiciliosController],
			providers: [{ provide: DomiciliosService, useValue: mockService }],
		}).compile();

		app = module.createNestApplication();
		app.use((req: any, _res: any, next: () => void) => {
			req.user = TEST_USER;
			next();
		});
		app.useGlobalPipes(
			new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
		);
		await app.init();
	});

	afterAll(() => app.close());
	beforeEach(() => jest.clearAllMocks());

	// ── GET /domicilios/me ────────────────────────────────────────────────────

	describe('GET /domicilios/me', () => {
		it('retorna domicilios del usuario actual', async () => {
			mockService.findByUser.mockResolvedValue([mockDomicilio]);

			const res = await request(app.getHttpServer()).get('/domicilios/me').expect(200);

			expect(res.body).toHaveLength(1);
			expect(mockService.findByUser).toHaveBeenCalledWith(TEST_USER.username, false);
		});

		it('pasa all=true cuando se envía el query param', async () => {
			mockService.findByUser.mockResolvedValue([mockDomicilio]);

			await request(app.getHttpServer()).get('/domicilios/me?all=true').expect(200);

			expect(mockService.findByUser).toHaveBeenCalledWith(TEST_USER.username, true);
		});
	});

	// ── GET /domicilios ───────────────────────────────────────────────────────

	describe('GET /domicilios', () => {
		it('retorna todos los domicilios', async () => {
			mockService.findAll.mockResolvedValue([mockDomicilio]);

			const res = await request(app.getHttpServer()).get('/domicilios').expect(200);

			expect(res.body).toHaveLength(1);
			expect(mockService.findAll).toHaveBeenCalled();
		});
	});

	// ── GET /domicilios/dia ───────────────────────────────────────────────────

	describe('GET /domicilios/dia', () => {
		it('retorna domicilios del día', async () => {
			mockService.findByDay.mockResolvedValue([mockDomicilio]);

			const res = await request(app.getHttpServer()).get('/domicilios/dia').expect(200);

			expect(res.body).toHaveLength(1);
			expect(mockService.findByDay).toHaveBeenCalled();
		});
	});

	// ── GET /domicilios/dia/pendientes ────────────────────────────────────────

	describe('GET /domicilios/dia/pendientes', () => {
		it('retorna domicilios pendientes del día', async () => {
			mockService.findPendingByDay.mockResolvedValue([mockDomicilio]);

			const res = await request(app.getHttpServer()).get('/domicilios/dia/pendientes').expect(200);

			expect(res.body).toHaveLength(1);
			expect(mockService.findPendingByDay).toHaveBeenCalled();
		});
	});

	// ── GET /domicilios/sin-asignar ───────────────────────────────────────────

	describe('GET /domicilios/sin-asignar', () => {
		it('retorna domicilios sin domiciliario asignado', async () => {
			mockService.findSinAsignarHoy.mockResolvedValue([mockDomicilio]);

			const res = await request(app.getHttpServer()).get('/domicilios/sin-asignar').expect(200);

			expect(res.body).toHaveLength(1);
			expect(mockService.findSinAsignarHoy).toHaveBeenCalled();
		});
	});

	// ── GET /domicilios/:id ───────────────────────────────────────────────────

	describe('GET /domicilios/:id', () => {
		it('retorna el domicilio por ID', async () => {
			mockService.findOne.mockResolvedValue(mockDomicilio);

			const res = await request(app.getHttpServer()).get('/domicilios/1').expect(200);

			expect(res.body.domicilioId).toBe(1);
			expect(mockService.findOne).toHaveBeenCalledWith(1);
		});
	});

	// ── POST /domicilios ──────────────────────────────────────────────────────

	describe('POST /domicilios', () => {
		it('crea un domicilio nuevo', async () => {
			mockService.create.mockResolvedValue(mockDomicilio);

			const res = await request(app.getHttpServer())
				.post('/domicilios')
				.send({ telefono: '3001234567', direccionEntrega: 'Calle 10 #5-20', costoDomicilio: 5000 })
				.expect(201);

			expect(res.body.domicilioId).toBe(1);
			expect(mockService.create).toHaveBeenCalled();
		});
	});

	// ── PATCH /domicilios/:id ─────────────────────────────────────────────────

	describe('PATCH /domicilios/:id', () => {
		it('actualiza el domicilio', async () => {
			const updated = { ...mockDomicilio, estadoDomicilio: 'entregado' };
			mockService.update.mockResolvedValue(updated);

			const res = await request(app.getHttpServer())
				.patch('/domicilios/1')
				.send({ estadoDomicilio: 'entregado' })
				.expect(200);

			expect(res.body.estadoDomicilio).toBe('entregado');
			expect(mockService.update).toHaveBeenCalledWith(1, expect.objectContaining({ estadoDomicilio: 'entregado' }));
		});
	});

	// ── DELETE /domicilios/:id ────────────────────────────────────────────────

	describe('DELETE /domicilios/:id', () => {
		it('elimina el domicilio', async () => {
			mockService.remove.mockResolvedValue({ affected: 1 });

			const res = await request(app.getHttpServer()).delete('/domicilios/1').expect(200);

			expect(res.body.affected).toBe(1);
			expect(mockService.remove).toHaveBeenCalledWith(1);
		});
	});
});
