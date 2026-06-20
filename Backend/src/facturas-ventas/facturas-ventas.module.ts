import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {FacturasVentas} from './esquemas/facturas-ventas.entity';
import {FacturasVentasService} from './facturas-ventas.service';
import {FacturasVentasController} from './facturas-ventas.controller';
import {CajaMovimientosModule} from '../caja-movimientos/caja-movimientos.module';
import {EstadisticasModule} from '../estadisticas/estadisticas.module';

@Module({
	imports: [TypeOrmModule.forFeature([FacturasVentas]), CajaMovimientosModule, EstadisticasModule],
	providers: [FacturasVentasService],
	controllers: [FacturasVentasController],
	exports: [FacturasVentasService],
})
export class FacturasVentasModule {}
