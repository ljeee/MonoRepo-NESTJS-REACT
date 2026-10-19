import {clienteDeLaPeticion} from '../../../src/common/guards/throttler-cliente.guard';

/**
 * Detrás del túnel de Cloudflare todas las peticiones llegan desde el contenedor `cloudflared`: si el límite
 * contara por `req.ip`, todos los usuarios compartirían una sola cuota de 100/min.
 */
describe('clienteDeLaPeticion (límite de peticiones por cliente real)', () => {
	const PROXY = '172.18.0.5';

	it('detrás de Cloudflare: dos clientes distintos son dos cuotas, aunque lleguen desde la misma IP del proxy', () => {
		const a = clienteDeLaPeticion({ip: PROXY, headers: {'cf-connecting-ip': '190.10.1.1'}});
		const b = clienteDeLaPeticion({ip: PROXY, headers: {'cf-connecting-ip': '181.55.2.2'}});

		expect(a).toBe('190.10.1.1');
		expect(b).toBe('181.55.2.2');
		expect(a).not.toBe(b);
	});

	it('con un proxy común usa el primer valor de X-Forwarded-For', () => {
		expect(clienteDeLaPeticion({ip: PROXY, headers: {'x-forwarded-for': '200.1.1.1, 10.0.0.2'}})).toBe('200.1.1.1');
	});

	it('Cloudflare manda sobre X-Forwarded-For (que el cliente puede inventar)', () => {
		expect(clienteDeLaPeticion({ip: PROXY, headers: {'cf-connecting-ip': '190.10.1.1', 'x-forwarded-for': '1.1.1.1'}})).toBe('190.10.1.1');
	});

	it('en la red local, sin proxy, es la IP del dispositivo', () => {
		expect(clienteDeLaPeticion({ip: '192.168.1.40', headers: {}})).toBe('192.168.1.40');
		expect(clienteDeLaPeticion({socket: {remoteAddress: '192.168.1.41'}})).toBe('192.168.1.41');
	});

	it('encabezados vacíos o en forma de lista no rompen', () => {
		expect(clienteDeLaPeticion({ip: PROXY, headers: {'cf-connecting-ip': '  ', 'x-forwarded-for': ''}})).toBe(PROXY);
		expect(clienteDeLaPeticion({ip: PROXY, headers: {'cf-connecting-ip': ['190.10.1.1']}})).toBe('190.10.1.1');
	});
});
