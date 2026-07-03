import {CanActivate, ExecutionContext, ForbiddenException, Injectable} from '@nestjs/common';
import {Role} from '../roles.enum';

/**
 * Prefijos de ruta que el rol contador puede consultar (solo lectura).
 * Cubre lo que consume la pantalla de Contabilidad: reportes contables,
 * estadísticas, facturas de ventas y gastos.
 */
const CONTADOR_ALLOWED_PREFIXES = ['/contabilidad', '/estadisticas', '/facturas-ventas', '/facturas-pagos'];

/**
 * El rol contador es de SOLO LECTURA y limitado a contabilidad:
 * - Bloquea cualquier método distinto de GET (no puede cambiar nada).
 * - Bloquea rutas fuera de la whitelist (no puede tocar órdenes, productos, caja…).
 * Corre después de JwtAuthGuard/RolesGuard; en rutas @Public no hay `user`
 * adjunto, así que no interfiere con login/refresh.
 */
@Injectable()
export class ContadorGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		const user = request.user;

		// Solo aplica a usuarios cuyo único perfil operativo es contador
		if (!user?.roles?.includes(Role.Contador) || user.roles.includes(Role.Admin)) {
			return true;
		}

		if (request.method !== 'GET') {
			throw new ForbiddenException('El rol contador es de solo lectura');
		}

		const url: string = request.originalUrl ?? request.url ?? '';
		if (!CONTADOR_ALLOWED_PREFIXES.some((prefix) => url.startsWith(prefix))) {
			throw new ForbiddenException('El rol contador solo puede acceder a contabilidad');
		}

		return true;
	}
}
