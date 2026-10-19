import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {OrdenesProductos} from './esquemas/ordenes-productos.entity';
import {OrdenProductoSabor} from './esquemas/orden-producto-sabor.entity';
import {OrdenesProductosService} from './ordenes-productos.service';
import {OrdenesProductosController} from './ordenes-productos.controller';

@Module({
	imports: [TypeOrmModule.forFeature([OrdenesProductos, OrdenProductoSabor])],
	providers: [OrdenesProductosService],
	controllers: [OrdenesProductosController],
})
export class OrdenesProductosModule {}
