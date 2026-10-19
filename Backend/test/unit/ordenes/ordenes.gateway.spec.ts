import {OrdenesGateway} from '../../../src/ordenes/ordenes.gateway';
import {Role} from '../../../src/auth/roles.enum';

/** Socket falso con lo que usa handleConnection. */
function crearSocket(auth: Record<string, unknown>) {
	return {
		id: 'socket-1',
		handshake: {auth},
		data: {} as Record<string, unknown>,
		disconnect: jest.fn(),
		join: jest.fn(),
	};
}

describe('OrdenesGateway.handleConnection', () => {
	const jwtService = {verify: jest.fn()};
	const gateway = new OrdenesGateway(jwtService as any);

	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	it('desconecta si no hay token', () => {
		const socket = crearSocket({});
		gateway.handleConnection(socket as any);
		expect(socket.disconnect).toHaveBeenCalledWith(true);
	});

	it('desconecta si el token es inválido', () => {
		jwtService.verify.mockImplementation(() => {
			throw new Error('jwt malformed');
		});
		const socket = crearSocket({token: 'x'});
		gateway.handleConnection(socket as any);
		expect(socket.disconnect).toHaveBeenCalledWith(true);
	});

	it('desconecta a un cliente final aunque declare dispositivo "cocina"', () => {
		jwtService.verify.mockReturnValue({sub: '3001234567', username: '3001234567', roles: [Role.Cliente]});
		const socket = crearSocket({token: 'ok', dispositivo: 'cocina'});
		gateway.handleConnection(socket as any);
		expect(socket.disconnect).toHaveBeenCalledWith(true);
		expect(socket.join).not.toHaveBeenCalled();
	});

	it('desconecta un token sin roles', () => {
		jwtService.verify.mockReturnValue({sub: 'u', username: 'u', roles: []});
		const socket = crearSocket({token: 'ok'});
		gateway.handleConnection(socket as any);
		expect(socket.disconnect).toHaveBeenCalledWith(true);
	});

	it('acepta staff y lo une a sus salas', () => {
		jwtService.verify.mockReturnValue({sub: 'u1', username: 'cocinero', roles: [Role.Cocina]});
		const socket = crearSocket({token: 'ok'});
		gateway.handleConnection(socket as any);
		expect(socket.disconnect).not.toHaveBeenCalled();
		expect(socket.join).toHaveBeenCalledWith('cocina');
	});

	it('acepta a un domiciliario (RiderApp)', () => {
		jwtService.verify.mockReturnValue({sub: 'u2', username: '3110000000', roles: [Role.Domiciliario]});
		const socket = crearSocket({token: 'ok', dispositivo: 'domiciliario'});
		gateway.handleConnection(socket as any);
		expect(socket.disconnect).not.toHaveBeenCalled();
		expect(socket.join).toHaveBeenCalledWith('auth:domiciliario');
	});
});
