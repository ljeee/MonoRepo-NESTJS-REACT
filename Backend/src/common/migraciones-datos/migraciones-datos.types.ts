import type {EntityManager} from 'typeorm';

export interface ContextoPaso {
	/** Manager de la transacción en curso: usar SOLO este (nada de repos inyectados). */
	manager: EntityManager;
	log: (mensaje: string) => void;
}

interface PasoBase {
	/** Identificador estable, versionado (p. ej. 'ventas-detalle-v1'). Nunca reutilizar. */
	id: string;
	descripcion: string;
	/** Pasos que deben estar en 'ok' antes de correr este. */
	dependeDe?: string[];
}

/** Corre completo en UNA transacción durante el arranque (Nest lo espera antes de escuchar). */
export interface PasoSync extends PasoBase {
	modo: 'sync';
	run(ctx: ContextoPaso): Promise<Record<string, unknown>>;
}

export interface ResultadoLote {
	procesadas: number;
	/** true cuando ya no queda nada por procesar. */
	terminado: boolean;
	/** Conteos del lote; el runner los acumula. */
	conteos: Record<string, number>;
}

/** Corre por lotes en segundo plano tras el arranque, cada lote en su propia transacción. */
export interface PasoBackground<TPreparado = unknown> extends PasoBase {
	modo: 'background';
	/** Datos compartidos entre lotes (p. ej. el catálogo). Se calcula una vez por arranque. */
	preparar(manager: EntityManager): Promise<TPreparado>;
	lote(ctx: ContextoPaso, preparado: TPreparado): Promise<ResultadoLote>;
}

export type PasoMigracion = PasoSync | PasoBackground<any>;
