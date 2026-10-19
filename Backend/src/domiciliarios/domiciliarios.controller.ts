import {Controller, Get, Post, Delete, Param, Body, Patch} from '@nestjs/common';
import {ApiTags, ApiOperation, ApiResponse, ApiBearerAuth} from '@nestjs/swagger';
import {DomiciliariosService} from './domiciliarios.service';
import {CreateDomiciliariosDto, ActualizarUbicacionDto} from './esquemas/domiciliarios.dto';
import {Roles} from '../auth/decorators/roles.decorator';
import {GetUser} from '../auth/decorators/get-user.decorator';
import {Role} from '../auth/roles.enum';
import {User} from '../auth/esquemas/user.entity';

@ApiTags('Domiciliarios')
@ApiBearerAuth()
@Controller('domiciliarios')
export class DomiciliariosController {
	constructor(private readonly service: DomiciliariosService) {}

	@Roles(Role.Admin, Role.Cajero, Role.Mesero)
	@Get()
	@ApiOperation({summary: 'Obtener todos los domiciliarios'})
	@ApiResponse({status: 200, description: 'Lista de domiciliarios.'})
	findAll() {
		return this.service.findAll();
	}

	@Patch('me/ubicacion')
	@Roles(Role.Domiciliario)
	@ApiOperation({summary: 'Actualizar la última ubicación GPS del domiciliario autenticado'})
	@ApiResponse({status: 200, description: 'Ubicación actualizada.'})
	actualizarUbicacion(@GetUser() user: User, @Body() dto: ActualizarUbicacionDto) {
		// user.username = teléfono para cuentas de domiciliario (misma convención que /domicilios/me)
		return this.service.actualizarUbicacion(user.username, dto.latitud, dto.longitud, dto.capturadaEn);
	}

	@Roles(Role.Admin, Role.Cajero, Role.Mesero)
	@Get(':telefono')
	@ApiOperation({summary: 'Obtener un domiciliario por teléfono'})
	@ApiResponse({status: 200, description: 'Domiciliario encontrado.'})
	findOne(@Param('telefono') telefono: string) {
		return this.service.findOne(telefono);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Post()
	@ApiOperation({summary: 'Crear un domiciliario'})
	@ApiResponse({status: 201, description: 'Domiciliario creado.'})
	create(@Body() dto: CreateDomiciliariosDto) {
		return this.service.create(dto);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Patch(':telefono')
	@ApiOperation({summary: 'Actualizar un domiciliario'})
	@ApiResponse({status: 200, description: 'Domiciliario actualizado.'})
	update(@Param('telefono') telefono: string, @Body() dto: Partial<CreateDomiciliariosDto>) {
		return this.service.update(telefono, dto);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Delete(':telefono')
	@ApiOperation({summary: 'Eliminar un domiciliario'})
	@ApiResponse({status: 200, description: 'Domiciliario eliminado.'})
	remove(@Param('telefono') telefono: string) {
		return this.service.remove(telefono);
	}
}
