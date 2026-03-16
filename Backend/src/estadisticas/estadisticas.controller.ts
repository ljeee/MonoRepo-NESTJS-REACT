import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { EstadisticasService } from './estadisticas.service';
import { Public } from '../auth/decorators/public.decorator';

@Public()
@ApiTags('Estadísticas')
@Controller('estadisticas')
export class EstadisticasController {
	constructor(private readonly service: EstadisticasService) {}

	@Get('productos-top')
	@ApiOperation({ summary: 'Top N productos más vendidos' })
	@ApiQuery({ name: 'from', required: true, example: '2026-01-01' })
	@ApiQuery({ name: 'to', required: true, example: '2026-12-31' })
	@ApiQuery({ name: 'limit', required: false, example: 10 })
	productosTop(
		@Query('from') from: string,
		@Query('to') to: string,
		@Query('limit') limit?: string,
	) {
		return this.service.productosTop(from, to, limit ? Number(limit) : 10);
	}

	@Get('sabores-top')
	@ApiOperation({ summary: 'Top N sabores de pizza más pedidos' })
	@ApiQuery({ name: 'from', required: true })
	@ApiQuery({ name: 'to', required: true })
	@ApiQuery({ name: 'limit', required: false })
	saboresTop(
		@Query('from') from: string,
		@Query('to') to: string,
		@Query('limit') limit?: string,
	) {
		return this.service.saboresTop(from, to, limit ? Number(limit) : 10);
	}

	@Get('variantes-top')
	@ApiOperation({ summary: 'Top N variantes de producto más vendidas' })
	@ApiQuery({ name: 'from', required: true })
	@ApiQuery({ name: 'to', required: true })
	@ApiQuery({ name: 'limit', required: false })
	variantesTop(
		@Query('from') from: string,
		@Query('to') to: string,
		@Query('limit') limit?: string,
	) {
		return this.service.variantesTop(from, to, limit ? Number(limit) : 10);
	}

	@Get('ventas-por-hora')
	@ApiOperation({ summary: 'Ventas agrupadas por hora (día o rango)' })
	@ApiQuery({ name: 'fecha', required: false, example: '2026-03-01' })
	@ApiQuery({ name: 'from', required: false, example: '2026-03-01' })
	@ApiQuery({ name: 'to', required: false, example: '2026-03-31' })
	ventasPorHora(
		@Query('fecha') fecha?: string,
		@Query('from') from?: string,
		@Query('to') to?: string,
	) {
		return this.service.ventasPorHora(fecha, from, to);
	}

	@Get('ventas-por-dia')
	@ApiOperation({ summary: 'Ventas diarias' })
	@ApiQuery({ name: 'from', required: true })
	@ApiQuery({ name: 'to', required: true })
	ventasPorDia(
		@Query('from') from: string,
		@Query('to') to: string,
	) {
		return this.service.ventasPorDia(from, to);
	}

	@Get('metodos-pago')
	@ApiOperation({ summary: 'Distribución por método de pago' })
	@ApiQuery({ name: 'from', required: true })
	@ApiQuery({ name: 'to', required: true })
	metodosPago(
		@Query('from') from: string,
		@Query('to') to: string,
	) {
		return this.service.metodosPago(from, to);
	}

	@Get('resumen-periodo')
	@ApiOperation({ summary: 'KPIs del período: ticket promedio, órdenes, tasa cancelación' })
	@ApiQuery({ name: 'from', required: true })
	@ApiQuery({ name: 'to', required: true })
	resumenPeriodo(
		@Query('from') from: string,
		@Query('to') to: string,
	) {
		return this.service.resumenPeriodo(from, to);
	}

	@Get('clientes-frecuentes')
	@ApiOperation({ summary: 'Clientes con más órdenes' })
	@ApiQuery({ name: 'limit', required: false })
	clientesFrecuentes(@Query('limit') limit?: string) {
		return this.service.clientesFrecuentes(limit ? Number(limit) : 10);
	}

	@Get('domiciliarios')
	@ApiOperation({ summary: 'Estadísticas por domiciliario' })
	domiciliariosStats(
		@Query('from') from: string,
		@Query('to') to: string,
	) {
		return this.service.domiciliariosStats(from, to);
	}

	@Get('cliente/:telefono/historial')
	@ApiOperation({ summary: 'Historial completo de un cliente: órdenes, productos, stats' })
	@ApiParam({ name: 'telefono', description: 'Teléfono del cliente' })
	clienteHistorial(@Param('telefono') telefono: string) {
		return this.service.clienteHistorial(telefono);
	}
}
