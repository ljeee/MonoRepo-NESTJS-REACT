import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Clientes} from './esquemas/clientes.entity';
import {ClienteDirecciones} from './esquemas/cliente-direcciones.entity';
import {ClientesService} from './clientes.service';
import {ClientesController} from './clientes.controller';

@Module({
	imports: [TypeOrmModule.forFeature([Clientes, ClienteDirecciones])],
	providers: [ClientesService],
	controllers: [ClientesController],
	exports: [ClientesService, TypeOrmModule],
})
export class ClientesModule {}
