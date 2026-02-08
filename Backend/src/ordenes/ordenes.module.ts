import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Ordenes} from './esquemas/ordenes.entity';
import {OrdenesService} from './ordenes.service';
import {OrdenesController} from './ordenes.controller';
import {FacturasVentas} from '../facturas-ventas/esquemas/facturas-ventas.entity';
import {Domicilios} from '../domicilios/esquemas/domicilios.entity';
import {Clientes} from '../clientes/esquemas/clientes.entity';
import {Domiciliarios} from '../domiciliarios/esquemas/domiciliarios.entity';
import {Productos} from '../productos/esquemas/productos.entity';
import {ProductoVariantes} from '../productos/esquemas/producto-variantes.entity';
import {OrdenesProductos} from '../ordenes-productos/esquemas/ordenes-productos.entity';

@Module({
	imports: [TypeOrmModule.forFeature([Ordenes, FacturasVentas, Domicilios, Clientes, Domiciliarios, Productos, ProductoVariantes, OrdenesProductos])],
	providers: [OrdenesService],
	controllers: [OrdenesController],
})
export class OrdenesModule {}
