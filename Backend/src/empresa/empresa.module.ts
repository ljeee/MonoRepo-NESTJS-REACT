import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {EmpresaConfig} from './esquemas/empresa.entity';
import {CuentaTransferencia} from './esquemas/cuenta-transferencia.entity';
import {EmpresaService} from './empresa.service';
import {EmpresaController} from './empresa.controller';

@Module({
	imports: [TypeOrmModule.forFeature([EmpresaConfig, CuentaTransferencia])],
	providers: [EmpresaService],
	controllers: [EmpresaController],
	exports: [EmpresaService],
})
export class EmpresaModule {}
