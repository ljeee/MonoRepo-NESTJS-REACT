import {Controller, Get, Post, Put, Delete, Param, Body, Patch, Query} from '@nestjs/common';
import {Roles} from '../auth/decorators/roles.decorator';
import {Role} from '../auth/roles.enum';
import {ApiTags, ApiOperation, ApiResponse} from '@nestjs/swagger';
import {ProductosService} from './productos.service';
import {CreateProductosDto, CreateProductoVarianteDto, FindProductosDto} from './esquemas/productos.dto';
import {Public} from '../auth/decorators/public.decorator';

@ApiTags('Productos')
@Controller('productos')
export class ProductosController {
	constructor(private readonly service: ProductosService) {}

	@Get()
	@Public()
	@ApiOperation({summary: 'Obtener todos los productos con variantes'})
	@ApiResponse({status: 200, description: 'Lista de productos con variantes.'})
	findAll(@Query() query: FindProductosDto) {
		return this.service.findAll(query);
	}

	@Get(':id')
	@Public()
	@ApiOperation({summary: 'Obtener un producto por ID'})
	@ApiResponse({status: 200, description: 'Producto encontrado.'})
	findOne(@Param('id') id: number) {
		return this.service.findOne(id);
	}

	@Get(':id/variantes')
	@Public()
	@ApiOperation({summary: 'Obtener variantes de un producto'})
	@ApiResponse({status: 200, description: 'Variantes del producto.'})
	getVariantes(@Param('id') id: number) {
		return this.service.getVariantes(id);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Post()
	@ApiOperation({summary: 'Crear un producto con variantes'})
	@ApiResponse({status: 201, description: 'Producto creado.'})
	create(@Body() dto: CreateProductosDto) {
		return this.service.create(dto);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Post(':id/variantes')
	@ApiOperation({summary: 'Agregar variante a un producto'})
	@ApiResponse({status: 201, description: 'Variante agregada.'})
	addVariante(@Param('id') id: number, @Body() body: CreateProductoVarianteDto) {
		return this.service.createVariante(id, body.nombre, body.precio, body.descripcion, body.precioLeche, body.tamano);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Patch(':id')
	@ApiOperation({summary: 'Actualizar un producto'})
	@ApiResponse({status: 200, description: 'Producto actualizado.'})
	update(@Param('id') id: number, @Body() dto: Partial<CreateProductosDto>) {
		return this.service.update(id, dto);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Delete(':id')
	@ApiOperation({summary: 'Eliminar un producto'})
	@ApiResponse({status: 200, description: 'Producto eliminado.'})
	remove(@Param('id') id: number) {
		return this.service.remove(id);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Patch('variantes/:id')
	@ApiOperation({summary: 'Actualizar una variante'})
	@ApiResponse({status: 200, description: 'Variante actualizada.'})
	updateVariante(
		@Param('id') id: number,
		@Body()
		body: {
			nombre?: string;
			precio?: number;
			precioLeche?: number | null;
			descripcion?: string;
			activo?: boolean;
			tamano?: string | null;
		},
	) {
		return this.service.updateVariante(
			id,
			body.nombre,
			body.precio,
			body.descripcion,
			body.activo,
			body.precioLeche,
			body.tamano,
		);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Delete('variantes/:id')
	@ApiOperation({summary: 'Eliminar una variante'})
	@ApiResponse({status: 200, description: 'Variante eliminada.'})
	deleteVariante(@Param('id') id: number) {
		return this.service.deleteVariante(id);
	}
}
