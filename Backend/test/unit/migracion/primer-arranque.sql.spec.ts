import {PGlite} from '@electric-sql/pglite';
import {getMetadataArgsStorage} from 'typeorm';
import {Productos} from '../../../src/productos/esquemas/productos.entity';
import {estructuraAnterior, seedMenu} from './estructura-anterior';

/**
 * PRIMER ARRANQUE de un volumen nuevo (entorno local en Docker, servidor recién formateado): el contenedor db corre
 * 01-init.sql (estructura anterior) y después 02-seed-menu.sql (montajes de docker-compose.yml). Si el segundo falla,
 * el entrypoint de postgres se corta a mitad, el contenedor se reinicia SIN repetir la inicialización y el primer
 * `docker compose up` termina en "container pos-local-db is unhealthy". Pasó con `productos.personalizacion`, que
 * seed-menu.sql usaba y init.sql no tiene.
 */
describe('Primer arranque de la base: init.sql + seed-menu.sql', () => {
	let pg: PGlite;
	const contar = async (sql: string) => (await pg.query<{n: number}>(sql)).rows[0].n;

	beforeAll(async () => {
		pg = new PGlite();
		await pg.exec(estructuraAnterior());
		await pg.exec(`SELECT set_config('search_path', '"$user", public', false);`);
	});

	afterAll(async () => {
		await pg?.close();
	});

	it('seed-menu.sql corre completo sobre la estructura de init.sql', async () => {
		await pg.exec(seedMenu());
		expect(await contar('SELECT count(*)::int AS n FROM productos')).toBeGreaterThan(0);
		expect(await contar('SELECT count(*)::int AS n FROM producto_variantes')).toBeGreaterThan(0);
		expect(await contar('SELECT count(*)::int AS n FROM pizza_sabores')).toBeGreaterThan(0);
	});

	it('crea productos.personalizacion igual que la entidad (synchronize no la toca) y con los valores que leen los pasos de datos', async () => {
		const columna = getMetadataArgsStorage().columns.find(
			(c) => c.target === Productos && c.propertyName === 'personalizacion',
		);
		expect(columna?.options).toMatchObject({name: 'personalizacion', type: 'text', nullable: true});
		expect(columna?.options.default).toBeUndefined();

		const enBase = await pg.query(
			`SELECT data_type, is_nullable, column_default FROM information_schema.columns
			  WHERE table_name = 'productos' AND column_name = 'personalizacion'`,
		);
		expect(enBase.rows).toEqual([{data_type: 'text', is_nullable: 'YES', column_default: null}]);

		// productos-categoria-v1 y sabor-grupos-v1 asignan categoría y grupo de sabores con este valor.
		expect(
			await contar(`SELECT count(*)::int AS n FROM productos WHERE personalizacion = 'calzone'`),
		).toBeGreaterThan(0);
	});

	it('se puede volver a correr a mano (borra y recrea el menú)', async () => {
		const antes = await contar('SELECT count(*)::int AS n FROM productos');
		await pg.exec(seedMenu());
		expect(await contar('SELECT count(*)::int AS n FROM productos')).toBe(antes);
	});
});
