import {Injectable, UnauthorizedException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {PassportStrategy} from '@nestjs/passport';
import {InjectRepository} from '@nestjs/typeorm';
import {ExtractJwt, Strategy} from 'passport-jwt';
import {Repository} from 'typeorm';
import {User} from '../esquemas/user.entity';
import {JwtPayload} from '../types/jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		configService: ConfigService,
		@InjectRepository(User) private readonly usersRepository: Repository<User>,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: configService.get<string>('JWT_SECRET', 'change-me'),
		});
	}

	async validate(payload: JwtPayload): Promise<User> {
		const user = await this.usersRepository.findOne({where: {id: payload.sub}});
		if (!user) {
			throw new UnauthorizedException('User not found');
		}
		return user;
	}
}
