import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ProductosController } from '../../src/productos/productos.controller';
import { ProductosService } from '../../src/productos/productos.service';

const mockService = {
	findAll: jest.fn(),
	findOne: jest.fn(),
	getVariantes: jest.fn(),
	create: jest.fn(),
	createVariante: jest.fn(),
	update: jest.fn(),
	remove: jest.fn(),
	updateVariante: jest.fn(),
	deleteVariante: jest.fn(),
};

const mockProducto = {
	productoId: 1,
	productoNombre: 'Pizza',
	descripcion: 'Pizza artesanal',
	activo: true,
	emoji: '🍕',
	variantes: [
		{ varianteId: 1, nombre: 'Grande', precio: 30000, activo: true },
	],
};

const mockVariante = { varianteId: 1, productoId: 1, nombre: 'Grande', precio: 30000, activo: true };

describe('ProductosController (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [ProductosController],
			providers: [{ provide: ProductosService, useValue: mockService }],
		}).compile();

		app = module.createNestApplication();
		app.use((req: any, _res: any, next: () => void) => {
			req.user = { id: 'test-id', username: 'admin1', roles: ['admin'] };
			next();
		});
		app.useGlobalPipes(
			new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
		);
		await app.init();
	});

	afterAll(() => app.close());
	beforeEach(() => jest.clearAllMocks());

	// ── GET /productos ────────────────────────────────────────────────────────

	describe('GET /productos', () => {
		it('retorna lista de productos con sus variantes', async () => {
			mockService.findAll.mockResolvedValue([mockProducto]);

			const res = await request(app.getHttpServer()).get('/productos').expect(200);

			expect(res.body).toHaveLength(1);
			expect(res.body[0].productoNombre).toBe('Pizza');
			expect(mockService.findAll).toHaveBeenCalled();
		});

		it('pasa el filtro activo al servicio', async () => {
			mockService.findAll.mockResolvedValue([mockProducto]);

			await request(app.getHttpServer()).get('/productos?activo=true').expect(200);

			expect(mockService.findAll).toHaveBeenCalledWith(
				expect.objectContaining({ activo: true }),
			);
		});
	});

	// ── GET /productos/:id ────────────────────────────────────────────────────

	describe('GET /productos/:id', () => {
		it('retorna el producto por ID', async () => {
			mockService.findOne.mockResolvedValue(mockProducto);

			const res = await request(app.getHttpServer()).get('/productos/1').expect(200);

			expect(res.body.productoId).toBe(1);
			expect(mockService.findOne).toHaveBeenCalledWith(1);
		});
	});

	// ── GET /productos/:id/variantes ──────────────────────────────────────────

	describe('GET /productos/:id/variantes', () => {
		it('retorna las variantes del producto', async () => {
			mockService.getVariantes.mockResolvedValue([mockVariante]);

			const res = await request(app.getHttpServer()).get('/productos/1/variantes').expect(200);

			expect(res.body).toHaveLength(1);
			expect(res.body[0].nombre).toBe('Grande');
			expect(mockService.getVariantes).toHaveBeenCalledWith(1);
		});
	});

	// ── POST /productos ───────────────────────────────────────────────────────

	describe('POST /productos', () => {
		it('crea un producto nuevo', async () => {
			mockService.create.mockResolvedValue(mockProducto);

			const res = await request(app.getHttpServer())
				.post('/productos')
				.send({ productoNombre: 'Pizza', variantes: [{ nombre: 'Grande', precio: 30000 }] })
				.expect(201);

			expect(res.body.productoId).toBe(1);
			expect(mockService.create).toHaveBeenCalled();
		});
	});

	// ── POST /productos/:id/variantes ─────────────────────────────────────────

	describe('POST /productos/:id/variantes', () => {
		it('agrega una variante al producto', async () => {
			mockService.createVariante.mockResolvedValue(mockVariante);

			const res = await request(app.getHttpServer())
				.post('/productos/1/variantes')
				.send({ nombre: 'Mediana', precio: 22000 })
				.expect(201);

			expect(res.body.varianteId).toBe(1);
			expect(mockService.createVariante).toHaveBeenCalledWith(1, 'Mediana', 22000, undefined);
		});
	});

	// ── PATCH /productos/:id ──────────────────────────────────────────────────

	describe('PATCH /productos/:id', () => {
		it('actualiza el producto', async () => {
			const updated = { ...mockProducto, productoNombre: 'Pizza Premium' };
			mockService.update.mockResolvedValue(updated);

			const res = await request(app.getHttpServer())
				.patch('/productos/1')
				.send({ productoNombre: 'Pizza Premium' })
				.expect(200);

			expect(res.body.productoNombre).toBe('Pizza Premium');
			expect(mockService.update).toHaveBeenCalledWith(1, expect.objectContaining({ productoNombre: 'Pizza Premium' }));
		});
	});

	// ── DELETE /productos/:id ─────────────────────────────────────────────────

	describe('DELETE /productos/:id', () => {
		it('elimina el producto', async () => {
			mockService.remove.mockResolvedValue({ affected: 1 });

			const res = await request(app.getHttpServer()).delete('/productos/1').expect(200);

			expect(res.body.affected).toBe(1);
			expect(mockService.remove).toHaveBeenCalledWith(1);
		});
	});

	// ── PATCH /productos/variantes/:id ────────────────────────────────────────

	describe('PATCH /productos/variantes/:id', () => {
		it('actualiza una variante', async () => {
			const updated = { ...mockVariante, precio: 35000 };
			mockService.updateVariante.mockResolvedValue(updated);

			const res = await request(app.getHttpServer())
				.patch('/productos/variantes/1')
				.send({ precio: 35000 })
				.expect(200);

			expect(res.body.precio).toBe(35000);
			expect(mockService.updateVariante).toHaveBeenCalledWith(1, undefined, 35000, undefined, undefined);
		});
	});

	// ── DELETE /productos/variantes/:id ──────────────────────────────────────

	describe('DELETE /productos/variantes/:id', () => {
		it('elimina la variante', async () => {
			mockService.deleteVariante.mockResolvedValue({ affected: 1 });

			const res = await request(app.getHttpServer()).delete('/productos/variantes/1').expect(200);

			expect(res.body.affected).toBe(1);
			expect(mockService.deleteVariante).toHaveBeenCalledWith(1);
		});
	});
});
