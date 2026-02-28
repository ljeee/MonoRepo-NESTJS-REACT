import {Body, Controller, Get, Post, Request, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiTags} from '@nestjs/swagger';
import {AuthService} from './auth.service';
import {LoginDto} from './dto/login.dto';
import {RegisterDto} from './dto/register.dto';
import {AuthResponseDto} from './dto/auth-response.dto';
import {RefreshTokenDto} from './dto/refresh-token.dto';
import {Public} from './decorators/public.decorator';
import {Roles} from './decorators/roles.decorator';
import {RolesGuard} from './guards/roles.guard';
import {JwtAuthGuard} from './guards/jwt-auth.guard';
import {Role} from './roles.enum';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Public()
	@Post('register')
	async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
		return this.authService.register(dto);
	}

	@Public()
	@Post('login')
	async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
		return this.authService.login(dto);
	}

	@Public()
	@Post('refresh')
	async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
		return this.authService.refreshToken(dto.refreshToken);
	}

	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.Admin, Role.Cocina, Role.Mesero)
	@Get('me')
	async me(@Request() req): Promise<AuthResponseDto> {
		return this.authService.toAuthResponse(req.user);
	}
}
