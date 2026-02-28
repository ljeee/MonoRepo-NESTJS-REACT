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
				console.log('TypeORM Config:', {...config, password: '***'});
				return config;
			},
		}),
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
