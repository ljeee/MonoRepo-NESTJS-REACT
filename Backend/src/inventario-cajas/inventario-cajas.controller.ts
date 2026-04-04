import { Controller, Get, Post, Patch, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InventarioCajasService } from './inventario-cajas.service';
import { AjustarCajasDto, ConfigurarAlertaDto } from './esquemas/inventario-cajas.dto';

@ApiTags('Inventario Cajas')
@Controller('inventario-cajas')
export class InventarioCajasController {
	constructor(private readonly service: InventarioCajasService) {}

	@Get()
	@ApiOperation({ summary: 'Obtener estado actual del inventario de cajas' })
	getEstado() {
		return this.service.getEstado();
	}

	@Post('ajustar')
	@ApiOperation({ summary: 'Ajustar cantidad de cajas (+/-delta)' })
	ajustar(@Body() dto: AjustarCajasDto) {
		return this.service.ajustar(dto);
	}

	@Patch('alerta')
	@ApiOperation({ summary: 'Configurar cantidad mínima de alerta' })
	configurarAlerta(@Body() dto: ConfigurarAlertaDto) {
		return this.service.configurarAlerta(dto);
	}

	@Get('movimientos')
	@ApiOperation({ summary: 'Obtener historial de movimientos' })
	getMovimientos(@Query('limit') limit?: string) {
		return this.service.getMovimientos(limit ? Number(limit) : 20);
	}
}
