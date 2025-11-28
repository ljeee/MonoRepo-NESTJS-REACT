import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {FacturasVentas} from './esquemas/facturas-ventas.entity';
import {FacturasVentasService} from './facturas-ventas.service';
import {FacturasVentasController} from './facturas-ventas.controller';

@Module({
	imports: [TypeOrmModule.forFeature([FacturasVentas])],
	providers: [FacturasVentasService],
	controllers: [FacturasVentasController],
})
export class FacturasVentasModule {}
