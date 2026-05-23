import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CajaMovimiento } from './esquemas/caja-movimiento.entity';
import { CajaMovimientosService } from './caja-movimientos.service';
import { CajaMovimientosController } from './caja-movimientos.controller';

@Module({
    imports: [TypeOrmModule.forFeature([CajaMovimiento])],
    controllers: [CajaMovimientosController],
    providers: [CajaMovimientosService],
    exports: [CajaMovimientosService],
})
export class CajaMovimientosModule {}
