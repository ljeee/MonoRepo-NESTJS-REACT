import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {APP_GUARD} from '@nestjs/core';
import {FacturasVentasModule} from './facturas-ventas/facturas-ventas.module';
import {OrdenesModule} from './ordenes/ordenes.module';
import {DomiciliosModule} from './domicilios/domicilios.module';
import {ClientesModule} from './clientes/clientes.module';
import {OrdenesProductosModule} from './ordenes-productos/ordenes-productos.module';
import {ProductosModule} from './productos/productos.module';
import {DomiciliariosModule} from './domiciliarios/domiciliarios.module';
import {FacturasPagosModule} from './facturas-pagos/facturas-pagos.module';
import {AuthModule} from './auth/auth.module';
import {PizzaSaboresModule} from './pizza-sabores/pizza-sabores.module';
import {EstadisticasModule} from './estadisticas/estadisticas.module';
import {ThrottlerModule} from '@nestjs/throttler';
import {ThrottlerClienteGuard} from './common/guards/throttler-cliente.guard';
import {BullModule} from '@nestjs/bullmq';
import {RedisModule} from './common/redis/redis.module';
import {CierresModule} from './cierres/cierres.module';
import {EmpresaModule} from './empresa/empresa.module';
import {ContabilidadModule} from './contabilidad/contabilidad.module';
import {SocketGateway} from './common/gateways/socket.gateway';
import {ScheduleModule} from '@nestjs/schedule';
import {CajaMovimientosModule} from './caja-movimientos/caja-movimientos.module';
import {InventarioModule} from './inventario/inventario.module';
import {MigracionesDatosModule} from './common/migraciones-datos/migraciones-datos.module';

import * as Joi from 'joi';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: '.env',
			validationSchema: Joi.object({
				NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
				PORT: Joi.number().default(3000),
				DATABASE_HOST: Joi.string().required(),
				DATABASE_PORT: Joi.number().default(5432),
				DATABASE_USER: Joi.string().required(),
				DATABASE_PASSWORD: Joi.string().required(),
				DATABASE_NAME: Joi.string().required(),
				JWT_SECRET: Joi.string().required(),
				REDIS_HOST: Joi.string().default('localhost'),
				REDIS_PORT: Joi.number().default(6379),
			}),
		}),
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => {
				const config = {
					type: 'postgres' as const,
					host: configService.get<string>('DATABASE_HOST', 'localhost'),
					port: Number(configService.get<string>('DATABASE_PORT', '5432')),
					username: configService.get<string>('DATABASE_USER', 'postgres'),
					password: configService.get<string>('DATABASE_PASSWORD', 'postgres'),
					database: configService.get<string>('DATABASE_NAME', 'postgres'),
					autoLoadEntities: true,
					// OJO: synchronize también corre en producción. Solo cambios ADITIVOS en
					// entidades: quitar/renombrar una propiedad o cambiar su tipo BORRA la columna.
					synchronize: true,
					// 'schema' deja en el log el DDL que aplica synchronize en cada arranque.
					logging: ['error', 'warn', 'schema'] as ('error' | 'warn' | 'schema')[],
					timezone: 'America/Bogota', // Zona horaria explícita para fechas
				};
				return config;
			},
		}),
		ThrottlerModule.forRoot([
			{
				ttl: 60000,
				limit: 100,
			},
		]),
		BullModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				connection: {
					host: configService.get<string>('REDIS_HOST', 'localhost'),
					port: Number(configService.get<string>('REDIS_PORT', '6379')),
				},
			}),
		}),
		RedisModule,
		ScheduleModule.forRoot(),
		FacturasVentasModule,
		OrdenesModule,
		DomiciliosModule,
		ClientesModule,
		OrdenesProductosModule,
		ProductosModule,
		DomiciliariosModule,
		FacturasPagosModule,
		AuthModule,
		PizzaSaboresModule,
		EstadisticasModule,
		CierresModule,
		EmpresaModule,
		ContabilidadModule,
		CajaMovimientosModule,
		InventarioModule,
		MigracionesDatosModule,
	],
	controllers: [],
	providers: [
		SocketGateway,
		{
			// 100/min por CLIENTE real (CF-Connecting-IP detrás del túnel), no por la IP del proxy.
			provide: APP_GUARD,
			useClass: ThrottlerClienteGuard,
		},
	],
})
export class AppModule {}
