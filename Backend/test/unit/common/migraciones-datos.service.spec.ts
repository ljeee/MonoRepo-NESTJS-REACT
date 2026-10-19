import {MigracionesDatosService} from '../../../src/common/migraciones-datos/migraciones-datos.service';
import type {
	PasoBackground,
	PasoMigracion,
	PasoSync,
} from '../../../src/common/migraciones-datos/migraciones-datos.types';

/** DataSource falso: guarda los registros de migraciones_datos en memoria. */
function crearDataSource(opts: {lockLibre?: () => boolean; registros?: Record<string, any>} = {}) {
	const registros: Record<string, any> = {...(opts.registros ?? {})};
	const repo = {
		find: jest.fn(async () => Object.values(registros)),
		findOne: jest.fn(async ({where: {id}}: any) => registros[id] ?? null),
		save: jest.fn(async (fila: any) => {
			registros[fila.id] = {...fila};
			return fila;
		}),
	};
	const manager = {
		query: jest.fn(async (sql: string) =>
			sql.includes('pg_try_advisory_xact_lock') ? [{ok: opts.lockLibre ? opts.lockLibre() : true}] : [],
		),
		getRepository: jest.fn(() => repo),
	};
	const dataSource = {
		manager,
		getRepository: jest.fn(() => repo),
		transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)),
	};
	return {dataSource, registros, manager};
}

const pasoSync = (id: string, run: PasoSync['run'], dependeDe?: string[]): PasoSync => ({
	id,
	descripcion: id,
	modo: 'sync',
	run,
	dependeDe,
});

/** Espera a que terminen las tareas en segundo plano del runner. */
const vaciarCola = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('MigracionesDatosService', () => {
	const ORIGINAL_ENV = process.env.MIGRACIONES_DATOS_OFF;
	afterEach(() => {
		process.env.MIGRACIONES_DATOS_OFF = ORIGINAL_ENV;
		jest.useRealTimers();
	});

	const crearServicio = (pasos: PasoMigracion[], ds = crearDataSource()) => ({
		servicio: new MigracionesDatosService(ds.dataSource as any, pasos),
		...ds,
	});

	it('ejecuta los pasos sync en orden y registra el resultado', async () => {
		const orden: string[] = [];
		const {servicio, registros} = crearServicio([
			pasoSync('a', async () => (orden.push('a'), {filas: 1})),
			pasoSync('b', async () => (orden.push('b'), {filas: 2}), ['a']),
		]);

		await servicio.onApplicationBootstrap();

		expect(orden).toEqual(['a', 'b']);
		expect(registros.a).toEqual(expect.objectContaining({estado: 'ok', resultado: {filas: 1}}));
		expect(registros.b.ejecutadaEn).toBeInstanceOf(Date);
	});

	it('no repite pasos ya completados', async () => {
		const run = jest.fn(async () => ({}));
		const ds = crearDataSource({registros: {a: {id: 'a', estado: 'ok'}}});
		const {servicio} = crearServicio([pasoSync('a', run)], ds);

		await servicio.onApplicationBootstrap();

		expect(run).not.toHaveBeenCalled();
	});

	it('registra el error, sigue con los independientes y salta los dependientes', async () => {
		const independiente = jest.fn(async () => ({}));
		const dependiente = jest.fn(async () => ({}));
		const {servicio, registros} = crearServicio([
			pasoSync('falla', async () => {
				throw new Error('boom');
			}),
			pasoSync('depende', dependiente, ['falla']),
			pasoSync('libre', independiente),
		]);

		await servicio.onApplicationBootstrap();

		expect(registros.falla).toEqual(expect.objectContaining({estado: 'error', resultado: {error: 'boom'}}));
		expect(dependiente).not.toHaveBeenCalled();
		expect(independiente).toHaveBeenCalled();
	});

	it('omite un paso si otro proceso tiene el lock', async () => {
		const run = jest.fn(async () => ({}));
		const {servicio, registros} = crearServicio([pasoSync('a', run)], crearDataSource({lockLibre: () => false}));

		await servicio.onApplicationBootstrap();

		expect(run).not.toHaveBeenCalled();
		expect(registros.a).toBeUndefined();
	});

	it('no ejecuta nada con MIGRACIONES_DATOS_OFF=1', async () => {
		process.env.MIGRACIONES_DATOS_OFF = '1';
		const run = jest.fn(async () => ({}));
		const {servicio} = crearServicio([pasoSync('a', run)]);

		await servicio.onApplicationBootstrap();

		expect(run).not.toHaveBeenCalled();
	});

	it('corre los pasos en segundo plano por lotes y acumula los conteos', async () => {
		jest.useFakeTimers();
		let llamadas = 0;
		const paso: PasoBackground<string> = {
			id: 'bg',
			descripcion: 'bg',
			modo: 'background',
			preparar: jest.fn(async () => 'catalogo'),
			lote: jest.fn(async (_ctx, preparado) => {
				expect(preparado).toBe('catalogo');
				llamadas++;
				return {
					procesadas: 10,
					terminado: llamadas === 3,
					conteos: {procesadas: 10, errores: llamadas === 2 ? 1 : 0},
				};
			}),
		};
		const {servicio, registros} = crearServicio([paso]);

		await servicio.onApplicationBootstrap();
		// El arranque no espera al paso en segundo plano; avanzamos las pausas entre lotes.
		for (let i = 0; i < 10 && registros.bg?.estado !== 'ok'; i++) {
			await jest.advanceTimersByTimeAsync(200);
		}

		expect(paso.preparar).toHaveBeenCalledTimes(1);
		expect(paso.lote).toHaveBeenCalledTimes(3);
		expect(registros.bg).toEqual(
			expect.objectContaining({estado: 'ok', resultado: {conteos: {procesadas: 30, errores: 1}}}),
		);
	});

	it('marca error si un lote en segundo plano falla', async () => {
		const paso: PasoBackground<null> = {
			id: 'bg',
			descripcion: 'bg',
			modo: 'background',
			preparar: async () => null,
			lote: async () => {
				throw new Error('lote roto');
			},
		};
		const {servicio, registros} = crearServicio([paso]);

		await servicio.onApplicationBootstrap();
		await vaciarCola();
		await vaciarCola();

		expect(registros.bg).toEqual(expect.objectContaining({estado: 'error'}));
		expect(registros.bg.resultado.error).toBe('lote roto');
	});
});
