import {WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect} from '@nestjs/websockets';
import {Server, Socket} from 'socket.io';
import {JwtService} from '@nestjs/jwt';
import {JwtPayload} from '../auth/types/jwt-payload.type';
import {Role} from '../auth/roles.enum';

@WebSocketGateway({
	namespace: '/ordenes',
	cors: {
		origin: process.env.CORS_ORIGINS
			? process.env.CORS_ORIGINS.split(',')
					.map((o) => o.trim())
					.filter(Boolean)
			: [
					'tauri://localhost',
					'http://tauri.localhost',
					'https://tauri.localhost',
					'http://localhost:1420',
					'http://localhost:8081',
					'http://localhost:5173',
				],
		credentials: true,
	},
})
export class OrdenesGateway implements OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer()
	server: Server;

	constructor(private readonly jwtService: JwtService) {}

	handleConnection(client: Socket) {
		// El socket antes confiaba ciegamente en un string `dispositivo` declarado
		// por el cliente, sin validar identidad — cualquiera podía conectarse y
		// escuchar todos los eventos (orden:nueva, stats:update, etc.). Ahora se
		// exige un JWT válido para poder conectar.
		const token = client.handshake.auth?.token;
		if (!token) {
			client.disconnect(true);
			return;
		}

		let payload: JwtPayload;
		try {
			payload = this.jwtService.verify<JwtPayload>(token);
		} catch {
			client.disconnect(true);
			return;
		}

		const dispositivo = client.handshake.auth?.dispositivo || payload.roles?.[0] || 'desconocido';
		client.data.user = payload;
		client.join(`auth:${dispositivo}`);
		if (dispositivo === 'cocina' || payload.roles?.includes(Role.Cocina)) {
			client.join('cocina');
		}
		console.log(`[Socket.IO] Cliente conectado: ${client.id} - Usuario: ${payload.username} - Rol: ${dispositivo}`);
	}

	handleDisconnect(client: Socket) {
		console.log(`[Socket.IO] Cliente desconectado: ${client.id}`);
	}

	emitirNuevaOrden(orden: any) {
		this.server.emit('orden:nueva', orden);
		this.server.to('cocina').emit('cocina:nueva-orden', orden);
	}

	emitirOrdenActualizada(orden: any) {
		this.server.emit('orden:actualizada', orden);
	}

	emitirHandoffWhatsapp(data: any) {
		this.server.emit('whatsapp:handoff', data);
	}

	emitirActualizacionStats(data?: any) {
		this.server.emit('stats:update', data || {timestamp: Date.now()});
	}
}
