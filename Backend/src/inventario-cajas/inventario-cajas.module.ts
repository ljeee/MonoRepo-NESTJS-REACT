import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventarioCajas, InventarioCajasMovimiento } from './esquemas/inventario-cajas.entity';
import { InventarioCajasService } from './inventario-cajas.service';
import { InventarioCajasController } from './inventario-cajas.controller';

@Module({
	imports: [TypeOrmModule.forFeature([InventarioCajas, InventarioCajasMovimiento])],
	controllers: [InventarioCajasController],
	providers: [InventarioCajasService],
	exports: [InventarioCajasService],
})
export class InventarioCajasModule {}
