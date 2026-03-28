import {Controller, Get, Post, Put, Delete, Param, Body, Patch, Query} from "@nestjs/common";
import {ApiTags, ApiOperation, ApiResponse} from '@nestjs/swagger';
import {DomiciliosService} from "./domicilios.service";
import {CreateDomiciliosDto} from "./esquemas/domicilios.dto";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { User } from "../auth/esquemas/user.entity";

@ApiTags('Domicilios')
@Controller("domicilios")
export class DomiciliosController {
	constructor(private readonly service: DomiciliosService) {}

	@Get('me')
	@ApiOperation({ summary: 'Obtener domicilios asignados al usuario actual' })
	findMe(@GetUser() user: User, @Query('all') all?: string) {
		return this.service.findByUser(user.username, all === 'true');
	}

	@Get()
	@ApiOperation({ summary: 'Obtener todos los domicilios' })
	@ApiResponse({ status: 200, description: 'Lista de domicilios.' })
	findAll() {
		return this.service.findAll();
	}
	@Get('dia')
	@ApiOperation({ summary: 'Obtener domicilios del día actual' })
	@ApiResponse({ status: 200, description: 'Lista de domicilios del día.' })
	findByDay() {
		return this.service.findByDay();
	}

	@Get('dia/pendientes')
	@ApiOperation({ summary: 'Obtener domicilios pendientes del día actual' })
	@ApiResponse({ status: 200, description: 'Lista de domicilios pendientes del día.' })
	findPendingByDay() {
		return this.service.findPendingByDay();
	}

	@Get(":id")
	@ApiOperation({ summary: 'Obtener un domicilio por ID' })
	@ApiResponse({ status: 200, description: 'Domicilio encontrado.' })
	findOne(@Param("id") id: number) {
		return this.service.findOne(id);
	}

	@Post()
	@ApiOperation({ summary: 'Crear un domicilio' })
	@ApiResponse({ status: 201, description: 'Domicilio creado.' })
	create(@Body() dto: CreateDomiciliosDto) {
		return this.service.create(dto);
	}

	@Patch(":id")
	@ApiOperation({ summary: 'Actualizar un domicilio' })
	@ApiResponse({ status: 200, description: 'Domicilio actualizado.' })
	update(@Param("id") id: number, @Body() dto: Partial<CreateDomiciliosDto>) {
		return this.service.update(id, dto);
	}

	@Delete(":id")
	@ApiOperation({ summary: 'Eliminar un domicilio' })
	@ApiResponse({ status: 200, description: 'Domicilio eliminado.' })
	remove(@Param("id") id: number) {
		return this.service.remove(id);
	}
}
