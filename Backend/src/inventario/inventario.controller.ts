import {Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query} from '@nestjs/common';
import {ApiOperation, ApiTags} from '@nestjs/swagger';
import {Roles} from '../auth/decorators/roles.decorator';
import {Role} from '../auth/roles.enum';
import {GetUser} from '../auth/decorators/get-user.decorator';
import {User} from '../auth/esquemas/user.entity';
import {InventarioService} from './inventario.service';
import {
	ActualizarItemDto,
	CrearItemDto,
	GuardarReglaDto,
	ListarMovimientosDto,
	RegistrarMovimientoDto,
} from './esquemas/inventario.dto';
import {TIPOS_ITEM_INVENTARIO, type TipoItemInventario} from './inventario.util';

/** Inventario unificado (cajas + bebidas embotelladas). Lectura para el staff; escritura admin/cajero. */
@ApiTags('Inventario')
@Controller('inventario')
export class InventarioController {
	constructor(private readonly service: InventarioService) {}

	@Get('estado')
	@ApiOperation({summary: '¿Terminó la migración al inventario unificado?'})
	estado() {
		return this.service.estadoMigracion();
	}

	@Get('items')
	@ApiOperation({summary: 'Ítems con stock y estado ok/bajo/critico'})
	listarItems(@Query('tipo') tipo?: string, @Query('inactivos') inactivos?: string) {
		const t = (TIPOS_ITEM_INVENTARIO as readonly string[]).includes(tipo ?? '')
			? (tipo as TipoItemInventario)
			: undefined;
		return this.service.listarItems({tipo: t, incluirInactivos: inactivos === 'true'});
	}

	@Post('items')
	@Roles(Role.Admin, Role.Cajero)
	crearItem(@Body() dto: CrearItemDto, @GetUser() user: User) {
		return this.service.crearItem(dto, user?.id);
	}

	@Patch('items/:id')
	@Roles(Role.Admin, Role.Cajero)
	actualizarItem(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarItemDto) {
		return this.service.actualizarItem(id, dto);
	}

	@Post('items/:id/movimientos')
	@Roles(Role.Admin, Role.Cajero)
	@ApiOperation({summary: 'Entrada, salida, ajuste o conteo físico'})
	registrarMovimiento(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: RegistrarMovimientoDto,
		@GetUser() user: User,
	) {
		return this.service.registrarMovimiento(id, dto, user?.id);
	}

	@Get('movimientos')
	listarMovimientos(@Query() dto: ListarMovimientosDto) {
		return this.service.listarMovimientos(dto);
	}

	@Get('reglas/sugerencias')
	@ApiOperation({summary: 'Pizzas/calzones sin regla de caja'})
	sugerencias() {
		return this.service.sugerencias();
	}

	@Get('reglas')
	listarReglas(@Query('itemId') itemId?: string, @Query('varianteId') varianteId?: string) {
		return this.service.listarReglas({
			itemId: itemId ? Number(itemId) : undefined,
			varianteId: varianteId ? Number(varianteId) : undefined,
		});
	}

	@Post('reglas')
	@Roles(Role.Admin, Role.Cajero)
	guardarRegla(@Body() dto: GuardarReglaDto) {
		return this.service.guardarRegla(dto);
	}

	@Delete('reglas/:id')
	@Roles(Role.Admin, Role.Cajero)
	eliminarRegla(@Param('id', ParseIntPipe) id: number) {
		return this.service.eliminarRegla(id);
	}
}
