import {Controller, Get, Post, Put, Delete, Param, Body, Patch} from "@nestjs/common";
import {ApiTags, ApiOperation, ApiResponse} from '@nestjs/swagger';
import {ProductosService} from "./productos.service";
import {CreateProductosDto} from "./esquemas/productos.dto";

@ApiTags('Productos')
@Controller("productos")
export class ProductosController {
	constructor(private readonly service: ProductosService) {}

	@Get()
	@ApiOperation({ summary: 'Obtener todos los productos' })
	@ApiResponse({ status: 200, description: 'Lista de productos.' })
	findAll() {
		return this.service.findAll();
	}

	@Get(":productoNombre")
	@ApiOperation({ summary: 'Obtener un producto por nombre' })
	@ApiResponse({ status: 200, description: 'Producto encontrado.' })
	findOne(@Param("productoNombre") productoNombre: string) {
		return this.service.findOne(productoNombre);
	}

	@Post()
	@ApiOperation({ summary: 'Crear un producto' })
	@ApiResponse({ status: 201, description: 'Producto creado.' })
	create(@Body() dto: CreateProductosDto) {
		return this.service.create(dto);
	}

	@Patch(":productoNombre")
	@ApiOperation({ summary: 'Actualizar un producto' })
	@ApiResponse({ status: 200, description: 'Producto actualizado.' })
	update(@Param("productoNombre") productoNombre: string, @Body() dto: Partial<CreateProductosDto>) {
		return this.service.update(productoNombre, dto);
	}

	@Delete(":productoNombre")
	@ApiOperation({ summary: 'Eliminar un producto' })
	@ApiResponse({ status: 200, description: 'Producto eliminado.' })
	remove(@Param("productoNombre") productoNombre: string) {
		return this.service.remove(productoNombre);
	}
}
