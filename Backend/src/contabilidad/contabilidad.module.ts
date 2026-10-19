import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {FacturasVentas} from '../facturas-ventas/esquemas/facturas-ventas.entity';
import {ImportadorController} from './importador.controller';
import {FacturasVentasModule} from '../facturas-ventas/facturas-ventas.module';
import {EstadisticasModule} from '../estadisticas/estadisticas.module';
import {EmpresaModule} from '../empresa/empresa.module';
import {MailService} from '../common/services/mail.service';
import {LibroDiarioController} from './libro-diario/libro-diario.controller';
import {LibroDiarioService} from './libro-diario/libro-diario.service';

@Module({
	imports: [TypeOrmModule.forFeature([FacturasVentas]), FacturasVentasModule, EstadisticasModule, EmpresaModule],
	controllers: [ImportadorController, LibroDiarioController],
	providers: [LibroDiarioService, MailService],
	exports: [LibroDiarioService],
})
export class ContabilidadModule {}
