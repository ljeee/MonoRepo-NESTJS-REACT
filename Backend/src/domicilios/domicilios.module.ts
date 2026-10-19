import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Domicilios} from './esquemas/domicilios.entity';
import {DomiciliosService} from './domicilios.service';
import {DomiciliosController} from './domicilios.controller';
import {OrdenesModule} from '../ordenes/ordenes.module';
import {Ordenes} from '../ordenes/esquemas/ordenes.entity';

@Module({
	imports: [TypeOrmModule.forFeature([Domicilios, Ordenes]), OrdenesModule],
	providers: [DomiciliosService],
	controllers: [DomiciliosController],
})
export class DomiciliosModule {}
