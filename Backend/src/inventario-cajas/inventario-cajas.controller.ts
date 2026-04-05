import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InventarioCajasService } from './inventario-cajas.service';
import { AjustarCajasDto, ConfigurarAlertaDto, CrearCajaDto } from './esquemas/inventario-cajas.dto';

@ApiTags('Inventario Cajas')
@Controller('inventario-cajas')
export class InventarioCajasController {
	constructor(private readonly service: InventarioCajasService) {}

	@Get()
	@ApiOperation({ summary: 'Obtener estado actual de todas las cajas' })
	getEstado() {
		return this.service.getEstado();
	}

	@Post()
	@ApiOperation({ summary: 'Crear un nuevo tipo de caja' })
	crear(@Body() dto: CrearCajaDto) {
		return this.service.crear(dto);
	}

	@Delete(':id')
	@ApiOperation({ summary: 'Eliminar un tipo de caja' })
	eliminar(@Param('id', ParseIntPipe) id: number) {
		return this.service.eliminar(id);
	}

	@Post(':id/ajustar')
	@ApiOperation({ summary: 'Ajustar cantidad de una caja (+/-delta)' })
	ajustar(@Param('id', ParseIntPipe) id: number, @Body() dto: AjustarCajasDto) {
		return this.service.ajustar(id, dto);
	}

	@Patch(':id/alerta')
	@ApiOperation({ summary: 'Configurar cantidad mínima de alerta de una caja' })
	configurarAlerta(@Param('id', ParseIntPipe) id: number, @Body() dto: ConfigurarAlertaDto) {
		return this.service.configurarAlerta(id, dto);
	}

	@Get('movimientos')
	@ApiOperation({ summary: 'Obtener historial de movimientos globales' })
	getMovimientos(@Query('limit') limit?: string) {
		return this.service.getMovimientos(limit ? Number(limit) : 20);
	}
}
