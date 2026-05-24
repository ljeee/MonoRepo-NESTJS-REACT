import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ingrediente } from './esquemas/ingrediente.entity';
import { VarianteIngrediente } from './esquemas/variante-ingrediente.entity';
import { InventarioBebidasService } from './inventario-bebidas.service';
import { InventarioBebidasController } from './inventario-bebidas.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Ingrediente, VarianteIngrediente])],
    providers: [InventarioBebidasService],
    controllers: [InventarioBebidasController],
    exports: [InventarioBebidasService],
})
export class InventarioBebidasModule {}
