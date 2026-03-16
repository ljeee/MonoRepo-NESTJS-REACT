import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {FacturasVentas} from '../facturas-ventas/esquemas/facturas-ventas.entity';
import {ImportadorController} from './importador.controller';
import {FacturasVentasModule} from '../facturas-ventas/facturas-ventas.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([FacturasVentas]),
		FacturasVentasModule,
	],
	controllers: [ImportadorController],
	providers: [],
})
export class ContabilidadModule {}
