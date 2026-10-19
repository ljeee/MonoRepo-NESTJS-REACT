import {PGlite} from '@electric-sql/pglite';
import {saborGruposV1} from '../../../src/common/migraciones-datos/pasos/sabor-grupos-v1';

/**
 * Corre el SQL REAL de la migración contra PGlite. Lo importante: los precios que se cobran HOY no cambian
 * al pasar a grupos (ver la lógica antigua: solo los sabores especiales cobraban recargo por tamaño y el
 * extra de 3 sabores era `valor || 3000`).
 */
describe('sabor-grupos-v1 (PGlite)', () => {
	let pg: PGlite;
	let manager: {query: (sql: string, params?: unknown[]) => Promise<any[]>};
	const log = jest.fn();

	const ESQUEMA = `
		CREATE TABLE sabor_grupos (
			id serial PRIMARY KEY, nombre varchar(60) UNIQUE, max_sabores int, variante_es_sabor boolean,
			usa_tamano boolean, recargo_extra_desde int, recargo_extra_pequena numeric DEFAULT 0,
			recargo_extra_mediana numeric DEFAULT 0, recargo_extra_grande numeric DEFAULT 0,
			activo boolean DEFAULT true, orden int DEFAULT 0);
		CREATE TABLE pizza_sabores (
			sabor_id serial PRIMARY KEY, nombre text, tipo text, grupo_id int REFERENCES sabor_grupos(id),
			recargo_pequena numeric DEFAULT 0, recargo_mediana numeric DEFAULT 0, recargo_grande numeric DEFAULT 0,
			activo boolean DEFAULT true);
		CREATE TABLE productos (producto_id serial PRIMARY KEY, producto_nombre text, personalizacion text, sabor_grupo_id int);
		CREATE TABLE producto_variantes (variante_id serial PRIMARY KEY, producto_id int, nombre text, tamano varchar(20));
	`;

	const ids = async (sql: string) => (await manager.query(sql)).map((r: any) => Object.values(r)[0]);
	const sabor = async (nombre: string, tipo: string) =>
		(await manager.query('SELECT * FROM pizza_sabores WHERE nombre = $1 AND tipo = $2', [nombre, tipo]))[0];

	beforeAll(async () => {
		pg = new PGlite();
		await pg.exec(ESQUEMA);
		await pg.exec(`
			INSERT INTO pizza_sabores (nombre, tipo, recargo_pequena, recargo_mediana, recargo_grande) VALUES
			 ('Paisa','especial',1000,2000,2500),
			 ('Paisa','tradicional',0,0,0),
			 ('Carnes','tradicional',500,500,500),
			 ('Hawaiana','especial',1500,2500,3000),
			 ('De Casa','calzone',0,0,0),
			 ('RECARGO_3_SABORES','configuracion',3500,0,5000);
			INSERT INTO productos (producto_nombre, personalizacion) VALUES
			 ('Pizza','pizza'), ('Calzone',NULL), ('GASEOSA',NULL), ('Pizza Burguer',NULL);
			INSERT INTO producto_variantes (producto_id, nombre) VALUES
			 (1,'Pequeña'), (1,'Mediana'), (1,'Grande'), (1,'Familiar'), (2,'De Casa'), (3,'Coca Cola Personal');
		`);
		manager = {query: async (sql, params = []) => (await pg.query(sql, params as any[])).rows};
	}, 60000);

	afterAll(async () => {
		await pg?.close();
	});

	let resultado: Record<string, any>;

	it('corre sin errores y reporta los conteos', async () => {
		resultado = (await saborGruposV1.run({manager: manager as any, log} as any)) as Record<string, any>;

		expect(resultado.saboresAsignados).toBe(4);
		expect(resultado.saboresDuplicadosSinGrupo).toEqual(['Paisa (tradicional)']);
		expect(resultado.recargosTradicionalesAnulados).toEqual(['Carnes']);
	});

	it('crea los grupos base; el extra por 3 sabores copia la config y usa 3000 donde estaba en 0', async () => {
		const [pizza] = await manager.query("SELECT * FROM sabor_grupos WHERE nombre = 'Pizza'");
		const [calzone] = await manager.query("SELECT * FROM sabor_grupos WHERE nombre = 'Calzone'");

		expect(pizza).toEqual(
			expect.objectContaining({
				max_sabores: 3,
				usa_tamano: true,
				variante_es_sabor: false,
				recargo_extra_desde: 3,
			}),
		);
		// Config: pequeña 3500, mediana 0 (→ se cobraba 3000), grande 5000.
		expect(
			[pizza.recargo_extra_pequena, pizza.recargo_extra_mediana, pizza.recargo_extra_grande].map(Number),
		).toEqual([3500, 3000, 5000]);
		expect(calzone).toEqual(
			expect.objectContaining({
				max_sabores: 2,
				usa_tamano: false,
				variante_es_sabor: true,
				recargo_extra_desde: null,
			}),
		);
	});

	it('asigna los sabores a su grupo y deja los repetidos inactivos (gana el especial)', async () => {
		const grupos = Object.fromEntries(
			(await manager.query('SELECT id, nombre FROM sabor_grupos')).map((g: any) => [g.nombre, g.id]),
		);

		expect((await sabor('Paisa', 'especial')).grupo_id).toBe(grupos.Pizza);
		expect((await sabor('Hawaiana', 'especial')).grupo_id).toBe(grupos.Pizza);
		expect((await sabor('De Casa', 'calzone')).grupo_id).toBe(grupos.Calzone);

		const repetido = await sabor('Paisa', 'tradicional');
		expect(repetido.grupo_id).toBeNull();
		expect(repetido.activo).toBe(false);
	});

	it('conserva los recargos de los especiales y anula los de los tradicionales (nunca cobraron)', async () => {
		const paisa = await sabor('Paisa', 'especial');
		expect([paisa.recargo_pequena, paisa.recargo_mediana, paisa.recargo_grande].map(Number)).toEqual([
			1000, 2000, 2500,
		]);

		const carnes = await sabor('Carnes', 'tradicional');
		expect([carnes.recargo_pequena, carnes.recargo_mediana, carnes.recargo_grande].map(Number)).toEqual([0, 0, 0]);
	});

	it('deja intacta la fila de configuración heredada', async () => {
		const config = await sabor('RECARGO_3_SABORES', 'configuracion');
		expect(config.grupo_id).toBeNull();
		expect(Number(config.recargo_grande)).toBe(5000);
	});

	it('asigna productos al grupo que resolvía el código (personalizacion o nombre) y deja los demás sin grupo', async () => {
		const filas = await manager.query(
			'SELECT p.producto_nombre AS nombre, g.nombre AS grupo FROM productos p LEFT JOIN sabor_grupos g ON g.id = p.sabor_grupo_id ORDER BY p.producto_id',
		);
		expect(filas).toEqual([
			{nombre: 'Pizza', grupo: 'Pizza'},
			{nombre: 'Calzone', grupo: 'Calzone'},
			{nombre: 'GASEOSA', grupo: null},
			{nombre: 'Pizza Burguer', grupo: null},
		]);
		expect(resultado.productosAsignados).toBe(2);
		expect(resultado.productosSinGrupo).toBe(2);
	});

	it('rellena el tamaño solo de las variantes de productos con tamaños', async () => {
		const filas = await manager.query('SELECT nombre, tamano FROM producto_variantes ORDER BY variante_id');
		expect(filas).toEqual([
			{nombre: 'Pequeña', tamano: 'pequena'},
			{nombre: 'Mediana', tamano: 'mediana'},
			{nombre: 'Grande', tamano: 'grande'},
			{nombre: 'Familiar', tamano: null}, // no se reconoce: queda para que el admin lo elija
			{nombre: 'De Casa', tamano: null}, // calzone: sin tamaños
			{nombre: 'Coca Cola Personal', tamano: null}, // producto sin grupo
		]);
		expect(await ids('SELECT COUNT(*)::int FROM producto_variantes WHERE tamano IS NOT NULL')).toEqual([3]);
	});

	it('es idempotente: una segunda corrida no cambia nada', async () => {
		const antes = await manager.query('SELECT * FROM pizza_sabores ORDER BY sabor_id');
		const segunda = (await saborGruposV1.run({manager: manager as any, log} as any)) as Record<string, any>;
		const despues = await manager.query('SELECT * FROM pizza_sabores ORDER BY sabor_id');

		expect(despues).toEqual(antes);
		expect(segunda.saboresAsignados).toBe(0);
		expect(segunda.productosAsignados).toBe(0);
		expect(await ids('SELECT COUNT(*)::int FROM sabor_grupos')).toEqual([2]);
	});

	it('falla con un mensaje claro si synchronize aún no creó las columnas', async () => {
		const vacio = new PGlite();
		await vacio.exec('CREATE TABLE pizza_sabores (sabor_id serial PRIMARY KEY, nombre text, tipo text);');
		const m = {
			query: async (sql: string, params: unknown[] = []) => (await vacio.query(sql, params as any[])).rows,
		};

		await expect(saborGruposV1.run({manager: m as any, log} as any)).rejects.toThrow(/Faltan columnas/);
		await vacio.close();
	});
});

/**
 * Datos reales: en producción el Calzone NO tenía sabores en `pizza_sabores` (el POS usaba los nombres de sus variantes) y
 * el histórico de ventas pudo estructurarse antes de que se desactivara un sabor repetido.
 */
describe('sabor-grupos-v1: calzone sin sabores y líneas ya estructuradas (PGlite)', () => {
	let pg: PGlite;
	let manager: {query: (sql: string, params?: unknown[]) => Promise<any[]>};
	const log = jest.fn();

	beforeAll(async () => {
		pg = new PGlite();
		await pg.exec(`
			CREATE TABLE sabor_grupos (id serial PRIMARY KEY, nombre varchar(60) UNIQUE, max_sabores int, variante_es_sabor boolean,
				usa_tamano boolean, recargo_extra_desde int, recargo_extra_pequena numeric DEFAULT 0, recargo_extra_mediana numeric DEFAULT 0,
				recargo_extra_grande numeric DEFAULT 0, activo boolean DEFAULT true, orden int DEFAULT 0);
			CREATE TABLE pizza_sabores (sabor_id serial PRIMARY KEY, nombre text, tipo text, grupo_id int REFERENCES sabor_grupos(id),
				recargo_pequena numeric DEFAULT 0, recargo_mediana numeric DEFAULT 0, recargo_grande numeric DEFAULT 0, activo boolean DEFAULT true);
			CREATE TABLE productos (producto_id serial PRIMARY KEY, producto_nombre text, personalizacion text, sabor_grupo_id int);
			CREATE TABLE producto_variantes (variante_id serial PRIMARY KEY, producto_id int, nombre text, tamano varchar(20), activo boolean DEFAULT true);
			CREATE TABLE ordenes_productos_sabores (id serial PRIMARY KEY, orden_producto_id int, sabor_id int, sabor_nombre text);

			INSERT INTO pizza_sabores (nombre, tipo, recargo_pequena, recargo_mediana, recargo_grande) VALUES
				('Paisa','especial',1000,2000,2500), ('Paisa','tradicional',0,0,0), ('Carnes','tradicional',0,0,0);
			INSERT INTO productos (producto_nombre) VALUES ('Pizza'), ('Calzone'), ('CALZONE DE DOS SABORES'), ('GASEOSA');
			INSERT INTO producto_variantes (producto_id, nombre, activo) VALUES
				(1,'Grande',true),
				(2,'Carnes',true),(2,'De Casa',true),(2,'carnes',true),(2,'Hawaiana',false),(2,'UNIDAD',true),(2,'calzone de dos sabores',true),(2,'  Mexicana  ',true),
				(3,'CALZONE DOS SABORES',true),(4,'Coca Cola',true);
			-- Líneas de venta que ya apuntaban al "Paisa" TRADICIONAL (id 2) y al especial (id 1)
			INSERT INTO ordenes_productos_sabores (orden_producto_id, sabor_id, sabor_nombre) VALUES (10,2,'Paisa'),(11,1,'Paisa'),(12,3,'Carnes');
		`);
		manager = {query: async (sql, params = []) => (await pg.query(sql, params as any[])).rows};
	}, 60000);

	afterAll(async () => {
		await pg?.close();
	});

	let resultado: Record<string, any>;

	it('corre y reporta los sabores del calzone que creó y las líneas que reasignó', async () => {
		resultado = (await saborGruposV1.run({manager: manager as any, log} as any)) as Record<string, any>;

		expect(resultado.lineasReasignadas).toBe(1);
		// Sin duplicados, sin "UNIDAD" ni "dos sabores", sin variantes inactivas, con el nombre limpio.
		expect(resultado.saboresCalzoneCreados).toEqual(['Carnes', 'De Casa', 'Mexicana']);
	});

	it('crea esos sabores en el grupo Calzone, activos y sin recargo', async () => {
		const filas = await manager.query(
			`SELECT s.nombre, s.tipo, s.activo, s.recargo_pequena, s.recargo_grande FROM pizza_sabores s
			 JOIN sabor_grupos g ON g.id = s.grupo_id WHERE g.nombre = 'Calzone' ORDER BY s.nombre`,
		);

		expect(filas).toEqual([
			{nombre: 'Carnes', tipo: 'calzone', activo: true, recargo_pequena: '0', recargo_grande: '0'},
			{nombre: 'De Casa', tipo: 'calzone', activo: true, recargo_pequena: '0', recargo_grande: '0'},
			{nombre: 'Mexicana', tipo: 'calzone', activo: true, recargo_pequena: '0', recargo_grande: '0'},
		]);
	});

	it('el "Carnes" del calzone no pisa al "Carnes" de la pizza (grupos distintos, mismo nombre)', async () => {
		const filas = await manager.query(
			`SELECT g.nombre AS grupo FROM pizza_sabores s JOIN sabor_grupos g ON g.id = s.grupo_id WHERE s.nombre = 'Carnes' ORDER BY g.nombre`,
		);

		expect(filas).toEqual([{grupo: 'Calzone'}, {grupo: 'Pizza'}]);
	});

	it('las líneas que apuntaban al "Paisa" repetido pasan al que sobrevive; las demás no se tocan', async () => {
		const filas = await manager.query(
			'SELECT orden_producto_id AS orden, sabor_id FROM ordenes_productos_sabores ORDER BY orden_producto_id',
		);

		expect(filas).toEqual([
			{orden: 10, sabor_id: 1}, // era el tradicional (2) → ahora el especial (1)
			{orden: 11, sabor_id: 1},
			{orden: 12, sabor_id: 3},
		]);
	});

	it('si el grupo Calzone ya tiene sabores, no agrega más (idempotente y respeta lo que arregló el admin)', async () => {
		await manager.query(`UPDATE pizza_sabores SET activo = false WHERE nombre = 'Mexicana'`);

		const segunda = (await saborGruposV1.run({manager: manager as any, log} as any)) as Record<string, any>;

		expect(segunda.saboresCalzoneCreados).toEqual([]);
		expect(segunda.lineasReasignadas).toBe(0);
		expect((await manager.query(`SELECT COUNT(*)::int AS n FROM pizza_sabores WHERE tipo = 'calzone'`))[0].n).toBe(
			3,
		);
	});
});
