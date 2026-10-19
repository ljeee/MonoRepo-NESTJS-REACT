import {Controller, Get, Query} from '@nestjs/common';
import {ApiBearerAuth, ApiOperation, ApiTags} from '@nestjs/swagger';
import {Roles} from '../../auth/decorators/roles.decorator';
import {Role} from '../../auth/roles.enum';
import {AnaliticaService} from './analitica.service';
import {
	FiltrosAnaliticaDto,
	LimiteAnaliticaDto,
	ClientesAnaliticaDto,
	ProductosAnaliticaDto,
	SaboresAnaliticaDto,
	SerieAnaliticaDto,
} from './analitica.dto';

/**
 * Analítica de negocio. Solo admin, cajero y contador (el contador ya está limitado a
 * GET por ContadorGuard). Todos los endpoints aceptan los mismos filtros.
 */
@ApiTags('Analítica')
@ApiBearerAuth()
@Roles(Role.Admin, Role.Cajero, Role.Contador)
@Controller('estadisticas/analitica')
export class AnaliticaController {
	constructor(private readonly service: AnaliticaService) {}

	@Get('resumen')
	@ApiOperation({
		summary: 'KPIs del período (con comparación opcional) y destacados: pizza, sabor y combinación más pedidos',
	})
	resumen(@Query() dto: FiltrosAnaliticaDto) {
		return this.service.resumen(dto);
	}

	@Get('productos')
	@ApiOperation({summary: 'Ventas por producto, variante, tamaño o categoría (tabla paginada)'})
	productos(@Query() dto: ProductosAnaliticaDto) {
		return this.service.productos(dto);
	}

	@Get('sabores')
	@ApiOperation({summary: 'Ranking de sabores (filtrable por tamaño)'})
	sabores(@Query() dto: SaboresAnaliticaDto) {
		return this.service.sabores(dto);
	}

	@Get('sabores/matriz')
	@ApiOperation({summary: 'Sabor × tamaño'})
	saboresMatriz(@Query() dto: SaboresAnaliticaDto) {
		return this.service.saboresMatriz(dto);
	}

	@Get('sabores/combinaciones')
	@ApiOperation({summary: 'Combinaciones de sabores más pedidas'})
	combinaciones(@Query() dto: LimiteAnaliticaDto) {
		return this.service.combinaciones(dto);
	}

	@Get('serie')
	@ApiOperation({summary: 'Serie temporal (día, semana o mes) con comparación opcional'})
	serie(@Query() dto: SerieAnaliticaDto) {
		return this.service.serie(dto);
	}

	@Get('horarios')
	@ApiOperation({summary: 'Ventas por día de la semana × hora'})
	horarios(@Query() dto: FiltrosAnaliticaDto) {
		return this.service.horarios(dto);
	}

	@Get('mix')
	@ApiOperation({summary: 'Mezcla por tipo de pedido, método de pago, cuenta, categoría, canal y estado de pago'})
	mix(@Query() dto: FiltrosAnaliticaDto) {
		return this.service.mix(dto);
	}

	@Get('clientes')
	@ApiOperation({summary: 'Clientes con más gasto en el período'})
	clientes(@Query() dto: ClientesAnaliticaDto) {
		return this.service.clientes(dto);
	}

	@Get('domiciliarios')
	@ApiOperation({summary: 'Entregas y ganancia por domiciliario'})
	domiciliarios(@Query() dto: FiltrosAnaliticaDto) {
		return this.service.domiciliarios(dto);
	}

	@Get('opciones')
	@ApiOperation({summary: 'Catálogos para los filtros (productos, sabores, domiciliarios, usuarios, tamaños)'})
	opciones() {
		return this.service.opciones();
	}

	@Get('calidad-datos')
	@ApiOperation({summary: 'Avance del backfill del histórico de ventas'})
	calidadDatos() {
		return this.service.calidadDatos();
	}
}
