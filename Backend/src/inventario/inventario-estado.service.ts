import {Injectable, ServiceUnavailableException} from '@nestjs/common';
import {DataSource, EntityManager} from 'typeorm';

export const ID_MIGRACION_INVENTARIO = 'inventario-unificado-v1';

/**
 * ¿Ya corrió bien la migración al inventario unificado? Hasta entonces las órdenes no
 * consumen (no hay de dónde) y los endpoints responden 503. La fecha de corte separa
 * las órdenes viejas (descontadas por el sistema anterior, no se tocan) de las nuevas.
 */
@Injectable()
export class InventarioEstadoService {
	private corte: Date | null = null;

	constructor(private readonly dataSource: DataSource) {}

	/** Fecha de corte de la migración, o null si aún no terminó bien. Cachea el éxito. */
	async fechaCorte(manager: EntityManager = this.dataSource.manager): Promise<Date | null> {
		if (this.corte) return this.corte;
		try {
			const [fila]: {estado: string; corte: string | null}[] = await manager.query(
				`SELECT estado, resultado->>'fechaCorte' AS corte FROM migraciones_datos WHERE id = $1`,
				[ID_MIGRACION_INVENTARIO],
			);
			if (fila?.estado === 'ok' && fila.corte) this.corte = new Date(fila.corte);
		} catch {
			// Tabla aún inexistente (instalación nueva antes del primer arranque completo).
		}
		return this.corte;
	}

	async asegurarListo(): Promise<Date> {
		const corte = await this.fechaCorte();
		if (!corte) {
			throw new ServiceUnavailableException(
				'El inventario se está migrando al modelo nuevo. Intenta de nuevo en unos minutos.',
			);
		}
		return corte;
	}
}
