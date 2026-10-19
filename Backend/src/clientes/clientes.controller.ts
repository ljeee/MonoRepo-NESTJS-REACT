import {Controller, Get, Post, Delete, Param, Body, Patch, Query} from '@nestjs/common';
import {ApiTags, ApiOperation, ApiResponse, ApiQuery} from '@nestjs/swagger';
import {ClientesService} from './clientes.service';
import {CreateClientesDto} from './esquemas/clientes.dto';
import {UseGuards} from '@nestjs/common';
import {JwtAuthGuard} from '../auth/guards/jwt-auth.guard';
import {RolesGuard} from '../auth/guards/roles.guard';
import {Roles} from '../auth/decorators/roles.decorator';
import {Role} from '../auth/roles.enum';
import {ApiBearerAuth} from '@nestjs/swagger';

// Sin @Public: antes la clase entera era pública y eso anulaba hasta los guards de
// reset-password (cualquiera podía fijar la contraseña de un cliente y tomar su cuenta).
// Ahora exige login de staff; el rol cliente lo bloquea ClienteGuard.
@ApiTags('Clientes')
@Controller('clientes')
export class ClientesController {
	constructor(private readonly service: ClientesService) {}

	@Get()
	@ApiOperation({summary: 'Obtener clientes (todos o paginados)'})
	@ApiQuery({name: 'page', required: false, type: Number, description: 'Número de página'})
	@ApiQuery({name: 'limit', required: false, type: Number, description: 'Límite por página (0 o sin enviar para todos)'})
	@ApiQuery({name: 'search', required: false, type: String, description: 'Filtro por nombre, teléfono o documento'})
	@ApiResponse({status: 200, description: 'Lista de clientes con sus direcciones.'})
	findAll(
		@Query('page') page?: string,
		@Query('limit') limit?: string,
		@Query('search') search?: string,
	) {
		const pageNum = page !== undefined ? parseInt(page, 10) : undefined;
		const limitNum = limit !== undefined ? parseInt(limit, 10) : undefined;
		return this.service.findAll(pageNum, limitNum, search);
	}

	@Get(':telefono')
	@ApiOperation({summary: 'Obtener un cliente por teléfono'})
	@ApiResponse({status: 200, description: 'Cliente encontrado.'})
	findOne(@Param('telefono') telefono: string) {
		return this.service.findOne(telefono);
	}

	@Roles(Role.Admin, Role.Cajero, Role.Mesero)
	@Post()
	@ApiOperation({summary: 'Crear un cliente'})
	@ApiResponse({status: 201, description: 'Cliente creado.'})
	create(@Body() dto: CreateClientesDto) {
		return this.service.create(dto);
	}

	@Roles(Role.Admin, Role.Cajero, Role.Mesero)
	@Patch(':telefono')
	@ApiOperation({summary: 'Actualizar un cliente'})
	@ApiResponse({status: 200, description: 'Cliente actualizado.'})
	update(@Param('telefono') telefono: string, @Body() dto: Partial<CreateClientesDto>) {
		return this.service.update(telefono, dto);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Delete(':telefono')
	@ApiOperation({summary: 'Eliminar un cliente'})
	@ApiResponse({status: 200, description: 'Cliente eliminado.'})
	remove(@Param('telefono') telefono: string) {
		return this.service.remove(telefono);
	}

	// ─── Direcciones ──────────────────────────────────────────────

	@Get(':telefono/direcciones')
	@ApiOperation({summary: 'Obtener direcciones de un cliente (más recientes primero)'})
	getDirecciones(@Param('telefono') telefono: string) {
		return this.service.getDirecciones(telefono);
	}

	@Roles(Role.Admin, Role.Cajero, Role.Mesero)
	@Post(':telefono/direcciones')
	@ApiOperation({summary: 'Agregar dirección a un cliente (auto-deduplica)'})
	addDireccion(
		@Param('telefono') telefono: string,
		@Body()
		dto: {direccion: string; referencia?: string; costoDomicilio?: number; latitud?: number; longitud?: number},
	) {
		return this.service.addDireccion(telefono, dto);
	}

	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.Admin, Role.Cajero)
	@Post(':telefono/reset-password')
	@ApiOperation({summary: 'Restablecer contraseña del cliente por parte del administrador'})
	@ApiResponse({status: 200, description: 'Contraseña restablecida correctamente.'})
	resetPassword(@Param('telefono') telefono: string, @Body('newPassword') newPassword?: string) {
		return this.service.resetPassword(telefono, newPassword);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Delete('direcciones/:id')
	@ApiOperation({summary: 'Eliminar una dirección'})
	removeDireccion(@Param('id') id: number) {
		return this.service.removeDireccion(id);
	}
}
