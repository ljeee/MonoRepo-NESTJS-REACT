import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Productos} from './esquemas/productos.entity';
import {ProductoVariantes} from './esquemas/producto-variantes.entity';
import {ProductosService} from './productos.service';
import {ProductosController} from './productos.controller';

@Module({
	imports: [TypeOrmModule.forFeature([Productos, ProductoVariantes])],
	providers: [ProductosService],
	controllers: [ProductosController],
	exports: [ProductosService],
})
export class ProductosModule {}
