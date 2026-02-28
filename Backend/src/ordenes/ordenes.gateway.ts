import {
	WebSocketGateway,
	WebSocketServer,
	OnGatewayConnection,
	OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
	namespace: '/ordenes',
	cors: {
		origin: (requestOrigin, cb) => {
		    cb(null, true);
		},
		credentials: true,
	}
})
export class OrdenesGateway implements OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer()
	server: Server;

	handleConnection(client: Socket) {
		const dispositivo = client.handshake.auth?.dispositivo;
		if (dispositivo) {
			client.join(`auth:${dispositivo}`);
			if (dispositivo === 'cocina') {
				client.join('cocina');
			}
		}
		console.log(`[Socket.IO] Cliente conectado: ${client.id} - Rol: ${dispositivo || 'desconocido'}`);
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
}
