import {Controller, Get, Post, Body, Query} from '@nestjs/common';
import {CajaMovimientosService, DenominacionesMap} from './caja-movimientos.service';
import type {CajaOrigen} from './caja-movimientos.service';
import {Roles} from '../auth/decorators/roles.decorator';
import {Role} from '../auth/roles.enum';

@Controller('caja-movimientos')
export class CajaMovimientosController {
	constructor(private readonly service: CajaMovimientosService) {}

	@Get('estado')
	getEstado(@Query('fecha') fecha?: string, @Query('cajaOrigen') cajaOrigen?: CajaOrigen) {
		return this.service.getEstadoActual(fecha, cajaOrigen ?? 'principal');
	}

	@Get('resumen')
	getResumen(@Query('fecha') fecha?: string, @Query('cajaOrigen') cajaOrigen?: CajaOrigen) {
		return this.service.getResumen(fecha, cajaOrigen ?? 'principal');
	}

	@Get()
	getMovimientos(@Query('fecha') fecha?: string, @Query('cajaOrigen') cajaOrigen?: CajaOrigen) {
		return this.service.getMovimientos(fecha, cajaOrigen ?? 'principal');
	}

	@Post('apertura')
	@Roles(Role.Admin, Role.Cajero)
	apertura(
		@Body()
		body: {
			denominaciones: DenominacionesMap;
			descripcion?: string;
			fecha?: string;
			cajaOrigen?: CajaOrigen;
		},
	) {
		return this.service.registrarApertura(body);
	}

	@Post('ajuste')
	@Roles(Role.Admin, Role.Cajero)
	ajuste(
		@Body()
		body: {
			tipo: 'entrada' | 'salida' | 'cambio';
			denominaciones: DenominacionesMap;
			descripcion: string;
			fecha?: string;
			cajaOrigen?: CajaOrigen;
		},
	) {
		return this.service.registrarAjuste(body);
	}
}
