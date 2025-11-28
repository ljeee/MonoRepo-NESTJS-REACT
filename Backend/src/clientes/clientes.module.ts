import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Clientes} from './esquemas/clientes.entity';
import {ClientesService} from './clientes.service';
import {ClientesController} from './clientes.controller';

@Module({
	imports: [TypeOrmModule.forFeature([Clientes])],
	providers: [ClientesService],
	controllers: [ClientesController],
})
export class ClientesModule {}
