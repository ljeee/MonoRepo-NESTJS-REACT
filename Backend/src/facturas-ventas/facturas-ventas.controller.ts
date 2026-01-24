import {Controller, Get, Post, Put, Delete, Param, Body, Patch} from "@nestjs/common";
import {ApiTags, ApiOperation, ApiResponse} from '@nestjs/swagger';
import {FacturasVentasService} from "./facturas-ventas.service";
import {CreateFacturasVentasDto} from "./esquemas/facturas-ventas.dto";

@ApiTags('Facturas Ventas')
@Controller("facturas-ventas")
export class FacturasVentasController {
	constructor(private readonly service: FacturasVentasService) {}

	@Get()
	@ApiOperation({ summary: 'Obtener todas las facturas de ventas' })
	@ApiResponse({ status: 200, description: 'Lista de facturas de ventas.' })
	async findAll() {
		return this.service.findAll();
	}

	@Get('dia')
	@ApiOperation({ summary: 'Obtener facturas de ventas del día actual' })
	@ApiResponse({ status: 200, description: 'Lista de facturas de ventas del día.' })
	findByDay() {
		return this.service.findByDay();
	}

	@Get('dia/pendientes')
	@ApiOperation({ summary: 'Obtener facturas de ventas pendientes del día actual' })
	@ApiResponse({ status: 200, description: 'Lista de facturas de ventas pendientes del día.' })
	findPendingByDay() {
		return this.service.findPendingByDay();
	}

	@Get(":id")
	@ApiOperation({ summary: 'Obtener una factura de venta por ID' })
	@ApiResponse({ status: 200, description: 'Factura de venta encontrada.' })
	findOne(@Param("id") id: number) {
		return this.service.findOne(id);
	}

	@Post()
	@ApiOperation({ summary: 'Crear una factura de venta' })
	@ApiResponse({ status: 201, description: 'Factura de venta creada.' })
	create(@Body() dto: CreateFacturasVentasDto) {
		return this.service.create(dto);
	}

	@Patch(":id")
	@ApiOperation({ summary: 'Actualizar una factura de venta' })
	@ApiResponse({ status: 200, description: 'Factura de venta actualizada.' })
	update(@Param("id") id: number, @Body() dto: Partial<CreateFacturasVentasDto>) {
		return this.service.update(id, dto);
	}

	@Delete(":id")
	@ApiOperation({ summary: 'Eliminar una factura de venta' })
	@ApiResponse({ status: 200, description: 'Factura de venta eliminada.' })
	remove(@Param("id") id: number) {
		return this.service.remove(id);
	}
}
