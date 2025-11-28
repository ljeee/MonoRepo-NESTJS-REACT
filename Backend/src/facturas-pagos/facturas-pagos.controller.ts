import {Controller, Get, Post, Put, Delete, Param, Body, Patch} from "@nestjs/common";
import {ApiTags, ApiOperation, ApiResponse} from '@nestjs/swagger';
import {FacturasPagosService} from "./facturas-pagos.service";
import {CreateFacturasPagosDto} from "./esquemas/facturas-pagos.dto";

@ApiTags('Facturas Pagos')
@Controller("facturas-pagos")
export class FacturasPagosController {
	constructor(private readonly service: FacturasPagosService) {}

	@Get()
	@ApiOperation({ summary: 'Obtener todos los pagos de facturas' })
	@ApiResponse({ status: 200, description: 'Lista de pagos de facturas.' })
	findAll() {
		return this.service.findAll();
	}

	@Get('dia')
	@ApiOperation({ summary: 'Obtener pagos de facturas del día actual' })
	@ApiResponse({ status: 200, description: 'Lista de pagos de facturas del día.' })
	findByDay() {
		return this.service.findByDay();
	}

	@Get('dia/pendientes')
	@ApiOperation({ summary: 'Obtener pagos de facturas pendientes del día actual' })
	@ApiResponse({ status: 200, description: 'Lista de pagos de facturas pendientes del día.' })
	findPendingByDay() {
		return this.service.findPendingByDay();
	}

	@Get(":id")
	@ApiOperation({ summary: 'Obtener un pago de factura por ID' })
	@ApiResponse({ status: 200, description: 'Pago de factura encontrado.' })
	findOne(@Param("id") id: number) {
		return this.service.findOne(id);
	}

	@Post()
	@ApiOperation({ summary: 'Crear un pago de factura' })
	@ApiResponse({ status: 201, description: 'Pago de factura creado.' })
	create(@Body() dto: CreateFacturasPagosDto) {
		return this.service.create(dto);
	}

	@Patch(":id")
	@ApiOperation({ summary: 'Actualizar un pago de factura' })
	@ApiResponse({ status: 200, description: 'Pago de factura actualizado.' })
	update(@Param("id") id: number, @Body() dto: Partial<CreateFacturasPagosDto>) {
		return this.service.update(id, dto);
	}

	@Delete(":id")
	@ApiOperation({ summary: 'Eliminar un pago de factura' })
	@ApiResponse({ status: 200, description: 'Pago de factura eliminado.' })
	remove(@Param("id") id: number) {
		return this.service.remove(id);
	}
}
