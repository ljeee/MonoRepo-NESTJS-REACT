import {BadRequestException, Injectable, UnauthorizedException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import * as bcrypt from 'bcrypt';
import {JwtService} from '@nestjs/jwt';
import {ConfigService} from '@nestjs/config';
import {User} from './esquemas/user.entity';
import {Domiciliarios} from '../domiciliarios/esquemas/domiciliarios.entity';
import {LoginDto} from './dto/login.dto';
import {RegisterDto} from './dto/register.dto';
import {Role} from './roles.enum';
import {AuthResponseDto} from './dto/auth-response.dto';
import {JwtPayload} from './types/jwt-payload.type';

@Injectable()
export class AuthService {
	constructor(
		@InjectRepository(User) private readonly usersRepository: Repository<User>,
		@InjectRepository(Domiciliarios) private readonly domiciliariosRepository: Repository<Domiciliarios>,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
	) {}

	async findAll(): Promise<User[]> {
		return this.usersRepository.find({
			select: ['id', 'username', 'name', 'roles', 'createdAt'],
			order: { createdAt: 'DESC' }
		});
	}

	async register(dto: RegisterDto): Promise<AuthResponseDto> {
		const isDomiciliario = dto.roles?.some(role => role === Role.Domiciliario);

		if (isDomiciliario && !dto.telefono) {
			throw new BadRequestException('El número de teléfono es obligatorio para registrar un domiciliario.');
		}

		if (isDomiciliario && dto.telefono) {
			const existingDom = await this.domiciliariosRepository.findOne({where: {telefono: dto.telefono}});
			if (existingDom) {
				throw new BadRequestException('Este número de teléfono ya pertenece a un domiciliario registrado.');
			}
		}

		const existing = await this.usersRepository.findOne({where: {username: dto.username}});
		if (existing) {
			throw new BadRequestException('Username ya registrado');
		}

		const hash = await bcrypt.hash(dto.password, 15);
		// Reforzar que NADIE puede crear un admin vía registro público
		if (dto.roles?.some(role => role === Role.Admin)) {
			throw new BadRequestException('No se permite la creación de usuarios con rol Administrador desde este endpoint.');
		}

		const roles = dto.roles && dto.roles.length > 0 ? dto.roles : [Role.Mesero];

		const user = this.usersRepository.create({
			username: dto.username,
			name: dto.name,
			passwordHash: hash,
			roles,
		});
		const saved = await this.usersRepository.save(user);

		if (isDomiciliario && dto.telefono) {
			const domiciliario = this.domiciliariosRepository.create({
				telefono: dto.telefono,
				domiciliarioNombre: dto.name || dto.username,
			});
			await this.domiciliariosRepository.save(domiciliario);
		}

		return this.toAuthResponse(saved);
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

	toAuthResponse(user: User): AuthResponseDto {
		const payload: JwtPayload = {
			sub: user.id,
			username: user.username,
			roles: user.roles,
		};
		const accessToken = this.jwtService.sign(payload);
		const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
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
