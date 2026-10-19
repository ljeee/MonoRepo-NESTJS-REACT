import {Injectable} from '@nestjs/common';
import {ThrottlerGuard} from '@nestjs/throttler';

const primero = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? '') : typeof v === 'string' ? v : '').trim();

/**
 * Quién hizo la petición, para el límite de peticiones por minuto. Detrás del túnel de Cloudflare `req.ip`
 * es SIEMPRE la del contenedor `cloudflared`: con el ThrottlerGuard de serie todos los usuarios (POS,
 * ClientWeb, RiderApp) compartían una sola cuota de 100/min y en hora pico recibían 429. Cloudflare manda la
 * IP real en `CF-Connecting-IP`; un proxy común, en el primer valor de `X-Forwarded-For`. En la red local
 * (sin proxy) no viene ninguna y se usa la IP del dispositivo.
 */
export function clienteDeLaPeticion(req: Record<string, any>): string {
	const encabezados = (req.headers ?? {}) as Record<string, unknown>;
	const cloudflare = primero(encabezados['cf-connecting-ip']);
	if (cloudflare) return cloudflare;
	const reenviado = primero(encabezados['x-forwarded-for']).split(',')[0]?.trim();
	if (reenviado) return reenviado;
	return String(req.ip ?? req.socket?.remoteAddress ?? 'desconocido');
}

/** El ThrottlerGuard global, contando por cliente real en vez de por la IP del proxy. */
@Injectable()
export class ThrottlerClienteGuard extends ThrottlerGuard {
	protected getTracker(req: Record<string, any>): Promise<string> {
		return Promise.resolve(clienteDeLaPeticion(req));
	}
}
