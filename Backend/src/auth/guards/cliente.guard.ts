import {CanActivate, ExecutionContext, ForbiddenException, Injectable} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {IS_PUBLIC_KEY} from '../decorators/public.decorator';
import {Role} from '../roles.enum';

/**
 * Rutas (método + path exacto) que el rol cliente puede llamar con su token.
 * Es lo único que ClientWeb consume fuera de las rutas @Public (login/registro/
 * refresh, GET /productos, /pizza-sabores y /empresa pasan sin token): crear
 * su pedido. OrdenesController ya endurece ese POST para el rol cliente.
 *
 * Comparación exacta, no por prefijo: '/ordenes' no debe abrir
 * '/ordenes-productos' ni '/ordenes/:id/completar'. main.ts no usa
 * setGlobalPrefix; si se agrega, hay que anteponerlo aquí (y en ContadorGuard).
 */
const CLIENTE_ALLOWED_ROUTES = ['POST /ordenes'];

/** Lo que el guard lee del request de Express (`user` lo adjunta JwtStrategy). */
type RequestAutenticado = {
	method: string;
	originalUrl?: string;
	url?: string;
	user?: {roles?: Role[]};
};

/** Quita la querystring y un slash final (Express enruta '/ordenes/' igual que '/ordenes'). */
function normalizarPath(url: string): string {
	const path = url.split('?')[0];
	return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/**
 * El rol cliente (auto-registro público desde ClientWeb) solo puede crear pedidos:
 * - RolesGuard deja pasar toda ruta sin @Roles, así que sin este guard un cliente
 *   podía tocar inventario, productos, facturas…
 * - Las rutas @Public siguen abiertas para todos (catálogo, empresa, login/refresh).
 * - Solo aplica si el ÚNICO rol del usuario es cliente: el staff (domiciliario y
 *   contador incluidos) no se ve afectado.
 * Corre después de JwtAuthGuard: necesita `req.user` para saber quién llama.
 */
@Injectable()
export class ClienteGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		if (isPublic) {
			return true;
		}

		const request = context.switchToHttp().getRequest<RequestAutenticado>();
		const roles = request.user?.roles ?? [];

		// Sin usuario decide JwtAuthGuard; con algún rol de staff este guard no aplica
		if (roles.length === 0 || roles.some((role) => role !== Role.Cliente)) {
			return true;
		}

		const url = request.originalUrl ?? request.url ?? '';
		if (!CLIENTE_ALLOWED_ROUTES.includes(`${request.method} ${normalizarPath(url)}`)) {
			throw new ForbiddenException('El rol cliente solo puede crear pedidos a domicilio');
		}

		return true;
	}
}
