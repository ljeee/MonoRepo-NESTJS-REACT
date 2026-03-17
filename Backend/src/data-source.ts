import 'reflect-metadata';
import {DataSource} from 'typeorm';

export const AppDataSource = new DataSource({
	type: 'postgres',
	host: process.env.DATABASE_HOST || 'localhost',
	port: parseInt(process.env.DATABASE_PORT || '5432', 10),
	username: process.env.DATABASE_USER || 'postgres',
	password: process.env.DATABASE_PASSWORD || 'postgres',
	database: process.env.DATABASE_NAME || 'postgres',
	synchronize: false, // ¡IMPORTANTE! Nunca usar true en producción
	logging: true,
	entities: [__dirname + '/**/esquemas/*.entity.{ts,js}'],
	migrations: [__dirname + '/../migrations/*.{ts,js}'],
});
