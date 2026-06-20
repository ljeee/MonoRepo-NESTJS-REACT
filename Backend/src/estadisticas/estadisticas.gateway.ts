import {
	WebSocketGateway,
	WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
	namespace: '/ordenes', // Reuse the same namespace as ordenes to avoid multiple connections on the frontend
	cors: {
		origin: process.env.CORS_ORIGINS
			? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
			: ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost', 'http://localhost:1420', 'http://localhost:8081', 'http://localhost:5173'],
		credentials: true,
	}
})
export class EstadisticasGateway {
	@WebSocketServer()
	server: Server;

	emitirActualizacionStats(data?: any) {
		this.server.emit('stats:update', data || { timestamp: Date.now() });
	}
}
