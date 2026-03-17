import {Controller, Get, Post, Put, Delete, Param, Body, Patch} from "@nestjs/common";
import {ApiTags, ApiOperation, ApiResponse} from '@nestjs/swagger';
import {DomiciliariosService} from "./domiciliarios.service";
import {CreateDomiciliariosDto} from "./esquemas/domiciliarios.dto";

@ApiTags('Domiciliarios')
@Controller("domiciliarios")
export class DomiciliariosController {
	constructor(private readonly service: DomiciliariosService) {}

	@Get()
	@ApiOperation({ summary: 'Obtener todos los domiciliarios' })
	@ApiResponse({ status: 200, description: 'Lista de domiciliarios.' })
	findAll() {
		return this.service.findAll();
	}

	@Get(":telefono")
	@ApiOperation({ summary: 'Obtener un domiciliario por teléfono' })
	@ApiResponse({ status: 200, description: 'Domiciliario encontrado.' })
	findOne(@Param("telefono") telefono: string) {
		return this.service.findOne(telefono);
	}

	@Post()
	@ApiOperation({ summary: 'Crear un domiciliario' })
	@ApiResponse({ status: 201, description: 'Domiciliario creado.' })
	create(@Body() dto: CreateDomiciliariosDto) {
		return this.service.create(dto);
	}

	@Patch(":telefono")
	@ApiOperation({ summary: 'Actualizar un domiciliario' })
	@ApiResponse({ status: 200, description: 'Domiciliario actualizado.' })
	update(@Param("telefono") telefono: string, @Body() dto: Partial<CreateDomiciliariosDto>) {
		return this.service.update(telefono, dto);
	}

	@Delete(":telefono")
	@ApiOperation({ summary: 'Eliminar un domiciliario' })
	@ApiResponse({ status: 200, description: 'Domiciliario eliminado.' })
	remove(@Param("telefono") telefono: string) {
		return this.service.remove(telefono);
	}
}
