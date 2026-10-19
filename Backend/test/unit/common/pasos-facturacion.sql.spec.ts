import {PGlite} from '@electric-sql/pglite';
import {cuentasFacturaIdV1} from '../../../src/common/migraciones-datos/pasos/cuentas-factura-id-v1';
import {facturasMontosV1} from '../../../src/common/migraciones-datos/pasos/facturas-montos-v1';
import {ventasDetalleV1} from '../../../src/common/migraciones-datos/pasos/ventas-detalle-v1';
import {PASOS_MIGRACION} from '../../../src/common/migraciones-datos/pasos';

/** Los pasos de datos de la facturación contra PostgreSQL real (PGlite): qué completan, qué NO tocan y que son idempotentes. */
describe('Pasos de datos de facturación (PGlite)', () => {
	let pg: PGlite;
	const manager = {
		query: async (sql: string, params: unknown[] = []) => (await pg.query(sql, params as any[])).rows as any[],
	};
	const ctx = {manager: manager as any, log: jest.fn()};
	const factura = async (id: number) =>
		(await manager.query('SELECT * FROM facturas_ventas WHERE factura_id = $1', [id]))[0];
	const num = (v: unknown) => (v === null ? null : Number(v));

	beforeEach(async () => {
		pg = new PGlite();
		await pg.exec(`
			CREATE TABLE cuentas_transferencia (id serial PRIMARY KEY, nombre text, activa boolean DEFAULT true);
			CREATE TABLE facturas_ventas (
				factura_id int PRIMARY KEY, estado text, metodo text, total numeric, monto_pagado numeric,
				pago_efectivo numeric, pago_transferencia numeric, cuenta_transferencia_id int, cuenta_transferencia_nombre text);
		`);
	}, 30_000);

	afterEach(async () => {
		await pg.close();
	});

	describe('facturas-montos-v1', () => {
		it('completa efectivo, transferencia y qr con el total y deja la otra parte en 0', async () => {
			await pg.exec(`INSERT INTO facturas_ventas (factura_id, estado, metodo, total) VALUES
				(1,'pagado','efectivo',10000),(2,'pagada','transferencia',20000),(3,'pagado','qr',30000)`);

			const r = (await facturasMontosV1.run(ctx)) as Record<string, number>;

			expect(r).toEqual(
				expect.objectContaining({montoPagadoCompletado: 3, efectivoCompletado: 1, transferenciaCompletado: 2}),
			);
			expect((await factura(1)).pago_efectivo).toBe('10000');
			expect(num((await factura(1)).pago_transferencia)).toBe(0);
			expect(num((await factura(2)).pago_efectivo)).toBe(0);
			expect((await factura(2)).pago_transferencia).toBe('20000');
			expect((await factura(3)).pago_transferencia).toBe('30000');
			for (const id of [1, 2, 3])
				expect(num((await factura(id)).monto_pagado)).toBe(num((await factura(id)).total));
		});

		it('nunca pisa un valor que ya existe, aunque no cuadre con el total', async () => {
			await pg.exec(`INSERT INTO facturas_ventas (factura_id, estado, metodo, total, monto_pagado, pago_efectivo, pago_transferencia)
				VALUES (1,'pagado','efectivo',10000,9000,9000,500)`);

			await facturasMontosV1.run(ctx);

			expect(await factura(1)).toEqual(
				expect.objectContaining({monto_pagado: '9000', pago_efectivo: '9000', pago_transferencia: '500'}),
			);
		});

		it('en un pago mixto con UNA parte conocida calcula la otra; sin ninguna, o con una parte absurda, lo deja para corregir a mano', async () => {
			await pg.exec(`INSERT INTO facturas_ventas (factura_id, estado, metodo, total, pago_efectivo, pago_transferencia) VALUES
				(1,'pagado','efectivo_transferencia',50000,NULL,20000),
				(2,'pagado','efectivo_transferencia',50000,15000,NULL),
				(3,'pagado','efectivo_transferencia',50000,NULL,NULL),
				(4,'pagado','efectivo_transferencia',50000,NULL,90000)`);

			const r = (await facturasMontosV1.run(ctx)) as Record<string, number>;

			expect(num((await factura(1)).pago_efectivo)).toBe(30000);
			expect(num((await factura(2)).pago_transferencia)).toBe(35000);
			expect((await factura(3)).pago_efectivo).toBeNull();
			expect((await factura(4)).pago_efectivo).toBeNull(); // 90.000 > total: no se inventa
			expect(r.mixtasCompletadas).toBe(2);
			expect(r.mixtasSinDesglose).toBe(2);
		});

		it('no toca pendientes, abonadas ni canceladas, y reporta las pagadas sin método', async () => {
			await pg.exec(`INSERT INTO facturas_ventas (factura_id, estado, metodo, total, monto_pagado, pago_efectivo) VALUES
				(1,'pendiente','efectivo',10000,NULL,NULL),
				(2,'parcial',NULL,10000,4000,4000),
				(3,'cancelado','efectivo',10000,NULL,NULL),
				(4,'pagado',NULL,10000,NULL,NULL)`);

			const r = (await facturasMontosV1.run(ctx)) as Record<string, number>;

			for (const id of [1, 3])
				expect(await factura(id)).toEqual(expect.objectContaining({monto_pagado: null, pago_efectivo: null}));
			expect(await factura(2)).toEqual(expect.objectContaining({monto_pagado: '4000', pago_efectivo: '4000'}));
			expect((await factura(4)).monto_pagado).toBe('10000'); // el monto sí; sin método no se reparte
			expect((await factura(4)).pago_efectivo).toBeNull();
			expect(r.pagadasSinMetodo).toBe(1);
		});

		it('es idempotente y no cambia ningún total', async () => {
			await pg.exec(
				`INSERT INTO facturas_ventas (factura_id, estado, metodo, total) VALUES (1,'pagado','efectivo',10000),(2,'pagado','qr',5000)`,
			);
			await facturasMontosV1.run(ctx);
			const despues = await manager.query('SELECT * FROM facturas_ventas ORDER BY 1');

			const r = (await facturasMontosV1.run(ctx)) as Record<string, number>;

			expect(await manager.query('SELECT * FROM facturas_ventas ORDER BY 1')).toEqual(despues);
			expect(r).toEqual(
				expect.objectContaining({
					montoPagadoCompletado: 0,
					efectivoCompletado: 0,
					transferenciaCompletado: 0,
					cerosCompletados: 0,
				}),
			);
			expect(despues.map((f) => f.total)).toEqual(['10000', '5000']);
		});

		it('se omite sin romper si el esquema aún no tiene las columnas', async () => {
			await pg.exec(
				'DROP TABLE facturas_ventas; CREATE TABLE facturas_ventas (factura_id int, estado text, total numeric)',
			);

			expect(await facturasMontosV1.run(ctx)).toEqual({omitido: expect.stringContaining('monto_pagado')});
		});
	});

	describe('cuentas-factura-id-v1', () => {
		beforeEach(async () => {
			await pg.exec(
				`INSERT INTO cuentas_transferencia (nombre) VALUES ('Nequi'),('Bancolombia'),('Davi'),('davi ')`,
			);
		});

		it('enlaza por id sin distinguir mayúsculas ni espacios y deja el nombre vigente de la tabla', async () => {
			await pg.exec(`INSERT INTO facturas_ventas (factura_id, estado, metodo, total, cuenta_transferencia_nombre) VALUES
				(1,'pagado','transferencia',100,'nequi'),(2,'pagado','transferencia',100,'  NEQUI '),(3,'pagado','transferencia',100,'Bancolombia')`);

			const r = (await cuentasFacturaIdV1.run(ctx)) as {facturasEnlazadas: number};

			expect(r.facturasEnlazadas).toBe(3);
			expect(await factura(1)).toEqual(
				expect.objectContaining({cuenta_transferencia_id: 1, cuenta_transferencia_nombre: 'Nequi'}),
			);
			expect(await factura(2)).toEqual(
				expect.objectContaining({cuenta_transferencia_id: 1, cuenta_transferencia_nombre: 'Nequi'}),
			);
			expect(await factura(3)).toEqual(expect.objectContaining({cuenta_transferencia_id: 2}));
		});

		it('no toca un nombre que ninguna cuenta reconoce ni uno que coincide con varias, y los reporta', async () => {
			await pg.exec(`INSERT INTO facturas_ventas (factura_id, estado, metodo, total, cuenta_transferencia_nombre) VALUES
				(1,'pagado','transferencia',100,'Daviplata'),(2,'pagado','transferencia',100,'Daviplata'),(3,'pagado','transferencia',100,'DAVI')`);

			const r = (await cuentasFacturaIdV1.run(ctx)) as {
				facturasEnlazadas: number;
				nombresSinCuenta: {nombre: string; facturas: number}[];
			};

			expect(r.facturasEnlazadas).toBe(0);
			expect(r.nombresSinCuenta).toEqual([
				{nombre: 'Daviplata', facturas: 2},
				{nombre: 'DAVI', facturas: 1}, // "Davi" y "davi " son la misma cuenta dos veces: ambiguo
			]);
			expect((await factura(1)).cuenta_transferencia_id).toBeNull();
		});

		it('respeta las facturas que ya tienen cuenta por id, aunque el nombre guardado sea otro', async () => {
			await pg.exec(
				`INSERT INTO facturas_ventas (factura_id, estado, total, cuenta_transferencia_id, cuenta_transferencia_nombre) VALUES (1,'pagado',100,2,'Nequi')`,
			);

			await cuentasFacturaIdV1.run(ctx);

			expect(await factura(1)).toEqual(
				expect.objectContaining({cuenta_transferencia_id: 2, cuenta_transferencia_nombre: 'Nequi'}),
			);
		});

		it('es idempotente y no cambia montos', async () => {
			await pg.exec(
				`INSERT INTO facturas_ventas (factura_id, estado, total, pago_transferencia, cuenta_transferencia_nombre) VALUES (1,'pagado',100,100,'nequi')`,
			);
			await cuentasFacturaIdV1.run(ctx);

			const r = (await cuentasFacturaIdV1.run(ctx)) as {facturasEnlazadas: number};

			expect(r.facturasEnlazadas).toBe(0);
			expect(await factura(1)).toEqual(expect.objectContaining({total: '100', pago_transferencia: '100'}));
		});

		it('se omite si no existe la tabla de cuentas', async () => {
			await pg.exec('DROP TABLE cuentas_transferencia');

			expect(await cuentasFacturaIdV1.run(ctx)).toEqual({
				omitido: expect.stringContaining('cuentas_transferencia'),
			});
		});
	});

	describe('registro de pasos', () => {
		it('los grupos de sabores corren ANTES del detalle de ventas, que depende de ellos', () => {
			const ids = PASOS_MIGRACION.map((p) => p.id);

			expect(ids.indexOf('sabor-grupos-v1')).toBeLessThan(ids.indexOf('ventas-detalle-v1'));
			expect(ventasDetalleV1.dependeDe).toEqual(
				expect.arrayContaining(['productos-categoria-v1', 'sabor-grupos-v1']),
			);
		});

		it('cada paso depende solo de pasos que corren antes y los ids no se repiten', () => {
			const ids = PASOS_MIGRACION.map((p) => p.id);

			expect(new Set(ids).size).toBe(ids.length);
			PASOS_MIGRACION.forEach((p, i) => {
				for (const dep of p.dependeDe ?? []) {
					expect(ids.indexOf(dep)).toBeGreaterThanOrEqual(0);
					expect(ids.indexOf(dep)).toBeLessThan(i);
				}
			});
		});

		it('el único paso en segundo plano es el último (así arranca cuando todos los demás ya terminaron)', () => {
			const modos = PASOS_MIGRACION.map((p) => p.modo);

			expect(modos.filter((m) => m === 'background')).toHaveLength(1);
			expect(modos[modos.length - 1]).toBe('background');
		});
	});
});
