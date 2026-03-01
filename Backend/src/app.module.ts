import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {ConfigModule, ConfigService} from '@nestjs/config';
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
import {ThrottlerModule} from '@nestjs/throttler';
import {BullModule} from '@nestjs/bullmq';
import {RedisModule} from './common/redis/redis.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: '.env',
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
					synchronize: true,
				};
				return config;
			},
		}),
		ThrottlerModule.forRoot([{
			ttl: 60000,
			limit: 100,
		}]),
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
	],
	controllers: [],
	providers: [],
})
export class AppModule {}
