import {Controller, Get, Post, Delete, Param, Body, Patch, Query, BadRequestException, Res} from '@nestjs/common';
import {Roles} from '../auth/decorators/roles.decorator';
import {Role} from '../auth/roles.enum';
import type {Response} from 'express';
import {ApiTags, ApiOperation, ApiResponse, ApiQuery} from '@nestjs/swagger';
import {FacturasVentasService} from './facturas-ventas.service';
import {AbonoDto, CreateFacturasVentasDto} from './esquemas/facturas-ventas.dto';

@ApiTags('Facturas Ventas')
@Controller('facturas-ventas')
export class FacturasVentasController {
	constructor(private readonly service: FacturasVentasService) {}

	/** CSV de todas las facturas del rango, escrito por tandas. Debe ir ANTES de `:id`. */
	@Roles(Role.Admin, Role.Cajero, Role.Contador, Role.Mesero)
	@Get('export')
	@ApiOperation({summary: 'Exportar a CSV las facturas de un rango (completo, por tandas)'})
	async exportar(
		@Res() res: Response,
		@Query('from') from?: string,
		@Query('to') to?: string,
		@Query('conTransferencia') conTransferencia?: string,
		@Query('cuentaTransferenciaId') cuentaTransferenciaId?: string,
	) {
		if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
			throw new BadRequestException('Indica el rango con from y to (YYYY-MM-DD)');
		}
		res.setHeader('Content-Type', 'text/csv; charset=utf-8');
		res.setHeader('Content-Disposition', `attachment; filename="facturas_${from}_${to}.csv"`);
		for await (const trozo of this.service.csvFacturas({
			from,
			to,
			conTransferencia: conTransferencia === 'true' || conTransferencia === '1',
			cuentaTransferenciaId: cuentaTransferenciaId ? Number(cuentaTransferenciaId) : undefined,
		})) {
			res.write(trozo);
		}
		res.end();
	}

	@Roles(Role.Admin, Role.Cajero, Role.Contador, Role.Mesero)
	@Get()
	@ApiOperation({summary: 'Obtener facturas de ventas con paginación y filtro por fechas'})
	@ApiQuery({name: 'from', required: false})
	@ApiQuery({name: 'to', required: false})
	@ApiQuery({name: 'page', required: false, type: Number})
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: '0 (o sin limit, con from+to) = todo el rango, sin paginar. Sin rango: 50 por página.',
	})
	@ApiQuery({name: 'estado', required: false})
	@ApiQuery({name: 'clienteNombre', required: false})
	@ApiQuery({name: 'metodo', required: false})
	@ApiQuery({name: 'cuentaTransferenciaId', required: false, type: Number, description: '-1 = sin cuenta asignada'})
	@ApiQuery({
		name: 'conTransferencia',
		required: false,
		type: Boolean,
		description: 'Solo ventas válidas con dinero cobrado por transferencia/QR (mixtas y abonos incluidos).',
	})
	@ApiQuery({
		name: 'cursor',
		required: false,
		description:
			"Paginación por clave para traer un rango completo por tandas: 'inicio' y luego el `siguiente` de cada respuesta " +
			'(null = no hay más). Orden por factura_id descendente; tandas de `limit` (500 por defecto, máx. 1000).',
	})
	async findAll(
		@Query('from') from?: string,
		@Query('to') to?: string,
		@Query('page') page?: string,
		@Query('limit') limit?: string,
		@Query('estado') estado?: string,
		@Query('clienteNombre') clienteNombre?: string,
		@Query('metodo') metodo?: string,
		@Query('cuentaTransferenciaId') cuentaTransferenciaId?: string,
		@Query('conTransferencia') conTransferencia?: string,
		@Query('cursor') cursor?: string,
	) {
		const limitNum = limit ? Number(limit) : undefined;

		// Security check: Limit date range for large queries (e.g., limit: 9999)
		if ((!limitNum || limitNum > 100) && from && to) {
			const fromDate = new Date(from);
			const toDate = new Date(to);
			const diffInDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 3600 * 24);

			if (diffInDays > 365) {
				throw new BadRequestException(
					'El rango de fechas no puede exceder 1 año (365 días) para consultas masivas o exportaciones.',
				);
			}
		}

		return this.service.findAll({
			from,
			to,
			page: page ? Number(page) : undefined,
			limit: limitNum,
			estado,
			clienteNombre,
			metodo,
			cuentaTransferenciaId: cuentaTransferenciaId ? Number(cuentaTransferenciaId) : undefined,
			conTransferencia: conTransferencia === 'true' || conTransferencia === '1',
			cursor,
		});
	}

	@Roles(Role.Admin, Role.Cajero, Role.Contador, Role.Mesero)
	@Get('dia')
	@ApiOperation({summary: 'Obtener facturas de ventas del día actual'})
	@ApiResponse({status: 200, description: 'Lista de facturas de ventas del día.'})
	findByDay() {
		return this.service.findByDay();
	}

	@Roles(Role.Admin, Role.Cajero, Role.Contador, Role.Mesero)
	@Get('dia/stats')
	@ApiOperation({summary: 'Obtener estadísticas de facturas del día'})
	@ApiResponse({status: 200, description: 'Estadísticas: total día, pagado, pendiente.'})
	getDayStats() {
		return this.service.getDayStats();
	}

	@Roles(Role.Admin, Role.Cajero, Role.Contador, Role.Mesero)
	@Get('dia/pendientes')
	@ApiOperation({summary: 'Obtener facturas de ventas pendientes del día actual'})
	@ApiResponse({status: 200, description: 'Lista de facturas de ventas pendientes del día.'})
	findPendingByDay() {
		return this.service.findPendingByDay();
	}

	@Roles(Role.Admin, Role.Cajero, Role.Contador, Role.Mesero)
	@Get(':id')
	@ApiOperation({summary: 'Obtener una factura de venta por ID'})
	@ApiResponse({status: 200, description: 'Factura de venta encontrada.'})
	findOne(@Param('id') id: number) {
		return this.service.findOne(id);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Post()
	@ApiOperation({summary: 'Crear una factura de venta'})
	@ApiResponse({status: 201, description: 'Factura de venta creada.'})
	create(@Body() dto: CreateFacturasVentasDto) {
		return this.service.create(dto);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Patch(':id')
	@ApiOperation({summary: 'Actualizar una factura de venta'})
	@ApiResponse({status: 200, description: 'Factura de venta actualizada.'})
	update(@Param('id') id: number, @Body() dto: Partial<CreateFacturasVentasDto>) {
		return this.service.update(id, dto);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Patch(':id/abono')
	@ApiOperation({summary: 'Registrar abono parcial (efectivo o QR/transferencia) a una factura pendiente'})
	@ApiResponse({status: 200, description: 'Abono registrado, factura actualizada.'})
	registrarAbono(@Param('id') id: number, @Body() dto: AbonoDto) {
		return this.service.registrarAbono(id, dto);
	}

	@Roles(Role.Admin, Role.Cajero)
	@Delete(':id')
	@ApiOperation({summary: 'Eliminar una factura de venta'})
	@ApiResponse({status: 200, description: 'Factura de venta eliminada.'})
	remove(@Param('id') id: number) {
		return this.service.remove(id);
	}
}
