import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ClientesController } from '../../src/clientes/clientes.controller';
import { ClientesService } from '../../src/clientes/clientes.service';

const mockService = {
	findAll: jest.fn(),
	findOne: jest.fn(),
	create: jest.fn(),
	update: jest.fn(),
	remove: jest.fn(),
	getDirecciones: jest.fn(),
	addDireccion: jest.fn(),
	removeDireccion: jest.fn(),
};

const mockCliente = {
	telefono: '3001234567',
	clienteNombre: 'Juan Pérez',
	direcciones: [],
};

describe('ClientesController (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [ClientesController],
			providers: [{ provide: ClientesService, useValue: mockService }],
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

	// ── GET /clientes ─────────────────────────────────────────────────────────

	describe('GET /clientes', () => {
		it('retorna lista de clientes', async () => {
			mockService.findAll.mockResolvedValue([mockCliente]);

			const res = await request(app.getHttpServer()).get('/clientes').expect(200);

			expect(res.body).toHaveLength(1);
			expect(mockService.findAll).toHaveBeenCalled();
		});
	});

	// ── GET /clientes/:telefono ───────────────────────────────────────────────

	describe('GET /clientes/:telefono', () => {
		it('retorna el cliente por teléfono', async () => {
			mockService.findOne.mockResolvedValue(mockCliente);

			const res = await request(app.getHttpServer()).get('/clientes/3001234567').expect(200);

			expect(res.body.telefono).toBe('3001234567');
			expect(mockService.findOne).toHaveBeenCalledWith('3001234567');
		});
	});

	// ── POST /clientes ────────────────────────────────────────────────────────

	describe('POST /clientes', () => {
		it('crea un cliente nuevo', async () => {
			mockService.create.mockResolvedValue(mockCliente);

			const res = await request(app.getHttpServer())
				.post('/clientes')
				.send({ telefono: '3001234567', clienteNombre: 'Juan Pérez' })
				.expect(201);

			expect(res.body.telefono).toBe('3001234567');
			expect(mockService.create).toHaveBeenCalled();
		});
	});

	// ── PATCH /clientes/:telefono ─────────────────────────────────────────────

	describe('PATCH /clientes/:telefono', () => {
		it('actualiza el cliente', async () => {
			const updated = { ...mockCliente, clienteNombre: 'Juan Actualizado' };
			mockService.update.mockResolvedValue({ affected: 1 });

			await request(app.getHttpServer())
				.patch('/clientes/3001234567')
				.send({ clienteNombre: 'Juan Actualizado' })
				.expect(200);

			expect(mockService.update).toHaveBeenCalledWith('3001234567', expect.objectContaining({ clienteNombre: 'Juan Actualizado' }));
		});
	});

	// ── DELETE /clientes/:telefono ────────────────────────────────────────────

	describe('DELETE /clientes/:telefono', () => {
		it('elimina el cliente', async () => {
			mockService.remove.mockResolvedValue({ affected: 1 });

			const res = await request(app.getHttpServer()).delete('/clientes/3001234567').expect(200);

			expect(res.body.affected).toBe(1);
			expect(mockService.remove).toHaveBeenCalledWith('3001234567');
		});
	});

	// ── GET /clientes/:telefono/direcciones ───────────────────────────────────

	describe('GET /clientes/:telefono/direcciones', () => {
		it('retorna las direcciones del cliente', async () => {
			const dirs = [{ id: 1, direccion: 'Calle 10' }];
			mockService.getDirecciones.mockResolvedValue(dirs);

			const res = await request(app.getHttpServer()).get('/clientes/3001234567/direcciones').expect(200);

			expect(res.body).toHaveLength(1);
			expect(mockService.getDirecciones).toHaveBeenCalledWith('3001234567');
		});
	});

	// ── POST /clientes/:telefono/direcciones ──────────────────────────────────

	describe('POST /clientes/:telefono/direcciones', () => {
		it('agrega una dirección al cliente', async () => {
			const dir = { id: 2, telefonoCliente: '3001234567', direccion: 'Calle 20' };
			mockService.addDireccion.mockResolvedValue(dir);

			const res = await request(app.getHttpServer())
				.post('/clientes/3001234567/direcciones')
				.send({ direccion: 'Calle 20' })
				.expect(201);

			expect(res.body.direccion).toBe('Calle 20');
			expect(mockService.addDireccion).toHaveBeenCalledWith('3001234567', 'Calle 20');
		});
	});

	// ── DELETE /clientes/direcciones/:id ─────────────────────────────────────

	describe('DELETE /clientes/direcciones/:id', () => {
		it('elimina la dirección por id', async () => {
			mockService.removeDireccion.mockResolvedValue({ affected: 1 });

			const res = await request(app.getHttpServer()).delete('/clientes/direcciones/5').expect(200);

			expect(res.body.affected).toBe(1);
			expect(mockService.removeDireccion).toHaveBeenCalledWith(5);
		});
	});
});
