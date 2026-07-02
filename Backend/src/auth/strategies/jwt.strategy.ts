import {Injectable, UnauthorizedException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {PassportStrategy} from '@nestjs/passport';
import {InjectRepository} from '@nestjs/typeorm';
import {ExtractJwt, Strategy} from 'passport-jwt';
import {Repository} from 'typeorm';
import {Clientes} from '../../clientes/esquemas/clientes.entity';
import {User} from '../esquemas/user.entity';
import {Role} from '../roles.enum';
import {JwtPayload} from '../types/jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		configService: ConfigService,
		@InjectRepository(User) private readonly usersRepository: Repository<User>,
		@InjectRepository(Clientes) private readonly clientesRepository: Repository<Clientes>,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: configService.get<string>('JWT_SECRET', 'change-me'),
		});
	}

	async validate(payload: JwtPayload): Promise<User> {
		// Tokens de cliente final: sub = teléfono, no existen en la tabla users
		if (payload.roles?.includes(Role.Cliente)) {
			const cliente = await this.clientesRepository.findOne({where: {telefono: payload.sub}});
			if (!cliente) {
				throw new UnauthorizedException('Cliente not found');
			}
			return {
				id: cliente.telefono,
				username: cliente.telefono,
				name: cliente.clienteNombre ?? undefined,
				roles: [Role.Cliente],
			} as User;
		}

		const user = await this.usersRepository.findOne({where: {id: payload.sub}});
		if (!user) {
			throw new UnauthorizedException('User not found');
		}
		return user;
	}
}
