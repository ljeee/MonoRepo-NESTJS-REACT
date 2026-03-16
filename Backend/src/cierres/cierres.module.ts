import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CierreCaja } from './esquemas/cierre.entity';
import { CierresService } from './cierres.service';
import { CierresController } from './cierres.controller';
import { EstadisticasModule } from '../estadisticas/estadisticas.module';
import { MailService } from '../common/services/mail.service';
import { EmpresaModule } from '../empresa/empresa.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([CierreCaja]),
        EstadisticasModule,
        EmpresaModule,
    ],
    controllers: [CierresController],
    providers: [CierresService, MailService],
    exports: [CierresService],
})
export class CierresModule {}
