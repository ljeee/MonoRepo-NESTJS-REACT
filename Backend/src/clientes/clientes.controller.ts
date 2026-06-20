import {Controller, Get, Post, Delete, Param, Body, Patch} from "@nestjs/common";
import {ApiTags, ApiOperation, ApiResponse} from '@nestjs/swagger';
import {ClientesService} from "./clientes.service";
import {CreateClientesDto} from "./esquemas/clientes.dto";
import {Public} from '../auth/decorators/public.decorator';
import {UseGuards} from '@nestjs/common';
import {JwtAuthGuard} from '../auth/guards/jwt-auth.guard';
import {RolesGuard} from '../auth/guards/roles.guard';
import {Roles} from '../auth/decorators/roles.decorator';
import {Role} from '../auth/roles.enum';
import {ApiBearerAuth} from '@nestjs/swagger';

@Public()
@ApiTags('Clientes')
@Controller("clientes")
export class ClientesController {
	constructor(private readonly service: ClientesService) {}

	@Get()
	@ApiOperation({ summary: 'Obtener todos los clientes' })
	@ApiResponse({ status: 200, description: 'Lista de clientes con sus direcciones.' })
	findAll() {
		return this.service.findAll();
	}

	@Get(":telefono")
	@ApiOperation({ summary: 'Obtener un cliente por teléfono' })
	@ApiResponse({ status: 200, description: 'Cliente encontrado.' })
	findOne(@Param("telefono") telefono: string) {
		return this.service.findOne(telefono);
	}

	@Post()
	@ApiOperation({ summary: 'Crear un cliente' })
	@ApiResponse({ status: 201, description: 'Cliente creado.' })
	create(@Body() dto: CreateClientesDto) {
		return this.service.create(dto);
	}

	@Patch(":telefono")
	@ApiOperation({ summary: 'Actualizar un cliente' })
	@ApiResponse({ status: 200, description: 'Cliente actualizado.' })
	update(@Param("telefono") telefono: string, @Body() dto: Partial<CreateClientesDto>) {
		return this.service.update(telefono, dto);
	}

	@Delete(":telefono")
	@ApiOperation({ summary: 'Eliminar un cliente' })
	@ApiResponse({ status: 200, description: 'Cliente eliminado.' })
	remove(@Param("telefono") telefono: string) {
		return this.service.remove(telefono);
	}

	// ─── Direcciones ──────────────────────────────────────────────

	@Get(":telefono/direcciones")
	@ApiOperation({ summary: 'Obtener direcciones de un cliente (más recientes primero)' })
	getDirecciones(@Param("telefono") telefono: string) {
		return this.service.getDirecciones(telefono);
	}

	@Post(":telefono/direcciones")
	@ApiOperation({ summary: 'Agregar dirección a un cliente (auto-deduplica)' })
	addDireccion(
		@Param("telefono") telefono: string, 
		@Body() dto: {direccion: string; referencia?: string; costoDomicilio?: number; latitud?: number; longitud?: number}
	) {
		return this.service.addDireccion(telefono, dto);
	}

	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.Admin, Role.Cajero)
	@Post(":telefono/reset-password")
	@ApiOperation({ summary: 'Restablecer contraseña del cliente por parte del administrador' })
	@ApiResponse({ status: 200, description: 'Contraseña restablecida correctamente.' })
	resetPassword(
		@Param("telefono") telefono: string, 
		@Body('newPassword') newPassword?: string
	) {
		return this.service.resetPassword(telefono, newPassword);
	}

	@Delete("direcciones/:id")
	@ApiOperation({ summary: 'Eliminar una dirección' })
	removeDireccion(@Param("id") id: number) {
		return this.service.removeDireccion(id);
	}
}
