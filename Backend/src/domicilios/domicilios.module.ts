import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Domicilios} from './esquemas/domicilios.entity';
import {DomiciliosService} from './domicilios.service';
import {DomiciliosController} from './domicilios.controller';
import {TelegramService} from '../common/telegram.service';

@Module({
	imports: [TypeOrmModule.forFeature([Domicilios])],
	providers: [DomiciliosService, TelegramService],
	controllers: [DomiciliosController],
})
export class DomiciliosModule {}
