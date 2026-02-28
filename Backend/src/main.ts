import * as dotenv from 'dotenv';
dotenv.config();

import {NestFactory} from '@nestjs/core';
import {ValidationPipe} from '@nestjs/common';
import {AppModule} from './app.module';
import {DocumentBuilder, SwaggerModule} from '@nestjs/swagger';
import {LoggingInterceptor} from './common/interceptors/logging.interceptor';
import {RedisIoAdapter} from './common/redis/redis.adapter';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	// Global request/response logging
	app.useGlobalInterceptors(new LoggingInterceptor());

	// Enforce DTO validation/transformation
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			transform: true,
			transformOptions: {enableImplicitConversion: true},
		}),
	);

	const config = new DocumentBuilder()
		.setTitle('DfiruBack API')
		.setDescription('Documentación Swagger de la API DfiruBack')
		.setVersion('1.0')
		.addBearerAuth()
		.build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('swagger', app, document, {
		swaggerOptions: {persistAuthorization: true},
	});

	// Habilitar CORS con lista de orígenes permitidos (CORS_ORIGINS separado por comas)
	const allowedOrigins = process.env.CORS_ORIGINS
		?.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);

	app.enableCors({
		origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : true,
		credentials: true,
	});

	// Configurar Redis IO Adapter
	const redisIoAdapter = new RedisIoAdapter(app);
	await redisIoAdapter.connectToRedis();
	app.useWebSocketAdapter(redisIoAdapter);

	const port = Number(process.env.PORT) || 3000;
	// HOST puede ser una IP específica (ej: 192.168.1.50) o 0.0.0.0 para todas las interfaces
	// IP por defecto: 0.0.0.0 (todas las interfaces). Evitar IP inválida hardcodeada.
	const host = process.env.HOST || '0.0.0.0';
	await app.listen(port, host);
	console.log(`Servidor escuchando en http://${host}:${port}`);
}
bootstrap().catch((err) => {
	console.error('Error al iniciar la aplicación', err);
	process.exit(1);
});
