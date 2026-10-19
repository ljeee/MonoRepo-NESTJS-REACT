import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {EstadisticasService} from './estadisticas.service';
import {EstadisticasController} from './estadisticas.controller';
import {Ordenes} from '../ordenes/esquemas/ordenes.entity';
import {OrdenesProductos} from '../ordenes-productos/esquemas/ordenes-productos.entity';
import {FacturasVentas} from '../facturas-ventas/esquemas/facturas-ventas.entity';
import {FacturasPagos} from '../facturas-pagos/esquemas/facturas-pagos.entity';

import {EstadisticasGateway} from './estadisticas.gateway';
import {AnaliticaService} from './analitica/analitica.service';
import {AnaliticaController} from './analitica/analitica.controller';

@Module({
	imports: [TypeOrmModule.forFeature([Ordenes, OrdenesProductos, FacturasVentas, FacturasPagos])],
	providers: [EstadisticasService, EstadisticasGateway, AnaliticaService],
	controllers: [EstadisticasController, AnaliticaController],
	exports: [EstadisticasService, EstadisticasGateway, AnaliticaService],
})
export class EstadisticasModule {}
