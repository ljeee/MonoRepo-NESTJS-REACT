import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {MigracionDatos} from './esquemas/migracion-datos.entity';
import {MigracionesDatosService, PASOS_MIGRACION_DATOS} from './migraciones-datos.service';
import {PASOS_MIGRACION} from './pasos';

@Module({
	imports: [TypeOrmModule.forFeature([MigracionDatos])],
	providers: [MigracionesDatosService, {provide: PASOS_MIGRACION_DATOS, useValue: PASOS_MIGRACION}],
	exports: [MigracionesDatosService],
})
export class MigracionesDatosModule {}
