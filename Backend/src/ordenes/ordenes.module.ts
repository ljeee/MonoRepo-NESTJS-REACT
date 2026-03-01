import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Ordenes} from './esquemas/ordenes.entity';
import {OrdenesService} from './ordenes.service';
import {OrdenesController} from './ordenes.controller';
import {OrdenesGateway} from './ordenes.gateway';
import {FacturasVentas} from '../facturas-ventas/esquemas/facturas-ventas.entity';
import {Domicilios} from '../domicilios/esquemas/domicilios.entity';
import {Clientes} from '../clientes/esquemas/clientes.entity';
import {Domiciliarios} from '../domiciliarios/esquemas/domiciliarios.entity';
import {Productos} from '../productos/esquemas/productos.entity';
import {ProductoVariantes} from '../productos/esquemas/producto-variantes.entity';
import {OrdenesProductos} from '../ordenes-productos/esquemas/ordenes-productos.entity';
import {PizzaSaboresModule} from '../pizza-sabores/pizza-sabores.module';
import {FacturaCreationService} from './services/factura-creation.service';
import {DomicilioCreationService} from './services/domicilio-creation.service';
import {ProductProcessingService} from './services/product-processing.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([Ordenes, FacturasVentas, Domicilios, Clientes, Domiciliarios, Productos, ProductoVariantes, OrdenesProductos]),
		PizzaSaboresModule
	],
	providers: [
		OrdenesService, 
		OrdenesGateway, 
		FacturaCreationService, 
		DomicilioCreationService, 
		ProductProcessingService
	],
	controllers: [OrdenesController],
	exports: [OrdenesService, OrdenesGateway]
})
export class OrdenesModule {}
