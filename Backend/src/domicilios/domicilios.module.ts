import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Domicilios} from './esquemas/domicilios.entity';
import {DomiciliosService} from './domicilios.service';
import {DomiciliosController} from './domicilios.controller';
import {OrdenesModule} from '../ordenes/ordenes.module';

@Module({
	imports: [TypeOrmModule.forFeature([Domicilios]), OrdenesModule],
	providers: [DomiciliosService],
	controllers: [DomiciliosController],
})
export class DomiciliosModule {}
