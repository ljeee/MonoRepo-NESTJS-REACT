import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmpresaConfig } from './esquemas/empresa.entity';
import { EmpresaService } from './empresa.service';
import { EmpresaController } from './empresa.controller';

@Module({
    imports: [TypeOrmModule.forFeature([EmpresaConfig])],
    providers: [EmpresaService],
    controllers: [EmpresaController],
    exports: [EmpresaService],
})
export class EmpresaModule {}
