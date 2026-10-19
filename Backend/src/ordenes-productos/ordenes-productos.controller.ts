import {Controller, Get, Post, Put, Delete, Param, Body, Patch} from '@nestjs/common';
import {Roles} from '../auth/decorators/roles.decorator';
import {Role} from '../auth/roles.enum';
import {ApiTags, ApiOperation, ApiResponse} from '@nestjs/swagger';
import {OrdenesProductosService} from './ordenes-productos.service';
import {CreateOrdenesProductosDto} from './esquemas/ordenes-productos.dto';

@ApiTags('Ordenes Productos')
@Controller('ordenes-productos')
export class OrdenesProductosController {
	constructor(private readonly service: OrdenesProductosService) {}

	@Get()
	@ApiOperation({summary: 'Obtener todos los productos de ordenes'})
	@ApiResponse({status: 200, description: 'Lista de productos de ordenes.'})
	findAll() {
		return this.service.findAll();
	}

	@Get(':id')
	@ApiOperation({summary: 'Obtener un producto de orden por ID'})
	@ApiResponse({status: 200, description: 'Producto de orden encontrado.'})
	findOne(@Param('id') id: number) {
		return this.service.findOne(id);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Post()
	@ApiOperation({summary: 'Crear un producto de orden'})
	@ApiResponse({status: 201, description: 'Producto de orden creado.'})
	create(@Body() dto: CreateOrdenesProductosDto) {
		return this.service.create(dto);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Patch(':id')
	@ApiOperation({summary: 'Actualizar un producto de orden'})
	@ApiResponse({status: 200, description: 'Producto de orden actualizado.'})
	update(@Param('id') id: number, @Body() dto: Partial<CreateOrdenesProductosDto>) {
		return this.service.update(id, dto);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Delete(':id')
	@ApiOperation({summary: 'Eliminar un producto de orden'})
	@ApiResponse({status: 200, description: 'Producto de orden eliminado.'})
	remove(@Param('id') id: number) {
		return this.service.remove(id);
	}
}
