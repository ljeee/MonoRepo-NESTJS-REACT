import {Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown} from '@nestjs/common';
import {InjectDataSource} from '@nestjs/typeorm';
import {DataSource, EntityManager} from 'typeorm';
import {EstadoMigracionDatos, MigracionDatos} from './esquemas/migracion-datos.entity';
import {PasoBackground, PasoMigracion, PasoSync, ResultadoLote} from './migraciones-datos.types';
import {acumularConteos} from './migraciones-datos.utils';

/** Token del registro ordenado de pasos (ver pasos/index.ts). */
export const PASOS_MIGRACION_DATOS = Symbol('PASOS_MIGRACION_DATOS');

/** Pausa entre lotes en segundo plano: el contenedor de la BD tiene poca memoria. */
const PAUSA_ENTRE_LOTES_MS = 150;
/** Si otro proceso tiene el lock de un paso en segundo plano, reintentar tras esta espera. */
const ESPERA_LOCK_OCUPADO_MS = 5000;
/** Cada cuántos lotes se persiste el progreso del paso en segundo plano. */
const LOTES_POR_GUARDADO = 10;

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ejecuta al arrancar las migraciones de datos pendientes, en orden y una sola vez.
 *
 * - `synchronize` corre ANTES (crea tablas/columnas nuevas); esto solo mueve o deriva datos.
 * - Cada paso toma un advisory lock a nivel de transacción: dos instancias (o un
 *   reinicio del modo watch) no lo ejecutan a la vez.
 * - Un paso que falla queda en 'error' y la app arranca igual; los que dependen de él
 *   se saltan hasta el siguiente arranque.
 * - Apagado de emergencia: MIGRACIONES_DATOS_OFF=1.
 */
@Injectable()
export class MigracionesDatosService implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger('MigracionesDatos');
	private deteniendo = false;

	constructor(
		@InjectDataSource() private readonly dataSource: DataSource,
		@Inject(PASOS_MIGRACION_DATOS) private readonly pasos: PasoMigracion[],
	) {}

	async onApplicationBootstrap(): Promise<void> {
		if (['1', 'true'].includes((process.env.MIGRACIONES_DATOS_OFF ?? '').toLowerCase())) {
			this.logger.warn('MIGRACIONES_DATOS_OFF activo: no se ejecutan migraciones de datos.');
			return;
		}
		try {
			await this.ejecutarPendientes();
		} catch (err) {
			// Nunca impedir el arranque por una migración de datos.
			this.logger.error(`Fallo inesperado ejecutando migraciones de datos: ${(err as Error)?.message}`);
		}
	}

	onApplicationShutdown(): void {
		this.deteniendo = true;
	}

	/** Estado actual de cada paso registrado (para endpoints de diagnóstico). */
	async estado(): Promise<MigracionDatos[]> {
		return this.dataSource.getRepository(MigracionDatos).find({order: {id: 'ASC'}});
	}

	async ejecutarPendientes(): Promise<void> {
		const registros = await this.dataSource.getRepository(MigracionDatos).find();
		const estados = new Map<string, EstadoMigracionDatos>(registros.map((r) => [r.id, r.estado]));

		for (const paso of this.pasos) {
			if (estados.get(paso.id) === 'ok') continue;

			const faltantes = (paso.dependeDe ?? []).filter((dep) => estados.get(dep) !== 'ok');
			if (faltantes.length) {
				this.logger.warn(`Paso "${paso.id}" en espera: dependencias sin completar (${faltantes.join(', ')}).`);
				continue;
			}

			if (paso.modo === 'sync') {
				const ok = await this.correrSync(paso);
				if (ok !== null) estados.set(paso.id, ok ? 'ok' : 'error');
			} else {
				// En segundo plano: no bloquea el arranque. Sus dependientes correrán en el
				// próximo arranque, cuando el registro ya diga 'ok'.
				estados.set(paso.id, 'en_progreso');
				void this.correrBackground(paso);
			}
		}
	}

	/** @returns true = ok, false = error, null = otro proceso lo está ejecutando. */
	private async correrSync(paso: PasoSync): Promise<boolean | null> {
		this.logger.log(`Ejecutando "${paso.id}": ${paso.descripcion}`);
		try {
			const resultado = await this.dataSource.transaction(async (manager) => {
				if (!(await this.tomarLock(manager, paso.id))) return null;
				const res = await paso.run({manager, log: (m) => this.logger.log(`[${paso.id}] ${m}`)});
				await this.guardar(manager, paso.id, 'ok', res);
				return res;
			});
			if (resultado === null) {
				this.logger.warn(`"${paso.id}" lo está ejecutando otro proceso; se omite.`);
				return null;
			}
			this.logger.log(`"${paso.id}" terminado: ${JSON.stringify(resultado)}`);
			return true;
		} catch (err) {
			const mensaje = (err as Error)?.message ?? String(err);
			this.logger.error(`"${paso.id}" falló: ${mensaje}`);
			await this.guardar(this.dataSource.manager, paso.id, 'error', {error: mensaje}).catch(() => undefined);
			return false;
		}
	}

	private async correrBackground(paso: PasoBackground<unknown>): Promise<void> {
		this.logger.log(`Iniciando en segundo plano "${paso.id}": ${paso.descripcion}`);
		const previo = await this.dataSource.getRepository(MigracionDatos).findOne({where: {id: paso.id}});
		const acumulado: Record<string, number> = {...((previo?.resultado?.conteos as Record<string, number>) ?? {})};

		try {
			const preparado = await paso.preparar(this.dataSource.manager);
			await this.guardar(this.dataSource.manager, paso.id, 'en_progreso', {conteos: acumulado});

			let lotes = 0;
			while (!this.deteniendo) {
				const resultado: ResultadoLote | null = await this.dataSource.transaction(async (manager) => {
					if (!(await this.tomarLock(manager, paso.id))) return null;
					return paso.lote({manager, log: (m) => this.logger.log(`[${paso.id}] ${m}`)}, preparado);
				});

				if (resultado === null) {
					await esperar(ESPERA_LOCK_OCUPADO_MS);
					continue;
				}

				acumularConteos(acumulado, resultado.conteos);
				lotes++;

				if (resultado.terminado) {
					await this.guardar(this.dataSource.manager, paso.id, 'ok', {conteos: acumulado});
					this.logger.log(`"${paso.id}" terminado: ${JSON.stringify(acumulado)}`);
					return;
				}
				if (lotes % LOTES_POR_GUARDADO === 0) {
					await this.guardar(this.dataSource.manager, paso.id, 'en_progreso', {conteos: acumulado});
				}
				await esperar(PAUSA_ENTRE_LOTES_MS);
			}

			// Apagado a mitad de camino: se guarda el progreso; el siguiente arranque sigue.
			await this.guardar(this.dataSource.manager, paso.id, 'en_progreso', {conteos: acumulado});
		} catch (err) {
			const mensaje = (err as Error)?.message ?? String(err);
			this.logger.error(`"${paso.id}" falló: ${mensaje}`);
			await this.guardar(this.dataSource.manager, paso.id, 'error', {conteos: acumulado, error: mensaje}).catch(
				() => undefined,
			);
		}
	}

	private async tomarLock(manager: EntityManager, pasoId: string): Promise<boolean> {
		const [fila]: {ok: boolean}[] = await manager.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS ok', [
			`migraciones_datos:${pasoId}`,
		]);
		return Boolean(fila?.ok);
	}

	private async guardar(
		manager: EntityManager,
		id: string,
		estado: EstadoMigracionDatos,
		resultado: Record<string, unknown>,
	): Promise<void> {
		await manager.getRepository(MigracionDatos).save({
			id,
			estado,
			ejecutadaEn: estado === 'ok' ? new Date() : null,
			resultado,
		});
	}
}
