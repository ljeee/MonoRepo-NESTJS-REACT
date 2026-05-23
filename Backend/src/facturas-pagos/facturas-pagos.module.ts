import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {FacturasPagos} from './esquemas/facturas-pagos.entity';
import {FacturasPagosService} from './facturas-pagos.service';
import {FacturasPagosController} from './facturas-pagos.controller';
import {CajaMovimientosModule} from '../caja-movimientos/caja-movimientos.module';

@Module({
	imports: [TypeOrmModule.forFeature([FacturasPagos]), CajaMovimientosModule],
	providers: [FacturasPagosService],
	controllers: [FacturasPagosController],
})
export class FacturasPagosModule {}
