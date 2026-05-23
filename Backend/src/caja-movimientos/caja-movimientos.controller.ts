import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CajaMovimientosService, DenominacionesMap } from './caja-movimientos.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/roles.enum';

@Controller('caja-movimientos')
export class CajaMovimientosController {
    constructor(private readonly service: CajaMovimientosService) {}

    @Get('estado')
    getEstado(@Query('fecha') fecha?: string) {
        return this.service.getEstadoActual(fecha);
    }

    @Get('resumen')
    getResumen(@Query('fecha') fecha?: string) {
        return this.service.getResumen(fecha);
    }

    @Get()
    getMovimientos(@Query('fecha') fecha?: string) {
        return this.service.getMovimientos(fecha);
    }

    @Post('apertura')
    @Roles(Role.Admin, Role.Cajero)
    apertura(@Body() body: { denominaciones: DenominacionesMap; descripcion?: string; fecha?: string }) {
        return this.service.registrarApertura(body);
    }
}
