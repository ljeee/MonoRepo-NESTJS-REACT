import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {FacturasVentas} from './esquemas/facturas-ventas.entity';
import {Ordenes} from '../ordenes/esquemas/ordenes.entity';
import {FacturasVentasService} from './facturas-ventas.service';
import {FacturasVentasController} from './facturas-ventas.controller';

@Module({
	imports: [TypeOrmModule.forFeature([FacturasVentas, Ordenes])],
	providers: [FacturasVentasService],
	controllers: [FacturasVentasController],
	exports: [FacturasVentasService],
})
export class FacturasVentasModule {}
