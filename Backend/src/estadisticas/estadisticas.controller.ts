import {Controller, Get, Param, Query} from '@nestjs/common';
import {ApiTags, ApiOperation, ApiQuery, ApiParam} from '@nestjs/swagger';
import {EstadisticasService} from './estadisticas.service';
import {AnaliticaService} from './analitica/analitica.service';
import {Roles} from '../auth/decorators/roles.decorator';
import {Role} from '../auth/roles.enum';
import {RangoFechasDto} from './analitica/analitica.dto';

@ApiTags('Estadísticas')
@Controller('estadisticas')
export class EstadisticasController {
	constructor(
		private readonly service: EstadisticasService,
		private readonly analitica: AnaliticaService,
	) {}

	@Get('resumen')
	@ApiOperation({summary: 'Resumen de dinero del rango: ventas, cobrado, gastos y balance (definiciones únicas)'})
	resumenGeneral(@Query() dto: RangoFechasDto) {
		return this.analitica.resumenGeneral(dto.from, dto.to);
	}

	@Roles(Role.Admin, Role.Cajero, Role.Contador, Role.Mesero)
	@Get('cliente/:telefono/historial')
	@ApiOperation({summary: 'Historial completo de un cliente: órdenes, productos, stats'})
	@ApiParam({name: 'telefono', description: 'Teléfono del cliente'})
	clienteHistorial(@Param('telefono') telefono: string) {
		return this.analitica.clientePerfil(telefono);
	}
}
