import {BadRequestException, Injectable, UnauthorizedException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import * as bcrypt from 'bcrypt';
import {JwtService} from '@nestjs/jwt';
import {ConfigService} from '@nestjs/config';
import {User} from './esquemas/user.entity';
import {LoginDto} from './dto/login.dto';
import {RegisterDto} from './dto/register.dto';
import {Role} from './roles.enum';
import {AuthResponseDto} from './dto/auth-response.dto';
import {JwtPayload} from './types/jwt-payload.type';

@Injectable()
export class AuthService {
	constructor(
		@InjectRepository(User) private readonly usersRepository: Repository<User>,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
	) {}

	async register(dto: RegisterDto): Promise<AuthResponseDto> {
		const existing = await this.usersRepository.findOne({where: {username: dto.username}});
		if (existing) {
			throw new BadRequestException('Username ya registrado');
		}

		const hash = await bcrypt.hash(dto.password, 10);
		const roles = dto.roles && dto.roles.length > 0 ? dto.roles : [Role.Mesero];

		const user = this.usersRepository.create({
			username: dto.username,
			name: dto.name,
			passwordHash: hash,
			roles,
		});
		const saved = await this.usersRepository.save(user);
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

	toAuthResponse(user: User): AuthResponseDto {
		const payload: JwtPayload = {
			sub: user.id,
			username: user.username,
			roles: user.roles,
		};
		const accessToken = this.jwtService.sign(payload);
		return {
			id: user.id,
			username: user.username,
			name: user.name,
			roles: user.roles,
			accessToken,
		};
	}
}
