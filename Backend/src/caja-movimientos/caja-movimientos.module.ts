import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {CajaMovimiento} from './esquemas/caja-movimiento.entity';
import {CajaMovimientosService} from './caja-movimientos.service';
import {CajaMovimientosController} from './caja-movimientos.controller';
import {EstadisticasModule} from '../estadisticas/estadisticas.module';

@Module({
	imports: [TypeOrmModule.forFeature([CajaMovimiento]), EstadisticasModule],
	controllers: [CajaMovimientosController],
	providers: [CajaMovimientosService],
	exports: [CajaMovimientosService],
})
export class CajaMovimientosModule {}
