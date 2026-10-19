import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {InventarioItem} from './esquemas/inventario-item.entity';
import {InventarioMovimiento} from './esquemas/inventario-movimiento.entity';
import {InventarioConsumo} from './esquemas/inventario-consumo.entity';
import {InventarioController} from './inventario.controller';
import {InventarioService} from './inventario.service';
import {InventarioEstadoService} from './inventario-estado.service';
import {ConsumoOrdenService} from './consumo-orden.service';

@Module({
	// forFeature registra las entidades para synchronize; el acceso es por SQL con el manager recibido.
	imports: [TypeOrmModule.forFeature([InventarioItem, InventarioMovimiento, InventarioConsumo])],
	controllers: [InventarioController],
	providers: [InventarioService, InventarioEstadoService, ConsumoOrdenService],
	exports: [ConsumoOrdenService],
})
export class InventarioModule {}
