import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Productos} from './esquemas/productos.entity';
import {ProductosService} from './productos.service';
import {ProductosController} from './productos.controller';

@Module({
	imports: [TypeOrmModule.forFeature([Productos])],
	providers: [ProductosService],
	controllers: [ProductosController],
})
export class ProductosModule {}
