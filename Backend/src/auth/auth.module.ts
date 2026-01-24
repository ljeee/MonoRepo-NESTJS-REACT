import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {JwtModule} from '@nestjs/jwt';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {APP_GUARD} from '@nestjs/core';
import {AuthService} from './auth.service';
import {AuthController} from './auth.controller';
import {User} from './esquemas/user.entity';
import {JwtStrategy} from './strategies/jwt.strategy';
import {JwtAuthGuard} from './guards/jwt-auth.guard';
import {RolesGuard} from './guards/roles.guard';

@Module({
	imports: [
		ConfigModule,
		TypeOrmModule.forFeature([User]),
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				secret: configService.get<string>('JWT_SECRET', 'change-me'),
				signOptions: {
					expiresIn: parseInt(configService.get<string>('JWT_EXPIRES_IN', '28800'), 10), // 8 hours in seconds
				},
			}),
		}),
	],
	controllers: [AuthController],
	providers: [
		AuthService,
		JwtStrategy,
		// Temporarily disabled global auth guards until frontend implements authentication
		// {provide: APP_GUARD, useClass: JwtAuthGuard},
		// {provide: APP_GUARD, useClass: RolesGuard},
	],
	exports: [AuthService],
})
export class AuthModule {}
