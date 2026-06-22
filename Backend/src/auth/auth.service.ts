import {BadRequestException, Injectable, NotFoundException, UnauthorizedException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import * as bcrypt from 'bcrypt';
import {JwtService} from '@nestjs/jwt';
import {ConfigService} from '@nestjs/config';
import {User} from './esquemas/user.entity';
import {Domiciliarios} from '../domiciliarios/esquemas/domiciliarios.entity';
import {Clientes} from '../clientes/esquemas/clientes.entity';
import {LoginDto} from './dto/login.dto';
import {RegisterDto} from './dto/register.dto';
import {LoginClienteDto} from './dto/login-cliente.dto';
import {RegisterClienteDto} from './dto/register-cliente.dto';
import {Role} from './roles.enum';
import {AuthResponseDto} from './dto/auth-response.dto';
import {JwtPayload} from './types/jwt-payload.type';

@Injectable()
export class AuthService {
	constructor(
		@InjectRepository(User) private readonly usersRepository: Repository<User>,
		@InjectRepository(Domiciliarios) private readonly domiciliariosRepository: Repository<Domiciliarios>,
		@InjectRepository(Clientes) private readonly clientesRepository: Repository<Clientes>,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
	) {}

	async findAll(): Promise<User[]> {
		return this.usersRepository.find({
			select: ['id', 'username', 'name', 'roles', 'createdAt'],
			order: {createdAt: 'DESC'},
		});
	}

	async register(dto: RegisterDto): Promise<AuthResponseDto> {
		return this.usersRepository.manager.transaction(async (manager) => {
			const uRepo = manager.getRepository(User);
			const dRepo = manager.getRepository(Domiciliarios);

			const isDomiciliario = dto.roles?.some((role) => role === Role.Domiciliario);

			if (isDomiciliario && !dto.telefono) {
				throw new BadRequestException('El número de teléfono es obligatorio para registrar un domiciliario.');
			}

			if (isDomiciliario && dto.telefono) {
				const existingDom = await dRepo.findOne({where: {telefono: dto.telefono}});
				if (existingDom) {
					throw new BadRequestException('Este número de teléfono ya pertenece a un domiciliario registrado.');
				}
			}

			const existing = await uRepo.findOne({where: {username: dto.username}});
			if (existing) {
				throw new BadRequestException('Username ya registrado');
			}

			const hash = await bcrypt.hash(dto.password, 12); // Factor 12 es más balanceado

			if (dto.roles?.some((role) => role === Role.Admin)) {
				throw new BadRequestException(
					'No se permite la creación de usuarios con rol Administrador desde este endpoint.',
				);
			}

			const roles = dto.roles && dto.roles.length > 0 ? dto.roles : [Role.Mesero];

			const user = uRepo.create({
				username: dto.username,
				name: dto.name,
				passwordHash: hash,
				roles,
			});
			const saved = await uRepo.save(user);

			if (isDomiciliario && dto.telefono) {
				const domiciliario = dRepo.create({
					telefono: dto.telefono,
					domiciliarioNombre: dto.name || dto.username,
					userId: saved.id,
				});
				await dRepo.save(domiciliario);
			}

			return this.toAuthResponse(saved);
		});
	}

	async updateUser(
		id: string,
		dto: {name?: string; username?: string; password?: string},
	): Promise<{id: string; username: string; name?: string; roles: Role[]}> {
		const user = await this.usersRepository.findOne({
			where: {id},
			select: ['id', 'username', 'name', 'passwordHash', 'roles'],
		});
		if (!user) throw new NotFoundException('Usuario no encontrado');

		if (dto.username && dto.username !== user.username) {
			const existing = await this.usersRepository.findOne({where: {username: dto.username}});
			if (existing) throw new BadRequestException('El nombre de usuario ya está en uso');
			user.username = dto.username;
		}

		if (dto.name !== undefined) {
			user.name = dto.name;
			// Sync domiciliario name if applicable
			const dom = await this.domiciliariosRepository.findOne({where: {userId: id}});
			if (dom) {
				dom.domiciliarioNombre = dto.name;
				await this.domiciliariosRepository.save(dom);
			}
		}

		if (dto.password) {
			user.passwordHash = await bcrypt.hash(dto.password, 12);
		}

		const saved = await this.usersRepository.save(user);
		return {id: saved.id, username: saved.username, name: saved.name, roles: saved.roles};
	}

	async login(dto: LoginDto): Promise<AuthResponseDto> {
		const user = await this.usersRepository.findOne({
			where: {username: dto.username},
			select: ['id', 'username', 'name', 'passwordHash', 'roles', 'createdAt', 'updatedAt'],
		});
		if (!user) {
			throw new UnauthorizedException('Credenciales inválidas');
		}

		const valid = await bcrypt.compare(dto.password, user.passwordHash);
		if (!valid) {
			throw new UnauthorizedException('Credenciales inválidas');
		}

		return this.toAuthResponse(user);
	}

	async refreshToken(token: string): Promise<AuthResponseDto> {
		try {
			const payload = this.jwtService.verify(token);

			// Si es un cliente
			if (payload.roles?.includes(Role.Cliente)) {
				const cliente = await this.clientesRepository.findOne({
					where: {telefono: payload.sub},
				});
				if (!cliente || !cliente.password) throw new UnauthorizedException('Usuario no encontrado');
				return this.toClienteAuthResponse(cliente);
			}

			// Si es un admin/empleado
			const user = await this.usersRepository.findOne({
				where: {id: payload.sub},
				select: ['id', 'username', 'name', 'passwordHash', 'roles', 'createdAt', 'updatedAt'],
			});
			if (!user) {
				throw new UnauthorizedException('Usuario no encontrado');
			}
			return this.toAuthResponse(user);
		} catch (error) {
			throw new UnauthorizedException('Refresh token inválido o expirado');
		}
	}

	async registerCliente(dto: RegisterClienteDto): Promise<AuthResponseDto> {
		const existing = await this.clientesRepository.findOne({where: {telefono: dto.telefono}});
		if (existing && existing.password) {
			throw new BadRequestException('Este número de teléfono ya está registrado');
		}

		const hash = await bcrypt.hash(dto.password, 12);

		let cliente = existing;
		if (!cliente) {
			cliente = this.clientesRepository.create({
				telefono: dto.telefono,
				clienteNombre: dto.clienteNombre,
				password: hash,
			});
		} else {
			cliente.password = hash;
			if (dto.clienteNombre) {
				cliente.clienteNombre = dto.clienteNombre;
			}
		}

		await this.clientesRepository.save(cliente);

		return this.toClienteAuthResponse(cliente);
	}

	async loginCliente(dto: LoginClienteDto): Promise<AuthResponseDto> {
		const cliente = await this.clientesRepository.findOne({
			where: {telefono: dto.telefono},
		});

		if (!cliente || !cliente.password) {
			throw new UnauthorizedException('Credenciales inválidas o el usuario no está registrado');
		}

		const valid = await bcrypt.compare(dto.password, cliente.password);
		if (!valid) {
			throw new UnauthorizedException('Credenciales inválidas');
		}

		return this.toClienteAuthResponse(cliente);
	}

	toClienteAuthResponse(cliente: Clientes): AuthResponseDto {
		const payload: JwtPayload = {
			sub: cliente.telefono,
			username: cliente.clienteNombre || cliente.telefono,
			roles: [Role.Cliente],
		};
		const accessToken = this.jwtService.sign(payload);
		const refreshToken = this.jwtService.sign(payload, {expiresIn: '30d'});
		return {
			id: cliente.telefono,
			username: cliente.telefono,
			name: cliente.clienteNombre,
			roles: [Role.Cliente],
			accessToken,
			refreshToken,
		};
	}

	toAuthResponse(user: User): AuthResponseDto {
		const payload: JwtPayload = {
			sub: user.id,
			username: user.username,
			roles: user.roles,
		};
		const accessToken = this.jwtService.sign(payload);
		const refreshToken = this.jwtService.sign(payload, {expiresIn: '7d'});
		return {
			id: user.id,
			username: user.username,
			name: user.name,
			roles: user.roles,
			accessToken,
			refreshToken,
		};
	}
}
