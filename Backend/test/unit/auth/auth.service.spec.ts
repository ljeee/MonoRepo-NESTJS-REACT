import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../../src/auth/auth.service';
import { User } from '../../../src/auth/esquemas/user.entity';
import { Domiciliarios } from '../../../src/domiciliarios/esquemas/domiciliarios.entity';
import { Clientes } from '../../../src/clientes/esquemas/clientes.entity';
import { Role } from '../../../src/auth/roles.enum';

jest.mock('bcrypt', () => ({
	hash: jest.fn(),
	compare: jest.fn(),
}));

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
	let service: AuthService;
	let mockUsersRepo: any;
	let mockDomiciliariosRepo: any;
	let mockClientesRepo: any;
	let mockJwtService: any;

	const mockUser: Partial<User> = {
		id: 'uuid-test-1',
		username: 'testuser',
		name: 'Test User',
		passwordHash: '$2b$12$hashedpassword',
		roles: [Role.Mesero],
		createdAt: new Date('2024-01-01'),
		updatedAt: new Date('2024-01-01'),
	};

	beforeEach(async () => {
		mockUsersRepo = {
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			manager: { transaction: jest.fn() },
		};

		mockDomiciliariosRepo = {
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
		};

		mockClientesRepo = {
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
		};

		mockJwtService = {
			sign: jest.fn().mockReturnValue('fake-jwt-token'),
			verify: jest.fn().mockReturnValue({ sub: 'uuid-test-1', username: 'testuser', roles: [Role.Mesero] }),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				{ provide: getRepositoryToken(User), useValue: mockUsersRepo },
				{ provide: getRepositoryToken(Domiciliarios), useValue: mockDomiciliariosRepo },
				{ provide: getRepositoryToken(Clientes), useValue: mockClientesRepo },
				{ provide: JwtService, useValue: mockJwtService },
				{ provide: ConfigService, useValue: { get: jest.fn() } },
			],
		}).compile();

		service = module.get<AuthService>(AuthService);
		jest.clearAllMocks();
		mockJwtService.sign.mockReturnValue('fake-jwt-token');
	});

	// ==================== login ====================

	describe('login', () => {
		it('retorna tokens cuando las credenciales son válidas', async () => {
			mockUsersRepo.findOne.mockResolvedValue(mockUser);
			(mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

			const result = await service.login({ username: 'testuser', password: 'password123' });

			expect(result.accessToken).toBe('fake-jwt-token');
			expect(result.username).toBe('testuser');
			expect(result.id).toBe(mockUser.id);
		});

		it('lanza UnauthorizedException si el usuario no existe', async () => {
			mockUsersRepo.findOne.mockResolvedValue(null);

			await expect(
				service.login({ username: 'noexiste', password: 'pass1234' }),
			).rejects.toThrow(UnauthorizedException);
		});

		it('lanza UnauthorizedException si la contraseña es incorrecta', async () => {
			mockUsersRepo.findOne.mockResolvedValue(mockUser);
			(mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

			await expect(
				service.login({ username: 'testuser', password: 'wrongpass' }),
			).rejects.toThrow(UnauthorizedException);
		});

		it('usa el mismo mensaje de error para usuario inexistente y contraseña incorrecta', async () => {
			mockUsersRepo.findOne.mockResolvedValue(null);
			const err1: any = await service.login({ username: 'x', password: 'pass1234' }).catch((e) => e);

			mockUsersRepo.findOne.mockResolvedValue(mockUser);
			(mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);
			const err2: any = await service.login({ username: 'testuser', password: 'wrong' }).catch((e) => e);

			expect(err1.message).toBe(err2.message);
		});

		it('consulta el repositorio con el username proporcionado', async () => {
			mockUsersRepo.findOne.mockResolvedValue(null);

			await service.login({ username: 'buscame', password: 'pass1234' }).catch(() => {});

			expect(mockUsersRepo.findOne).toHaveBeenCalledWith(
				expect.objectContaining({ where: { username: 'buscame' } }),
			);
		});
	});

	// ==================== register ====================

	describe('register', () => {
		const setupTransaction = (existingUser: any = null, existingDom: any = null) => {
			const uRepo = {
				findOne: jest.fn().mockResolvedValue(existingUser),
				create: jest.fn().mockReturnValue(mockUser),
				save: jest.fn().mockResolvedValue(mockUser),
			};
			const dRepo = {
				findOne: jest.fn().mockResolvedValue(existingDom),
				create: jest.fn().mockReturnValue({}),
				save: jest.fn().mockResolvedValue({}),
			};
			mockUsersRepo.manager.transaction.mockImplementation(async (cb: Function) =>
				cb({
					getRepository: jest.fn()
						.mockReturnValueOnce(uRepo)
						.mockReturnValueOnce(dRepo),
				}),
			);
			(mockedBcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hashed');
			return { uRepo, dRepo };
		};

		it('crea un usuario mesero exitosamente', async () => {
			const { uRepo } = setupTransaction(null, null);

			const result = await service.register({
				username: 'nuevousuario',
				password: 'password123',
				name: 'Nuevo User',
				roles: [Role.Mesero],
			});

			expect(uRepo.save).toHaveBeenCalled();
			expect(result.accessToken).toBe('fake-jwt-token');
		});

		it('asigna rol mesero por defecto si no se especifica roles', async () => {
			const { uRepo } = setupTransaction(null, null);

			await service.register({ username: 'sinrol', password: 'password123', name: 'Sin Rol' });

			const createArgs = uRepo.create.mock.calls[0][0];
			expect(createArgs.roles).toContain(Role.Mesero);
		});

		it('lanza BadRequestException si el username ya existe', async () => {
			setupTransaction(mockUser, null);

			await expect(
				service.register({ username: 'testuser', password: 'password123', name: 'Dup' }),
			).rejects.toThrow(BadRequestException);
		});

		it('no permite crear usuarios con rol admin', async () => {
			setupTransaction(null, null);

			await expect(
				service.register({ username: 'badmin', password: 'password123', name: 'Bad', roles: [Role.Admin] }),
			).rejects.toThrow(BadRequestException);
		});

		it('requiere teléfono para usuarios con rol domiciliario', async () => {
			setupTransaction(null, null);

			await expect(
				service.register({ username: 'rider', password: 'password123', name: 'Rider', roles: [Role.Domiciliario] }),
			).rejects.toThrow(BadRequestException);
		});

		it('lanza BadRequestException si el teléfono del domiciliario ya está registrado', async () => {
			const existingDom = { telefono: '3001234567' };
			setupTransaction(null, existingDom);

			await expect(
				service.register({
					username: 'rider2',
					password: 'password123',
					name: 'Rider',
					roles: [Role.Domiciliario],
					telefono: '3001234567',
				}),
			).rejects.toThrow(BadRequestException);
		});

		it('crea entrada de domiciliario al registrar usuario con ese rol', async () => {
			const { dRepo } = setupTransaction(null, null);

			await service.register({
				username: 'rider3',
				password: 'password123',
				name: 'Rider Three',
				roles: [Role.Domiciliario],
				telefono: '3109999999',
			});

			expect(dRepo.save).toHaveBeenCalled();
		});

		it('hashea la contraseña antes de guardar', async () => {
			const { uRepo } = setupTransaction(null, null);

			await service.register({ username: 'hashtest', password: 'mipass123', name: 'Hash' });

			const createArgs = uRepo.create.mock.calls[0][0];
			expect(createArgs.passwordHash).toBe('$2b$12$hashed');
			expect(createArgs.passwordHash).not.toBe('mipass123');
		});
	});

	// ==================== refreshToken ====================

	describe('refreshToken', () => {
		it('retorna nuevos tokens con un refresh token válido', async () => {
			mockJwtService.verify.mockReturnValue({ sub: 'uuid-test-1', username: 'testuser', roles: [Role.Mesero] });
			mockUsersRepo.findOne.mockResolvedValue(mockUser);

			const result = await service.refreshToken('valid-refresh-token');

			expect(result.accessToken).toBe('fake-jwt-token');
			expect(result.username).toBe('testuser');
		});

		it('lanza UnauthorizedException con un token inválido', async () => {
			mockJwtService.verify.mockImplementation(() => {
				throw new Error('invalid token');
			});

			await expect(service.refreshToken('bad-token')).rejects.toThrow(UnauthorizedException);
		});

		it('lanza UnauthorizedException si el usuario del token fue eliminado', async () => {
			mockJwtService.verify.mockReturnValue({ sub: 'deleted-id', username: 'gone', roles: [] });
			mockUsersRepo.findOne.mockResolvedValue(null);

			await expect(service.refreshToken('orphan-token')).rejects.toThrow(UnauthorizedException);
		});
	});

	// ==================== toAuthResponse ====================

	describe('toAuthResponse', () => {
		it('genera access y refresh tokens', () => {
			service.toAuthResponse(mockUser as User);

			expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
		});

		it('incluye los datos del usuario en la respuesta', () => {
			const result = service.toAuthResponse(mockUser as User);

			expect(result.id).toBe(mockUser.id);
			expect(result.username).toBe(mockUser.username);
			expect(result.name).toBe(mockUser.name);
			expect(result.roles).toEqual(mockUser.roles);
		});

		it('firma el refresh token con expiración de 7 días', () => {
			service.toAuthResponse(mockUser as User);

			const secondCall = mockJwtService.sign.mock.calls[1];
			expect(secondCall[1]).toEqual(expect.objectContaining({ expiresIn: '7d' }));
		});
	});

	// ==================== findAll ====================

	describe('findAll', () => {
		it('retorna todos los usuarios sin contraseñas', async () => {
			const users = [mockUser, { ...mockUser, id: 'uuid-2', username: 'otro' }];
			mockUsersRepo.find.mockResolvedValue(users);

			const result = await service.findAll();

			expect(result).toEqual(users);
			expect(mockUsersRepo.find).toHaveBeenCalledWith(
				expect.objectContaining({ select: expect.arrayContaining(['id', 'username']) }),
			);
		});
	});
});
