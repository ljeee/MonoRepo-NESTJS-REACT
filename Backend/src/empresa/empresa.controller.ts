import {Controller, Get, Patch, Post, Delete, Param, Body, UseGuards} from '@nestjs/common';
import {ApiTags, ApiOperation, ApiBearerAuth} from '@nestjs/swagger';
import {EmpresaService} from './empresa.service';
import {UpdateEmpresaDto} from './esquemas/empresa.dto';
import {JwtAuthGuard} from '../auth/guards/jwt-auth.guard';
import {RolesGuard} from '../auth/guards/roles.guard';
import {Roles} from '../auth/decorators/roles.decorator';
import {Role} from '../auth/roles.enum';
import {Public} from '../auth/decorators/public.decorator';

@ApiTags('Configuración Empresa')
@Controller('empresa')
export class EmpresaController {
	constructor(private readonly service: EmpresaService) {}

	@Get()
	@Public()
	@ApiOperation({summary: 'Obtener datos del perfil del negocio'})
	getConfig() {
		return this.service.getConfig();
	}

	@Patch()
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.Admin)
	@ApiOperation({summary: 'Actualizar perfil del negocio (Solo Admin)'})
	update(@Body() dto: UpdateEmpresaDto) {
		return this.service.updateConfig(dto);
	}

	// ─── Cuentas Transferencia / QR ──────────────────────────────────────────────
	@Get('cuentas-transferencia')
	@Public()
	@ApiOperation({summary: 'Listar cuentas de transferencia/QR'})
	getCuentasTransferencia() {
		return this.service.getCuentasTransferencia(true);
	}

	@Post('cuentas-transferencia')
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.Admin, Role.Cajero)
	@ApiOperation({summary: 'Crear cuenta de transferencia/QR'})
	crearCuentaTransferencia(@Body('nombre') nombre: string) {
		return this.service.crearCuentaTransferencia(nombre);
	}

	@Patch('cuentas-transferencia/:id')
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.Admin, Role.Cajero)
	@ApiOperation({summary: 'Actualizar cuenta de transferencia/QR'})
	actualizarCuentaTransferencia(
		@Param('id') id: string,
		@Body() body: {nombre?: string; activa?: boolean},
	) {
		return this.service.actualizarCuentaTransferencia(Number(id), body);
	}

	@Delete('cuentas-transferencia/:id')
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.Admin)
	@ApiOperation({summary: 'Eliminar cuenta de transferencia/QR'})
	eliminarCuentaTransferencia(@Param('id') id: string) {
		return this.service.eliminarCuentaTransferencia(Number(id));
	}
}
