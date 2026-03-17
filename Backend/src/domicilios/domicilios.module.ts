import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Domicilios} from './esquemas/domicilios.entity';
import {DomiciliosService} from './domicilios.service';
import {DomiciliosController} from './domicilios.controller';

@Module({
	imports: [TypeOrmModule.forFeature([Domicilios])],
	providers: [DomiciliosService],
	controllers: [DomiciliosController],
})
export class DomiciliosModule {}
