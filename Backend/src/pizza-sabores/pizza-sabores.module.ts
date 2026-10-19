import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {PizzaSabor} from './esquemas/pizza-sabores.entity';
import {SaborGrupo} from './esquemas/sabor-grupo.entity';
import {PizzaSaboresService} from './pizza-sabores.service';
import {PizzaSaboresController} from './pizza-sabores.controller';
import {SaborGruposService} from './sabor-grupos.service';
import {SaborGruposController} from './sabor-grupos.controller';

@Module({
	imports: [TypeOrmModule.forFeature([PizzaSabor, SaborGrupo])],
	controllers: [PizzaSaboresController, SaborGruposController],
	providers: [PizzaSaboresService, SaborGruposService],
	exports: [PizzaSaboresService, SaborGruposService],
})
export class PizzaSaboresModule {}
