import {Controller, Get, Post, Delete, Param, Body, Patch, Query, ForbiddenException} from '@nestjs/common';
import {Roles} from '../auth/decorators/roles.decorator';
import {Role} from '../auth/roles.enum';
import {ApiTags, ApiOperation, ApiResponse} from '@nestjs/swagger';
import {DomiciliosService} from './domicilios.service';
import {CreateDomiciliosDto} from './esquemas/domicilios.dto';
import {GetUser} from '../auth/decorators/get-user.decorator';
import {User} from '../auth/esquemas/user.entity';

@ApiTags('Domicilios')
@Controller('domicilios')
export class DomiciliosController {
	constructor(private readonly service: DomiciliosService) {}

	@Get('me')
	@ApiOperation({summary: 'Obtener domicilios asignados al usuario actual'})
	findMe(@GetUser() user: User, @Query('all') all?: string) {
		return this.service.findByUser(user.username, all === 'true');
	}

	@Roles(Role.Admin, Role.Cajero, Role.Mesero)
	@Get()
	@ApiOperation({summary: 'Obtener todos los domicilios'})
	@ApiResponse({status: 200, description: 'Lista de domicilios.'})
	findAll() {
		return this.service.findAll();
	}
	@Roles(Role.Admin, Role.Cajero, Role.Mesero)
	@Get('dia')
	@ApiOperation({summary: 'Obtener domicilios del día actual'})
	@ApiResponse({status: 200, description: 'Lista de domicilios del día.'})
	findByDay() {
		return this.service.findByDay();
	}

	@Roles(Role.Admin, Role.Cajero, Role.Mesero)
	@Get('dia/pendientes')
	@ApiOperation({summary: 'Obtener domicilios pendientes del día actual'})
	@ApiResponse({status: 200, description: 'Lista de domicilios pendientes del día.'})
	findPendingByDay() {
		return this.service.findPendingByDay();
	}

	@Roles(Role.Admin, Role.Cajero, Role.Mesero)
	@Get('sin-asignar')
	@ApiOperation({summary: 'Obtener domicilios del día actual sin domiciliario asignado'})
	@ApiResponse({status: 200, description: 'Lista de domicilios sin domiciliario.'})
	findSinAsignar() {
		return this.service.findSinAsignarHoy();
	}

	@Roles(Role.Admin, Role.Cajero, Role.Mesero)
	@Get(':id')
	@ApiOperation({summary: 'Obtener un domicilio por ID'})
	@ApiResponse({status: 200, description: 'Domicilio encontrado.'})
	findOne(@Param('id') id: number) {
		return this.service.findOne(id);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Post()
	@ApiOperation({summary: 'Crear un domicilio'})
	@ApiResponse({status: 201, description: 'Domicilio creado.'})
	create(@Body() dto: CreateDomiciliosDto) {
		return this.service.create(dto);
	}

	@Roles(Role.Admin, Role.Cajero, Role.Domiciliario)
	@Patch(':id')
	@ApiOperation({summary: 'Actualizar un domicilio'})
	@ApiResponse({status: 200, description: 'Domicilio actualizado.'})
	async update(@Param('id') id: number, @Body() dto: Partial<CreateDomiciliosDto>, @GetUser() user: User) {
		const esDespacho = (user.roles ?? []).some((r) => r === Role.Admin || r === Role.Cajero);
		if (esDespacho) return this.service.update(id, dto);

		// Un domiciliario solo marca el estado de SUS entregas: no reasigna, no cambia dirección ni costo,
		// y no toca los domicilios de otro repartidor (user.username = teléfono, igual que /domicilios/me).
		const domicilio = await this.service.findOne(id);
		if (domicilio.telefonoDomiciliarioAsignado !== user.username) {
			throw new ForbiddenException('Este domicilio no está asignado a ti');
		}
		if (dto.estadoDomicilio === undefined) {
			throw new ForbiddenException('Solo puedes actualizar el estado de tus entregas');
		}
		return this.service.update(id, {estadoDomicilio: dto.estadoDomicilio});
	}

	@Roles(Role.Admin, Role.Cajero)
	@Delete(':id')
	@ApiOperation({summary: 'Eliminar un domicilio'})
	@ApiResponse({status: 200, description: 'Domicilio eliminado.'})
	remove(@Param('id') id: number) {
		return this.service.remove(id);
	}
}
