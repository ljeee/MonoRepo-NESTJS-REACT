import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PizzaSabor } from './esquemas/pizza-sabores.entity';
import { PizzaSaboresService } from './pizza-sabores.service';
import { PizzaSaboresController } from './pizza-sabores.controller';

@Module({
	imports: [TypeOrmModule.forFeature([PizzaSabor])],
	controllers: [PizzaSaboresController],
	providers: [PizzaSaboresService],
	exports: [PizzaSaboresService],
})
export class PizzaSaboresModule {}
