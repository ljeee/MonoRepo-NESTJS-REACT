import {BadRequestException, Controller, Get, Post, Put, Delete, Param, Body, Patch, Query, Res} from '@nestjs/common';
import {Roles} from '../auth/decorators/roles.decorator';
import {Role} from '../auth/roles.enum';
import type {Response} from 'express';
import {ApiTags, ApiOperation, ApiResponse} from '@nestjs/swagger';
import {FacturasPagosService} from './facturas-pagos.service';
import {CreateFacturasPagosDto, FindFacturasPagosDto, UpdateFacturasPagosDto} from './esquemas/facturas-pagos.dto';

@ApiTags('Facturas Pagos')
@Controller('facturas-pagos')
export class FacturasPagosController {
	constructor(private readonly service: FacturasPagosService) {}

	/** CSV de todos los egresos del rango, escrito por tandas. Debe ir ANTES de `:id`. */
	@Roles(Role.Admin, Role.Cajero, Role.Contador)
	@Get('export')
	@ApiOperation({summary: 'Exportar a CSV los egresos de un rango (completo, por tandas)'})
	async exportar(@Res() res: Response, @Query() query: FindFacturasPagosDto) {
		const {from, to} = query;
		if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
			throw new BadRequestException('Indica el rango con from y to (YYYY-MM-DD)');
		}
		res.setHeader('Content-Type', 'text/csv; charset=utf-8');
		res.setHeader('Content-Disposition', `attachment; filename="egresos_${from}_${to}.csv"`);
		for await (const trozo of this.service.csvEgresos({from, to, tipo: query.tipo, categoria: query.categoria})) {
			res.write(trozo);
		}
		res.end();
	}

	@Roles(Role.Admin, Role.Cajero, Role.Contador)
	@Get()
	@ApiOperation({summary: 'Obtener todos los pagos de facturas con filtros opcionales'})
	@ApiResponse({status: 200, description: 'Lista de pagos de facturas.'})
	findAll(@Query() query: FindFacturasPagosDto) {
		return this.service.findAll(query);
	}

	@Roles(Role.Admin, Role.Cajero, Role.Contador)
	@Get('dia')
	@ApiOperation({summary: 'Obtener pagos de facturas del día actual'})
	@ApiResponse({status: 200, description: 'Lista de pagos de facturas del día.'})
	findByDay() {
		return this.service.findByDay();
	}

	@Roles(Role.Admin, Role.Cajero, Role.Contador)
	@Get('dia/pendientes')
	@ApiOperation({summary: 'Obtener pagos de facturas pendientes del día actual'})
	@ApiResponse({status: 200, description: 'Lista de pagos de facturas pendientes del día.'})
	findPendingByDay() {
		return this.service.findPendingByDay();
	}

	@Roles(Role.Admin, Role.Cajero, Role.Contador)
	@Get(':id')
	@ApiOperation({summary: 'Obtener un pago de factura por ID'})
	@ApiResponse({status: 200, description: 'Pago de factura encontrado.'})
	findOne(@Param('id') id: number) {
		return this.service.findOne(id);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Post()
	@ApiOperation({summary: 'Crear un pago de factura'})
	@ApiResponse({status: 201, description: 'Pago de factura creado.'})
	create(@Body() dto: CreateFacturasPagosDto) {
		return this.service.create(dto);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Patch(':id')
	@ApiOperation({summary: 'Actualizar un pago de factura'})
	@ApiResponse({status: 200, description: 'Pago de factura actualizado.'})
	update(@Param('id') id: number, @Body() dto: UpdateFacturasPagosDto) {
		return this.service.update(id, dto);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Delete(':id')
	@ApiOperation({summary: 'Eliminar un pago de factura'})
	@ApiResponse({status: 200, description: 'Pago de factura eliminado.'})
	remove(@Param('id') id: number) {
		return this.service.remove(id);
	}
}
