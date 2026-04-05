import {Controller, Get, Post, Put, Delete, Param, Body, Patch, Query} from "@nestjs/common";
import {ApiTags, ApiOperation, ApiResponse, ApiQuery} from '@nestjs/swagger';
import {FacturasVentasService} from "./facturas-ventas.service";
import {CreateFacturasVentasDto} from "./esquemas/facturas-ventas.dto";

@ApiTags('Facturas Ventas')
@Controller("facturas-ventas")
export class FacturasVentasController {
	constructor(private readonly service: FacturasVentasService) {}

	@Get()
	@ApiOperation({ summary: 'Obtener facturas de ventas con paginación y filtro por fechas' })
	@ApiQuery({ name: 'from', required: false })
	@ApiQuery({ name: 'to', required: false })
	@ApiQuery({ name: 'page', required: false, type: Number })
	@ApiQuery({ name: 'limit', required: false, type: Number })
	async findAll(
		@Query('from') from?: string,
		@Query('to') to?: string,
		@Query('page') page?: string,
		@Query('limit') limit?: string,
	) {
		return this.service.findAll({
			from,
			to,
			page: page ? Number(page) : undefined,
			limit: limit ? Number(limit) : undefined,
		});
	}

	@Get('dia')
	@ApiOperation({ summary: 'Obtener facturas de ventas del día actual' })
	@ApiResponse({ status: 200, description: 'Lista de facturas de ventas del día.' })
	findByDay() {
		return this.service.findByDay();
	}

	@Get('dia/stats')
	@ApiOperation({ summary: 'Obtener estadísticas de facturas del día' })
	@ApiResponse({ status: 200, description: 'Estadísticas: total día, pagado, pendiente.' })
	getDayStats() {
		return this.service.getDayStats();
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
