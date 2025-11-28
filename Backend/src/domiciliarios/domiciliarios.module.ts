import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Domiciliarios} from './esquemas/domiciliarios.entity';
import {DomiciliariosService} from './domiciliarios.service';
import {DomiciliariosController} from './domiciliarios.controller';

@Module({
	imports: [TypeOrmModule.forFeature([Domiciliarios])],
	providers: [DomiciliariosService],
	controllers: [DomiciliariosController],
})
export class DomiciliariosModule {}
