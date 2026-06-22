import {Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseIntPipe} from '@nestjs/common';
import {InventarioBebidasService} from './inventario-bebidas.service';
import {
	CreateIngredienteDto,
	UpdateIngredienteDto,
	AjustarStockDto,
	VincularVarianteDto,
} from './esquemas/ingrediente.dto';
import {Roles} from '../auth/decorators/roles.decorator';
import {Role} from '../auth/roles.enum';

@Controller('inventario-bebidas')
export class InventarioBebidasController {
	constructor(private readonly service: InventarioBebidasService) {}

	// ─── Vinculos (MUST be above :id to avoid route shadowing) ─────────────────

	@Get('vinculos/all')
	getVinculos() {
		return this.service.getVinculos();
	}

	@Post('vinculos')
	@Roles(Role.Admin, Role.Cajero)
	vincular(@Body() dto: VincularVarianteDto) {
		return this.service.vincular(dto);
	}

	@Delete('vinculos/:varianteId')
	@Roles(Role.Admin, Role.Cajero)
	desvincular(@Param('varianteId', ParseIntPipe) varianteId: number) {
		return this.service.desvincular(varianteId);
	}

	// ─── Movimientos de stock (historial) ─────────────────────────────────────────

	@Get('movimientos')
	getMovimientos(@Query('limit') limit?: string) {
		return this.service.getMovimientosBebidas(limit ? Number(limit) : 20);
	}

	// ─── Ingredientes ───────────────────────────────────────────────────────────

	@Get()
	findAll() {
		return this.service.findAll();
	}

	@Get(':id')
	findOne(@Param('id', ParseIntPipe) id: number) {
		return this.service.findOne(id);
	}

	@Post()
	@Roles(Role.Admin, Role.Cajero)
	create(@Body() dto: CreateIngredienteDto) {
		return this.service.create(dto);
	}

	@Patch(':id')
	@Roles(Role.Admin, Role.Cajero)
	update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIngredienteDto) {
		return this.service.update(id, dto);
	}

	@Delete(':id')
	@Roles(Role.Admin)
	remove(@Param('id', ParseIntPipe) id: number) {
		return this.service.remove(id);
	}

	@Patch(':id/ajustar')
	@Roles(Role.Admin, Role.Cajero)
	ajustar(@Param('id', ParseIntPipe) id: number, @Body() dto: AjustarStockDto) {
		return this.service.ajustar(id, dto);
	}
}
