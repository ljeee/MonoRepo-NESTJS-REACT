import * as dotenv from 'dotenv';
dotenv.config();

import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {DocumentBuilder, SwaggerModule} from '@nestjs/swagger';
import {LoggingInterceptor} from './common/interceptors/logging.interceptor';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	// Global request/response logging
	app.useGlobalInterceptors(new LoggingInterceptor());

	const config = new DocumentBuilder()
		.setTitle('DfiruBack API')
		.setDescription('Documentación Swagger de la API DfiruBack')
		.setVersion('1.0')
		.build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('api', app, document);

	// Habilitar CORS para permitir acceso desde otras máquinas en la red
	app.enableCors({
		origin: true,
		credentials: true,
	});

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
