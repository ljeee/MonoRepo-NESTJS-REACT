import * as fs from 'fs';
import * as path from 'path';
import {PGlite} from '@electric-sql/pglite';
import {inventarioUnificadoV1} from '../../../src/common/migraciones-datos/pasos/inventario-unificado-v1';
import {ConsumoOrdenService} from '../../../src/inventario/consumo-orden.service';
import {InventarioService} from '../../../src/inventario/inventario.service';

/**
 * Migración al inventario unificado y reconciliación de órdenes contra PostgreSQL real
 * (PGlite). El DDL de las tablas nuevas replica las entidades de src/inventario/esquemas.
 */
const DDL_INVENTARIO = `
CREATE TABLE inventario_cajas (id serial PRIMARY KEY, nombre varchar(150) DEFAULT '', cantidad int DEFAULT 0, "alertaMinimo" int, "nivelObjetivo" int, "actualizadoEn" timestamptz DEFAULT now());
CREATE TABLE ingredientes_bebidas (id serial PRIMARY KEY, nombre text);
CREATE TABLE inventario_items (id serial PRIMARY KEY, tipo varchar(20) NOT NULL, nombre varchar(150) NOT NULL, categoria varchar(30), cantidad int NOT NULL DEFAULT 0, alerta_minimo int, nivel_objetivo int, activo boolean NOT NULL DEFAULT true, origen varchar(50) UNIQUE, creado_en timestamptz DEFAULT now(), actualizado_en timestamptz DEFAULT now());
CREATE TABLE inventario_movimientos (id serial PRIMARY KEY, item_id int NOT NULL REFERENCES inventario_items(id), tipo varchar(20) NOT NULL, delta int NOT NULL, aplicado int NOT NULL, cantidad_resultante int NOT NULL, orden_id int, usuario_id varchar(64), nota varchar(255), creado_en timestamptz DEFAULT now());
CREATE TABLE inventario_consumos (id serial PRIMARY KEY, item_id int NOT NULL REFERENCES inventario_items(id) ON DELETE CASCADE, variante_id int NOT NULL REFERENCES producto_variantes(variante_id) ON DELETE CASCADE, cantidad int NOT NULL DEFAULT 1, solo_para_llevar boolean NOT NULL DEFAULT false, origen varchar(10) NOT NULL DEFAULT 'manual', creado_en timestamptz DEFAULT now(), CONSTRAINT "UQ_inventario_consumo_variante_item" UNIQUE (variante_id, item_id));
`;

const SEED = `
INSERT INTO productos (producto_id, producto_nombre, personalizacion, categoria) VALUES
 (1, 'Pizza', 'pizza', 'pizza'), (2, 'Calzone', 'calzone', 'calzone'), (3, 'Gaseosa', NULL, 'bebida'),
 (4, 'Jugo Natural', 'jugo', 'jugo'), (5, 'Adición de Queso', NULL, 'adicion'), (6, 'Papas Encajadas', NULL, 'comida');
INSERT INTO producto_variantes (variante_id, producto_id, nombre, precio, stock_bebida, categoria_bebida, alerta_bebida, activo) VALUES
 (1, 1, 'Grande', 40000, 0, NULL, NULL, true),
 (2, 1, 'Mediana', 30000, 0, NULL, NULL, true),
 (3, 1, 'Pequeña', 20000, 0, NULL, NULL, true),
 (4, 2, 'UNIDAD', 18000, 0, NULL, NULL, true),
 (5, 3, 'Coca Cola Personal', 4000, 10, NULL, NULL, true),
 (6, 3, 'Postobón 1.5L', 7000, 0, 'gaseosa', 3, true),
 (7, 4, 'Mora en agua', 6000, 4, NULL, NULL, true),
 (8, 4, 'Maracuyá', 6000, 0, NULL, NULL, true),
 (9, 5, 'Grande', 5000, 0, NULL, NULL, true),
 (10, 6, 'Porción', 9000, 0, NULL, NULL, true);
INSERT INTO inventario_cajas (id, nombre, cantidad, "alertaMinimo", "nivelObjetivo") VALUES
 (1, 'Caja Pizza Grande', 20, 5, 50), (2, 'Cajas Medianas', 10, NULL, NULL), (3, 'caja personal', 0, 2, NULL), (4, 'Caja Calzone', 3, NULL, NULL);
INSERT INTO ingredientes_bebidas (nombre) VALUES ('Pulpa Mora'), ('Pulpa Maracuyá');
`;

describe('Inventario unificado contra PostgreSQL (PGlite)', () => {
	let pg: PGlite;
	let manager: any;
	let consumo: ConsumoOrdenService;
	let resultado: Record<string, any>;
	let corte: Date;

	const q = async <T = any>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params as any[])).rows;
	const itemPorOrigen = async (origen: string) =>
		(
			await q<{id: number; cantidad: number}>('SELECT id, cantidad FROM inventario_items WHERE origen = $1', [
				origen,
			])
		)[0];
	const stock = async (origen: string) => Number((await itemPorOrigen(origen)).cantidad);

	/** Crea factura + orden + líneas y reconcilia como lo hace OrdenesService.create. */
	const crearOrden = async (tipoPedido: string, lineas: {varianteId: number; cantidad: number}[], fecha?: Date) => {
		const [f] = await q<{id: number}>(`INSERT INTO facturas_ventas (total) VALUES (0) RETURNING factura_id AS id`);
		const [o] = await q<{id: number}>(
			`INSERT INTO ordenes (factura_id, tipo_pedido, fecha_orden) VALUES ($1, $2, COALESCE($3::timestamptz, now())) RETURNING orden_id AS id`,
			[f.id, tipoPedido, fecha ?? null],
		);
		for (const l of lineas) {
			await q('INSERT INTO ordenes_productos (orden_id, variante_id, cantidad) VALUES ($1, $2, $3)', [
				o.id,
				l.varianteId,
				l.cantidad,
			]);
		}
		await consumo.reconciliar(o.id, manager);
		return {ordenId: o.id, facturaId: f.id};
	};
	const movimientos = (ordenId: number) =>
		q<{tipo: string; delta: number; aplicado: number; nota: string}>(
			'SELECT tipo, delta, aplicado, nota FROM inventario_movimientos WHERE orden_id = $1 ORDER BY id',
			[ordenId],
		);

	beforeAll(async () => {
		pg = new PGlite();
		await pg.exec(`SET TIME ZONE 'America/Bogota';`);
		await pg.exec(fs.readFileSync(path.join(__dirname, '../estadisticas/fixtures/schema.sql'), 'utf8'));
		await pg.exec(DDL_INVENTARIO);
		await pg.exec(SEED);

		let savepoint = 0;
		manager = {
			query: async (sql: string, params: unknown[] = []) => (await pg.query(sql, params as any[])).rows,
			transaction: async (cb: (m: unknown) => Promise<unknown>) => {
				const nombre = `sp_${++savepoint}`;
				await pg.exec(`SAVEPOINT ${nombre}`);
				try {
					const r = await cb(manager);
					await pg.exec(`RELEASE SAVEPOINT ${nombre}`);
					return r;
				} catch (e) {
					await pg.exec(`ROLLBACK TO SAVEPOINT ${nombre}`);
					throw e;
				}
			},
		};

		await pg.exec('BEGIN');
		resultado = await inventarioUnificadoV1.run({manager, log: () => undefined});
		await pg.exec('COMMIT');
		corte = new Date(resultado.fechaCorte);
		consumo = new ConsumoOrdenService({fechaCorte: async () => corte} as any);
	}, 60000);

	afterAll(async () => {
		await pg?.close();
	});

	// Cada prueba corre dentro de una transacción (como OrdenesService) y se descarta al final.
	beforeEach(() => pg.exec('BEGIN'));
	afterEach(() => pg.exec('ROLLBACK'));

	describe('migración inventario-unificado-v1', () => {
		it('pasa cajas y bebidas embotelladas, descarta pulpas y jugos sin stock', () => {
			expect(resultado).toEqual(
				expect.objectContaining({
					cajas: 4,
					bebidasActivas: 2, // Coca Cola Personal (por nombre) y Postobón (config legada)
					bebidasInactivas: 1, // jugo con stock: se conserva inactivo
					pulpasDescartadas: 2,
				}),
			);
			expect(typeof resultado.fechaCorte).toBe('string');
		});

		it('conserva saldo y configuración, con un movimiento de saldo inicial por ítem', async () => {
			const items = await q(
				`SELECT origen, tipo, nombre, categoria, cantidad, alerta_minimo, nivel_objetivo, activo
				 FROM inventario_items ORDER BY origen`,
			);
			expect(items).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						origen: 'caja:1',
						categoria: 'grande',
						cantidad: 20,
						alerta_minimo: 5,
						nivel_objetivo: 50,
					}),
					expect.objectContaining({origen: 'caja:3', categoria: 'pequena', cantidad: 0}),
					expect.objectContaining({origen: 'caja:4', categoria: 'calzone'}),
					expect.objectContaining({
						origen: 'variante:5',
						nombre: 'Gaseosa Coca Cola Personal',
						categoria: 'gaseosa',
						cantidad: 10,
						activo: true,
					}),
					expect.objectContaining({
						origen: 'variante:6',
						categoria: 'gaseosa',
						alerta_minimo: 3,
						activo: true,
					}),
					expect.objectContaining({origen: 'variante:7', categoria: 'jugo', cantidad: 4, activo: false}),
				]),
			);
			expect(items.find((i: any) => i.origen === 'variante:8')).toBeUndefined();

			const [{n}] = await q<{n: number}>(
				`SELECT COUNT(*)::int AS n FROM inventario_movimientos WHERE tipo = 'migracion'`,
			);
			expect(n).toBe(items.length);
		});

		it('reglas de caja solo para pizzas, calzones y encajados — no por texto', async () => {
			const reglas = await q<{variante_id: number; origen_item: string; solo_para_llevar: boolean}>(
				`SELECT c.variante_id, i.origen AS origen_item, c.solo_para_llevar
				 FROM inventario_consumos c JOIN inventario_items i ON i.id = c.item_id WHERE i.tipo = 'caja' ORDER BY c.variante_id`,
			);
			expect(reglas).toEqual([
				{variante_id: 1, origen_item: 'caja:1', solo_para_llevar: true},
				{variante_id: 2, origen_item: 'caja:2', solo_para_llevar: true},
				{variante_id: 3, origen_item: 'caja:3', solo_para_llevar: true},
				{variante_id: 4, origen_item: 'caja:4', solo_para_llevar: true},
				{variante_id: 10, origen_item: 'caja:3', solo_para_llevar: true}, // papas encajadas → caja pequeña
			]);
			// "Coca Cola Personal" (5) y "Adición de Queso Grande" (9) ya no gastan cajas.
		});

		it('es idempotente: correrla de nuevo no duplica nada', async () => {
			const r = await inventarioUnificadoV1.run({manager, log: () => undefined});
			expect(r).toEqual(expect.objectContaining({cajas: 0, bebidasActivas: 0, reglasCaja: 0, reglasBebida: 0}));
		});
	});

	describe('reconciliación de órdenes', () => {
		it('domicilio: descuenta cajas y bebidas; repetir no hace nada', async () => {
			const {ordenId} = await crearOrden('domicilio', [
				{varianteId: 1, cantidad: 2},
				{varianteId: 5, cantidad: 3},
			]);
			expect(await stock('caja:1')).toBe(18);
			expect(await stock('variante:5')).toBe(7);

			expect(await consumo.reconciliar(ordenId, manager)).toBe(false);
			expect(await movimientos(ordenId)).toHaveLength(2);
		});

		it('mesa: la bebida se descuenta, la caja no', async () => {
			await crearOrden('mesa', [
				{varianteId: 1, cantidad: 1},
				{varianteId: 5, cantidad: 1},
			]);
			expect(await stock('caja:1')).toBe(20);
			expect(await stock('variante:5')).toBe(9);
		});

		it('editar sube y baja cantidades; cambiar a mesa devuelve la caja', async () => {
			const {ordenId} = await crearOrden('llevar', [
				{varianteId: 1, cantidad: 2},
				{varianteId: 5, cantidad: 3},
			]);
			await q('UPDATE ordenes_productos SET cantidad = 1 WHERE orden_id = $1 AND variante_id = 1', [ordenId]);
			await q('UPDATE ordenes_productos SET cantidad = 5 WHERE orden_id = $1 AND variante_id = 5', [ordenId]);
			await consumo.reconciliar(ordenId, manager);
			expect(await stock('caja:1')).toBe(19);
			expect(await stock('variante:5')).toBe(5);

			await q(`UPDATE ordenes SET tipo_pedido = 'mesa' WHERE orden_id = $1`, [ordenId]);
			await consumo.reconciliar(ordenId, manager);
			expect(await stock('caja:1')).toBe(20);
			expect(await stock('variante:5')).toBe(5);
		});

		it('cancelar la orden (también por PATCH de estado) devuelve todo', async () => {
			const {ordenId} = await crearOrden('domicilio', [{varianteId: 2, cantidad: 2}]);
			expect(await stock('caja:2')).toBe(8);

			await q(`UPDATE ordenes SET estado_orden = 'cancelado' WHERE orden_id = $1`, [ordenId]);
			await consumo.reconciliar(ordenId, manager);
			expect(await stock('caja:2')).toBe(10);
			expect((await movimientos(ordenId)).map((m) => m.tipo)).toEqual(['venta', 'devolucion']);
		});

		it('cancelar la factura devuelve todo', async () => {
			const {ordenId, facturaId} = await crearOrden('domicilio', [{varianteId: 4, cantidad: 1}]);
			expect(await stock('caja:4')).toBe(2);
			await q(`UPDATE facturas_ventas SET estado = 'cancelado' WHERE factura_id = $1`, [facturaId]);
			await consumo.reconciliar(ordenId, manager);
			expect(await stock('caja:4')).toBe(3);
		});

		it('borrar la orden (eliminada) devuelve todo aunque la orden siga existiendo aún', async () => {
			const {ordenId} = await crearOrden('domicilio', [{varianteId: 1, cantidad: 3}]);
			await consumo.reconciliar(ordenId, manager, {eliminada: true});
			expect(await stock('caja:1')).toBe(20);
		});

		it('vender sin stock deja el faltante visible y no devuelve lo que nunca salió', async () => {
			const {ordenId} = await crearOrden('domicilio', [{varianteId: 3, cantidad: 2}]);
			expect(await stock('caja:3')).toBe(0);
			expect(await movimientos(ordenId)).toEqual([
				expect.objectContaining({tipo: 'venta', delta: -2, aplicado: 0}),
			]);

			await q(`UPDATE ordenes SET estado_orden = 'cancelado' WHERE orden_id = $1`, [ordenId]);
			await consumo.reconciliar(ordenId, manager);
			expect(await stock('caja:3')).toBe(0); // no aparece stock fantasma
		});

		it('faltante parcial: solo vuelve lo que de verdad se descontó', async () => {
			const caja = await itemPorOrigen('caja:4'); // 3 cajas de calzone
			const {ordenId} = await crearOrden('domicilio', [{varianteId: 4, cantidad: 5}]);
			expect(await stock('caja:4')).toBe(0);

			await q('UPDATE ordenes_productos SET cantidad = 4 WHERE orden_id = $1', [ordenId]);
			await consumo.reconciliar(ordenId, manager);
			expect(await stock('caja:4')).toBe(0); // bajar de 5 a 4: las 2 faltantes absorben la diferencia

			await q('UPDATE ordenes_productos SET cantidad = 1 WHERE orden_id = $1', [ordenId]);
			await consumo.reconciliar(ordenId, manager);
			expect(await stock('caja:4')).toBe(2); // de 4 a 1: ahora sí vuelven 2 (de las 3 que salieron)

			const [fila] = await q<{cantidad: number}>('SELECT cantidad FROM inventario_items WHERE id = $1', [
				caja.id,
			]);
			expect(fila.cantidad).toBe(2);
		});

		it('órdenes anteriores a la fecha de corte no se tocan', async () => {
			const antes = new Date(corte.getTime() - 24 * 3600 * 1000);
			const {ordenId} = await crearOrden('domicilio', [{varianteId: 1, cantidad: 1}], antes);
			expect(await stock('caja:1')).toBe(20);
			expect(await movimientos(ordenId)).toHaveLength(0);
		});

		it('un ítem desactivado deja de consumir', async () => {
			await q(`UPDATE inventario_items SET activo = false WHERE origen = 'variante:5'`);
			await crearOrden('mesa', [{varianteId: 5, cantidad: 2}]);
			expect(await stock('variante:5')).toBe(10);
		});

		it('un error dentro de la reconciliación no rompe la transacción de la orden', async () => {
			const roto = new ConsumoOrdenService({fechaCorte: async () => corte} as any);
			const managerRoto = {
				...manager,
				transaction: (cb: (m: unknown) => Promise<unknown>) =>
					manager.transaction(() => cb({query: async () => q('SELECT * FROM tabla_inexistente')})),
			};
			await expect(roto.reconciliar(1, managerRoto)).resolves.toBe(false);
			// La transacción externa sigue usable.
			await expect(q('SELECT 1 AS ok')).resolves.toEqual([{ok: 1}]);
		});
	});

	describe('InventarioService', () => {
		let svc: InventarioService;
		beforeAll(() => {
			const dataSource = {query: manager.query, manager, transaction: (cb: any) => manager.transaction(cb)};
			svc = new InventarioService(
				dataSource as any,
				{fechaCorte: async () => corte, asegurarListo: async () => corte} as any,
			);
		});

		it('conteo físico fija el valor y deja el movimiento con la diferencia', async () => {
			const caja = await itemPorOrigen('caja:2');
			const r = await svc.registrarMovimiento(caja.id, {tipo: 'conteo', cantidad: 7}, null);
			expect(r).toEqual(expect.objectContaining({cantidad: 7, estado: 'ok'}));
			const [mv] = await q(
				`SELECT tipo, delta, aplicado, cantidad_resultante FROM inventario_movimientos WHERE item_id = $1 ORDER BY id DESC LIMIT 1`,
				[caja.id],
			);
			expect(mv).toEqual({tipo: 'conteo', delta: -3, aplicado: -3, cantidad_resultante: 7});
		});

		it('una salida mayor al stock topa en 0', async () => {
			const caja = await itemPorOrigen('caja:4');
			const r = await svc.registrarMovimiento(caja.id, {tipo: 'salida', cantidad: 9}, null);
			expect(r.cantidad).toBe(0);
			expect(r.estado).toBe('critico');
		});

		it('crear una bebida desde una variante la vincula 1:1', async () => {
			const item = await svc.crearItem(
				{tipo: 'bebida', nombre: 'Agua Brisa 600ml', cantidad: 12, varianteId: 8},
				null,
			);
			expect(item).toEqual(expect.objectContaining({categoria: 'agua', cantidad: 12, reglas: 1}));
			await crearOrden('mesa', [{varianteId: 8, cantidad: 2}]);
			const [fila] = await q<{cantidad: number}>('SELECT cantidad FROM inventario_items WHERE id = $1', [
				item.id,
			]);
			expect(fila.cantidad).toBe(10);
		});

		it('sugiere caja para una pizza nueva sin regla', async () => {
			await q(
				`INSERT INTO producto_variantes (variante_id, producto_id, nombre, precio) VALUES (50, 1, 'Familiar', 55000)`,
			);
			const sugerencias = await svc.sugerencias();
			expect(sugerencias).toEqual([
				expect.objectContaining({
					varianteId: 50,
					categoriaCaja: 'grande',
					cajaSugerida: expect.objectContaining({nombre: 'Caja Pizza Grande'}),
				}),
			]);
		});

		it('lista movimientos paginados con el nombre del ítem', async () => {
			const r = await svc.listarMovimientos({tipoItem: 'caja', limit: 2});
			expect(r.filas).toHaveLength(2);
			expect(r.total).toBeGreaterThanOrEqual(4);
			expect(r.filas[0]).toEqual(expect.objectContaining({itemTipo: 'caja', itemNombre: expect.any(String)}));
		});
	});
});
