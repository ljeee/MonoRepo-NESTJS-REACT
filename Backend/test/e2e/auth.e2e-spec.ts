import {Test, TestingModule} from '@nestjs/testing';
import {INestApplication, ValidationPipe} from '@nestjs/common';
import request from 'supertest';
import {AuthController} from '../../src/auth/auth.controller';
import {AuthService} from '../../src/auth/auth.service';
import {JwtAuthGuard} from '../../src/auth/guards/jwt-auth.guard';
import {RolesGuard} from '../../src/auth/guards/roles.guard';
import {Role} from '../../src/auth/roles.enum';

const mockAuthService = {
	login: jest.fn(),
	register: jest.fn(),
	refreshToken: jest.fn(),
	toAuthResponse: jest.fn(),
	findAll: jest.fn(),
};

const mockAuthResponse = {
	id: 'uuid-test-1',
	username: 'testuser',
	name: 'Test User',
	roles: [Role.Cajero],
	accessToken: 'jwt-access-token',
	refreshToken: 'jwt-refresh-token',
};

describe('AuthController (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			controllers: [AuthController],
			providers: [{provide: AuthService, useValue: mockAuthService}],
		})
			.overrideGuard(JwtAuthGuard)
			.useValue({canActivate: () => true})
			.overrideGuard(RolesGuard)
			.useValue({canActivate: () => true})
			.compile();

		app = moduleFixture.createNestApplication();

		// Inyectar usuario para endpoints protegidos (@GetUser)
		app.use((req: any, _res: any, next: () => void) => {
			req.user = {id: 'uuid-test-1', username: 'testuser', roles: [Role.Admin]};
			next();
		});

		app.useGlobalPipes(
			new ValidationPipe({whitelist: true, transform: true, transformOptions: {enableImplicitConversion: true}}),
		);

		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	// ==================== POST /auth/login ====================

	describe('POST /auth/login', () => {
		it('retorna 201 con tokens cuando las credenciales son válidas', async () => {
			mockAuthService.login.mockResolvedValue(mockAuthResponse);

			const res = await request(app.getHttpServer())
				.post('/auth/login')
				.send({username: 'testuser', password: 'password123'})
				.expect(201);

			expect(res.body).toMatchObject({accessToken: 'jwt-access-token', username: 'testuser'});
			expect(mockAuthService.login).toHaveBeenCalledWith({
				username: 'testuser',
				password: 'password123',
			});
		});

		it('retorna 400 cuando falta el username', async () => {
			await request(app.getHttpServer()).post('/auth/login').send({password: 'password123'}).expect(400);
		});

		it('retorna 400 cuando la contraseña tiene menos de 8 caracteres', async () => {
			await request(app.getHttpServer())
				.post('/auth/login')
				.send({username: 'testuser', password: 'corto'})
				.expect(400);
		});

		it('retorna 401 cuando las credenciales son inválidas', async () => {
			const {UnauthorizedException} = await import('@nestjs/common');
			mockAuthService.login.mockRejectedValue(new UnauthorizedException('Credenciales inválidas'));

			await request(app.getHttpServer())
				.post('/auth/login')
				.send({username: 'baduser', password: 'wrongpass1'})
				.expect(401);
		});
	});

	// ==================== POST /auth/refresh ====================

	describe('POST /auth/refresh', () => {
		it('retorna 201 con nuevos tokens dado un refresh token válido', async () => {
			mockAuthService.refreshToken.mockResolvedValue(mockAuthResponse);

			const res = await request(app.getHttpServer())
				.post('/auth/refresh')
				.send({refreshToken: 'valid-refresh-token'})
				.expect(201);

			expect(res.body).toMatchObject({accessToken: 'jwt-access-token'});
			expect(mockAuthService.refreshToken).toHaveBeenCalledWith('valid-refresh-token');
		});

		it('retorna 401 con un refresh token expirado', async () => {
			const {UnauthorizedException} = await import('@nestjs/common');
			mockAuthService.refreshToken.mockRejectedValue(
				new UnauthorizedException('Refresh token inválido o expirado'),
			);

			await request(app.getHttpServer()).post('/auth/refresh').send({refreshToken: 'expired-token'}).expect(401);
		});
	});

	// ==================== GET /auth/me ====================

	describe('GET /auth/me', () => {
		it('retorna 200 con los datos del usuario autenticado', async () => {
			mockAuthService.toAuthResponse.mockReturnValue(mockAuthResponse);

			const res = await request(app.getHttpServer()).get('/auth/me').expect(200);

			expect(res.body).toMatchObject({username: 'testuser'});
			expect(mockAuthService.toAuthResponse).toHaveBeenCalledWith(expect.objectContaining({id: 'uuid-test-1'}));
		});
	});

	// ==================== GET /auth/users ====================

	describe('GET /auth/users', () => {
		it('retorna 200 con lista de usuarios', async () => {
			const users = [
				{id: 'uuid-1', username: 'admin', roles: [Role.Admin]},
				{id: 'uuid-2', username: 'cajero', roles: [Role.Cajero]},
			];
			mockAuthService.findAll.mockResolvedValue(users);

			const res = await request(app.getHttpServer()).get('/auth/users').expect(200);

			expect(Array.isArray(res.body)).toBe(true);
			expect(res.body).toHaveLength(2);
		});
	});

	// ==================== POST /auth/register ====================

	describe('POST /auth/register', () => {
		it('retorna 201 al registrar un nuevo usuario', async () => {
			mockAuthService.register.mockResolvedValue(mockAuthResponse);

			const res = await request(app.getHttpServer())
				.post('/auth/register')
				.send({username: 'nuevousuario', password: 'password123', name: 'Nuevo', roles: [Role.Mesero]})
				.expect(201);

			expect(res.body).toMatchObject({username: 'testuser'});
			expect(mockAuthService.register).toHaveBeenCalledWith(expect.objectContaining({username: 'nuevousuario'}));
		});

		it('retorna 400 cuando la contraseña es demasiado corta', async () => {
			await request(app.getHttpServer())
				.post('/auth/register')
				.send({username: 'usuario', password: 'corta', name: 'Nombre'})
				.expect(400);
		});

		it('retorna 400 si el username ya existe', async () => {
			const {BadRequestException} = await import('@nestjs/common');
			mockAuthService.register.mockRejectedValue(new BadRequestException('Username ya registrado'));

			await request(app.getHttpServer())
				.post('/auth/register')
				.send({username: 'duplicado', password: 'password123', name: 'Dup'})
				.expect(400);
		});
	});
});
