import {Controller, Get, Post, Put, Delete, Param, Body, Patch, Query} from "@nestjs/common";
import {ApiTags, ApiOperation, ApiResponse} from '@nestjs/swagger';
import {ProductosService} from "./productos.service";
import {CreateProductosDto, FindProductosDto} from "./esquemas/productos.dto";

@ApiTags('Productos')
@Controller("productos")
export class ProductosController {
	constructor(private readonly service: ProductosService) {}

	@Get('categorias')
	@ApiOperation({ summary: 'Obtener todas las categorías de productos' })
	@ApiResponse({ status: 200, description: 'Lista de categorías.' })
	getCategories() {
		return this.service.getCategories();
	}

	@Get()
	@ApiOperation({ summary: 'Obtener todos los productos con variantes' })
	@ApiResponse({ status: 200, description: 'Lista de productos con variantes.' })
	findAll(@Query() query: FindProductosDto) {
		return this.service.findAll(query);
	}

	@Get(":id")
	@ApiOperation({ summary: 'Obtener un producto por ID' })
	@ApiResponse({ status: 200, description: 'Producto encontrado.' })
	findOne(@Param("id") id: number) {
		return this.service.findOne(id);
	}

	@Get(':id/variantes')
	@ApiOperation({ summary: 'Obtener variantes de un producto' })
	@ApiResponse({ status: 200, description: 'Variantes del producto.' })
	getVariantes(@Param("id") id: number) {
		return this.service.getVariantes(id);
	}

	@Post()
	@ApiOperation({ summary: 'Crear un producto con variantes' })
	@ApiResponse({ status: 201, description: 'Producto creado.' })
	create(@Body() dto: CreateProductosDto) {
		return this.service.create(dto);
	}

	@Post(':id/variantes')
	@ApiOperation({ summary: 'Agregar variante a un producto' })
	@ApiResponse({ status: 201, description: 'Variante agregada.' })
	addVariante(
		@Param("id") id: number,
		@Body() body: {nombre: string; precio: number; descripcion?: string}
	) {
		return this.service.createVariante(id, body.nombre, body.precio, body.descripcion);
	}

	@Patch(":id")
	@ApiOperation({ summary: 'Actualizar un producto' })
	@ApiResponse({ status: 200, description: 'Producto actualizado.' })
	update(@Param("id") id: number, @Body() dto: Partial<CreateProductosDto>) {
		return this.service.update(id, dto);
	}

	@Delete(":id")
	@ApiOperation({ summary: 'Eliminar un producto' })
	@ApiResponse({ status: 200, description: 'Producto eliminado.' })
	remove(@Param("id") id: number) {
		return this.service.remove(id);
	}

	@Patch("variantes/:id")
	@ApiOperation({ summary: 'Actualizar una variante' })
	@ApiResponse({ status: 200, description: 'Variante actualizada.' })
	updateVariante(
		@Param("id") id: number,
		@Body() body: {nombre?: string; precio?: number; descripcion?: string; activo?: boolean}
	) {
		return this.service.updateVariante(id, body.nombre, body.precio, body.descripcion, body.activo);
	}

	@Delete("variantes/:id")
	@ApiOperation({ summary: 'Eliminar una variante' })
	@ApiResponse({ status: 200, description: 'Variante eliminada.' })
	deleteVariante(@Param("id") id: number) {
		return this.service.deleteVariante(id);
	}
}
