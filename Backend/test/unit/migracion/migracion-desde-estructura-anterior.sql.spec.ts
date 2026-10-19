import * as fs from 'fs';
import * as path from 'path';
import {PGlite} from '@electric-sql/pglite';
import {MigracionesDatosService} from '../../../src/common/migraciones-datos/migraciones-datos.service';
import {PASOS_MIGRACION} from '../../../src/common/migraciones-datos/pasos';
import {
	auditarBase,
	formatearAuditoria,
	type Hallazgo,
} from '../../../src/common/migraciones-datos/herramientas/auditoria';
import {capturarLineaBase, type LineaBase} from '../../../src/common/migraciones-datos/herramientas/linea-base';
import {compararPreciosSabores} from '../../../src/common/migraciones-datos/herramientas/paridad-precios';
import {
	esperarPasos,
	formatearVerificacion,
	verificarMigracion,
} from '../../../src/common/migraciones-datos/herramientas/verificacion';
import {estructuraAnterior} from './estructura-anterior';

/**
 * ENSAYO DE LA MIGRACIÓN contra PostgreSQL real (PGlite), partiendo de la ESTRUCTURA ANTERIOR de la base
 * (`Backend/init.sql`) con datos heredados que traen las anomalías típicas (ver fixtures/datos-anteriores.sql):
 *   1. la auditoría previa las encuentra, y las que bloquean el arranque se corrigen;
 *   2. se toma la línea base;
 *   3. se aplica el DDL que genera `synchronize` (foto en fixtures/) y corren los pasos de datos reales;
 *   4. la verificación posterior confirma que no cambió ni una fila ni un peso y que lo transformado quedó bien.
 */

const FIXTURES = path.join(__dirname, 'fixtures');

async function crearBaseAnterior(): Promise<PGlite> {
	const pg = new PGlite();
	await pg.exec(`SET TIME ZONE 'America/Bogota';`);
	await pg.exec(estructuraAnterior());
	await pg.exec(`SELECT set_config('search_path', '"$user", public', false);`);
	await pg.exec(fs.readFileSync(path.join(FIXTURES, 'datos-anteriores.sql'), 'utf8'));
	return pg;
}

/** Lo que se hace con las dos anomalías BLOQUEANTES, tal como lo indica la auditoría. */
const CORRECCIONES_BLOQUEANTES = `
	UPDATE domicilios SET telefono_domiciliario_asignado = NULL WHERE telefono_domiciliario_asignado = '';
	INSERT INTO domiciliarios (telefono, domiciliario_nombre) VALUES ('3000000000', 'Repartidor antiguo');
	UPDATE domicilios SET telefono_domiciliario_asignado = "domiciliarioTelefono"
		WHERE telefono_domiciliario_asignado IS NULL AND "domiciliarioTelefono" IS NOT NULL;`;

/** DataSource mínimo sobre PGlite para el runner real (transacciones, savepoints y el registro de pasos). */
function crearDataSource(pg: PGlite) {
	const consultar = async (sql: string, params: unknown[] = []) =>
		(await pg.query(sql, params as any[])).rows as any[];
	let savepoints = 0;
	const fila = (r: any) => ({id: r.id, estado: r.estado, ejecutadaEn: r.ejecutada_en, resultado: r.resultado});
	const repo = {
		find: async () => (await consultar('SELECT * FROM migraciones_datos')).map(fila),
		findOne: async ({where: {id}}: any) =>
			(await consultar('SELECT * FROM migraciones_datos WHERE id = $1', [id])).map(fila)[0] ?? null,
		save: async (f: any) => {
			await consultar(
				`INSERT INTO migraciones_datos (id, estado, ejecutada_en, resultado, actualizada_en) VALUES ($1, $2, $3, $4, now())
				 ON CONFLICT (id) DO UPDATE SET estado = EXCLUDED.estado, ejecutada_en = EXCLUDED.ejecutada_en,
					resultado = EXCLUDED.resultado, actualizada_en = now()`,
				[f.id, f.estado, f.ejecutadaEn ?? null, JSON.stringify(f.resultado ?? null)],
			);
			return f;
		},
	};
	const manager: any = {
		query: consultar,
		getRepository: () => repo,
		transaction: async (cb: (m: any) => Promise<unknown>) => {
			const nombre = `sp_${++savepoints}`;
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
	return {
		consultar,
		dataSource: {
			manager,
			query: consultar,
			getRepository: () => repo,
			transaction: async (cb: (m: any) => Promise<unknown>) => {
				await pg.exec('BEGIN');
				try {
					const r = await cb(manager);
					await pg.exec('COMMIT');
					return r;
				} catch (e) {
					await pg.exec('ROLLBACK');
					throw e;
				}
			},
		},
	};
}

const ddlSincronizacion = () =>
	fs.readFileSync(path.join(FIXTURES, 'sincronizacion-desde-estructura-anterior.sql'), 'utf8');

describe('Migración desde la estructura anterior (PGlite)', () => {
	let pg: PGlite;
	let consultar: (sql: string, params?: unknown[]) => Promise<any[]>;
	let dataSource: any;
	let base: LineaBase;
	let hallazgos: Hallazgo[];

	const hallazgo = (id: string) => hallazgos.find((h) => h.id === id);

	beforeAll(async () => {
		pg = await crearBaseAnterior();
		({consultar, dataSource} = crearDataSource(pg));
	}, 120_000);

	afterAll(async () => {
		await pg?.close();
	});

	describe('1. auditoría previa', () => {
		it('encuentra las anomalías que bloquean el arranque', async () => {
			const informe = await auditarBase(consultar);
			hallazgos = informe.hallazgos;

			expect(informe.bloqueantes).toBe(2);
			expect(hallazgo('domiciliario-huerfano')).toEqual(
				expect.objectContaining({severidad: 'bloqueante', cantidad: 2}),
			);
			expect(hallazgo('domiciliarioTelefono-con-datos')).toEqual(
				expect.objectContaining({severidad: 'bloqueante', cantidad: 1}),
			);
		});

		it('encuentra los problemas de facturación que cambian lo que se ve', async () => {
			expect(hallazgo('pagadas-sin-metodo')?.cantidad).toBe(1);
			expect(hallazgo('mixtas-sin-desglose')?.cantidad).toBe(2); // una con una sola parte, otra sin ninguna
			expect(hallazgo('metodos-factura')?.detalle).toMatch(/nequi.*daviplata|daviplata.*nequi/);
			expect(hallazgo('transferencias-sin-cuenta')).toEqual(expect.objectContaining({severidad: 'atencion'}));
			expect(hallazgo('ventas-orden-cancelada')?.cantidad).toBe(1); // la factura pagada cuya orden se canceló
			expect(hallazgo('datos-de-prueba')?.cantidad).toBe(4); // 2 facturas + 2 clientes del seeder viejo
			expect(hallazgo('caja-huerfana')?.cantidad).toBe(1); // entrada de una factura luego cancelada
		});

		it('encuentra los problemas de personas, catálogo e inventario', async () => {
			expect(hallazgo('telefonos')?.cantidad).toBeGreaterThan(0);
			expect(hallazgo('domiciliarios-usuarios')?.cantidad).toBe(2);
			expect(hallazgo('usuarios-roles')?.cantidad).toBe(2); // sin rol + rol desconocido
			expect(hallazgo('variantes-pizza')?.detalle).toMatch(/Familiar/);
			expect(hallazgo('calzone-sabores')?.detalle).toMatch(/Carnes.*De Casa.*Hawaiana.*Mexicana/);
			expect(hallazgo('inventario-anterior')?.cantidad).toBe(2); // caja y bebida con existencias negativas
			expect(hallazgo('sabores')?.detalle).toMatch(/Repetidos entre tradicional y especial.*: 1\./);
			expect(hallazgo('cierre-de-ayer')?.severidad).toBe('atencion'); // no hay cierre de ayer
			expect(hallazgo('egresos')?.cantidad).toBeGreaterThan(0);
		});

		it('sabe qué falta en el esquema y no inventa columnas que ya existen', async () => {
			const h = hallazgo('esquema-por-actualizar')!;
			expect(h.cantidad).toBe(23);
			expect(h.muestra?.map((m) => m.falta)).toContain('tabla cuentas_transferencia');
		});

		it('el informe se puede imprimir y manda no desplegar mientras haya bloqueantes', async () => {
			const texto = formatearAuditoria({generadaEn: 'hoy', hallazgos, bloqueantes: 2, atenciones: 10});

			expect(texto).toMatch(/NO DESPLEGAR/);
			expect(texto).toMatch(/BLOQUEANTE \[domiciliario-huerfano\]/);
		});

		it('los bloqueantes son reales: con ellos la sincronización del esquema FALLA y no deja nada a medias', async () => {
			const otra = await crearBaseAnterior();
			try {
				await expect(otra.exec(ddlSincronizacion())).rejects.toThrow(
					/foreign key|llave foránea|FK_4bc6ebe65e2ea3160246982cdf5/i,
				);
				// El DDL es transaccional: la base sigue con la estructura anterior (no existe la tabla nueva).
				const [r] = (
					await otra.query<{existe: boolean}>(
						`SELECT to_regclass('public.sabor_grupos') IS NOT NULL AS existe`,
					)
				).rows;
				expect(r.existe).toBe(false);
			} finally {
				await otra.close();
			}
		}, 120_000);
	});

	describe('2. se corrigen los bloqueantes y se toma la línea base', () => {
		it('sin bloqueantes después de las correcciones que indica la auditoría', async () => {
			await pg.exec(CORRECCIONES_BLOQUEANTES);

			const informe = await auditarBase(consultar);

			expect(informe.bloqueantes).toBe(0);
		});

		it('la línea base captura conteos, dinero por mes, huellas, inventario y catálogo', async () => {
			base = await capturarLineaBase(consultar);

			expect(base.tablas).toEqual(
				expect.objectContaining({facturas_ventas: 24, ordenes: 21, ordenes_productos: 29, pizza_sabores: 10}),
			);
			expect(base.ventasPorMes.map((m) => m.mes)).toEqual(['2026-07', '2026-08', '2026-09']);
			expect(Object.keys(base.huellas)).toEqual(
				expect.arrayContaining([
					'facturas_ventas',
					'ordenes',
					'ordenes_productos',
					'facturas_pagos',
					'caja_movimientos',
					'clientes',
				]),
			);
			expect(base.inventario.cajas).toHaveLength(4);
			expect(base.inventario.stockBebidas).toEqual(
				expect.arrayContaining([
					{varianteId: 11, stock: 12},
					{varianteId: 13, stock: -2},
				]),
			);
			// La venta pagada cuya orden se canceló NO cuenta (venta válida): agosto factura menos de lo que suman sus totales.
			const agosto = base.ventasPorMes.find((m) => m.mes === '2026-08')!;
			expect(agosto.validas).toBeLessThan(agosto.facturas);
		});

		it('antes de migrar la verificación lo dice: faltan el esquema y los pasos', async () => {
			const antes = await verificarMigracion(consultar, base);

			expect(antes.ok).toBe(false);
			expect(antes.pruebas.find((p) => p.id === 'esquema')?.estado).toBe('falla');
			expect(antes.pruebas.find((p) => p.id === 'pasos')?.estado).toBe('falla');
		});
	});

	describe('3. migración: esquema + pasos de datos', () => {
		it('synchronize (foto del DDL) se aplica completo y ahora sí hay esquema nuevo', async () => {
			await pg.exec(ddlSincronizacion());

			const [r] = await consultar(`SELECT to_regclass('public.inventario_items') IS NOT NULL AS inventario,
				EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'domicilios' AND column_name = 'domiciliarioTelefono') AS sigue_heredada`);
			expect(r).toEqual({inventario: true, sigue_heredada: false});
		}, 60_000);

		it('los pasos de datos corren en orden y terminan, incluido el de segundo plano', async () => {
			const servicio = new MigracionesDatosService(dataSource, PASOS_MIGRACION);

			await servicio.onApplicationBootstrap();
			const pasos = await esperarPasos(consultar, {tiempoMaxMs: 60_000, cadaMs: 200});

			expect(pasos.map((p) => `${p.id}:${p.estado}`)).toEqual([
				'productos-categoria-v1:ok',
				'sabor-grupos-v1:ok',
				'cuentas-factura-id-v1:ok',
				'facturas-montos-v1:ok',
				'inventario-unificado-v1:ok',
				'ventas-detalle-v1:ok',
			]);
		}, 120_000);

		it('un segundo arranque no repite ningún paso', async () => {
			const antes = await consultar(`SELECT id, ejecutada_en FROM migraciones_datos ORDER BY id`);
			const lineas = await consultar(`SELECT COUNT(*)::int AS n FROM ordenes_productos_sabores`);

			await new MigracionesDatosService(dataSource, PASOS_MIGRACION).onApplicationBootstrap();

			expect(await consultar(`SELECT id, ejecutada_en FROM migraciones_datos ORDER BY id`)).toEqual(antes);
			expect(await consultar(`SELECT COUNT(*)::int AS n FROM ordenes_productos_sabores`)).toEqual(lineas);
		}, 60_000);
	});

	describe('4. verificación posterior', () => {
		it('no cambió ni una fila ni un peso y todo lo transformado quedó bien', async () => {
			const r = await verificarMigracion(consultar, base);

			const fallas = r.pruebas.filter((p) => p.estado === 'falla');
			expect(fallas).toEqual([]);
			expect(r.ok).toBe(true);
			expect(formatearVerificacion(r)).toMatch(/Sin fallas/);
		}, 60_000);

		it('lo único que se mueve es esperado: el reparto efectivo/QR de la mixta completada y los sabores del calzone', async () => {
			const r = await verificarMigracion(consultar, base);

			expect(r.pruebas.find((p) => p.id === 'reparto-por-medio')).toEqual(
				expect.objectContaining({estado: 'aviso', detalle: expect.stringContaining('2026-07 efectivo +18000')}),
			);
			expect(r.pruebas.find((p) => p.id === 'sabores-catalogo')?.detalle).toMatch(
				/Carnes, De Casa, Hawaiana, Mexicana/,
			);
		}, 60_000);

		it('el precio de cada pizza sigue igual (fórmula anterior = fórmula nueva en todas las combinaciones)', async () => {
			const r = await compararPreciosSabores(consultar);

			expect(r.diferencias).toEqual([]);
			expect(r.combinaciones).toBeGreaterThan(200);
			expect(r.productos).toEqual(['Pizza']);
		});
	});

	describe('5. el histórico quedó asignado a los sabores correctos', () => {
		const sabores = async (texto: string) =>
			(
				await consultar(
					`SELECT s.sabor_nombre AS nombre, g.nombre AS grupo, ps.activo
					 FROM ordenes_productos op
					 JOIN ordenes_productos_sabores s ON s.orden_producto_id = op.id
					 JOIN pizza_sabores ps ON ps.sabor_id = s.sabor_id
					 JOIN sabor_grupos g ON g.id = ps.grupo_id
					 WHERE op.producto = $1 ORDER BY s.posicion`,
					[texto],
				)
			).map((r) => `${r.nombre}[${r.grupo}${r.activo ? '' : ',inactivo'}]`);

		it('los sabores de pizza van al grupo Pizza y los de calzone al grupo Calzone, aunque se llamen igual', async () => {
			expect(await sabores('Pizza - Grande (Paisa + Carnes)')).toEqual(['Paisa[Pizza]', 'Carnes[Pizza]']);
			expect(await sabores('Calzone (De Casa + Carnes)')).toEqual(['De Casa[Calzone]', 'Carnes[Calzone]']);
			expect(await sabores('Calzone - Hawaiana (Hawaiana)')).toEqual(['Hawaiana[Calzone]']);
		});

		it('"Paisa" apunta al sabor especial que sobrevive, nunca al tradicional que se desactivó', async () => {
			const usados = await consultar(
				`SELECT DISTINCT ps.tipo, ps.activo FROM ordenes_productos_sabores s JOIN pizza_sabores ps ON ps.sabor_id = s.sabor_id WHERE s.sabor_nombre = 'Paisa'`,
			);
			expect(usados).toEqual([{tipo: 'especial', activo: true}]);
			expect(
				await consultar(
					`SELECT activo, grupo_id FROM pizza_sabores WHERE nombre = 'Paisa' AND tipo = 'tradicional'`,
				),
			).toEqual([{activo: false, grupo_id: null}]);
		});

		it('el formato legado ("pizza grande paisa y carnes") también se estructura', async () => {
			expect(await sabores('pizza grande paisa y carnes')).toEqual(['Paisa[Pizza]', 'Carnes[Pizza]']);
			expect(
				await consultar(
					`SELECT tamano, categoria FROM ordenes_productos WHERE producto = 'pizza grande paisa y carnes'`,
				),
			).toEqual([{tamano: 'grande', categoria: 'pizza'}]);
		});

		it('lo que no se puede reconocer queda marcado, no inventado', async () => {
			expect(
				await consultar(
					`SELECT categoria, "productoObjProductoId" AS producto_id, detalle_version FROM ordenes_productos WHERE producto = 'Combo familiar'`,
				),
			).toEqual([{categoria: 'otro', producto_id: null, detalle_version: 'v1'}]);
		});
	});

	describe('6. facturación: lo que cambia y lo que no', () => {
		it('las facturas pagadas quedan con monto_pagado y el desglose por medio explícitos', async () => {
			expect(
				await consultar(
					`SELECT COUNT(*)::int AS n FROM facturas_ventas WHERE estado IN ('pagado','pagada') AND monto_pagado IS NULL`,
				),
			).toEqual([{n: 0}]);
			// La pagada en efectivo que tenía pago_efectivo NULL (factura 3): ahora vale su total.
			expect(
				await consultar(
					`SELECT pago_efectivo, pago_transferencia, monto_pagado FROM facturas_ventas WHERE factura_id = 3`,
				),
			).toEqual([{pago_efectivo: '17000', pago_transferencia: '0', monto_pagado: '17000'}]);
		});

		it('la mixta con UNA parte conocida se completa; la que no tiene ninguna se deja para corregir a mano', async () => {
			expect(
				await consultar(`SELECT pago_efectivo, pago_transferencia FROM facturas_ventas WHERE factura_id = 6`),
			).toEqual([{pago_efectivo: '18000', pago_transferencia: '20000'}]);
			expect(
				await consultar(`SELECT pago_efectivo, pago_transferencia FROM facturas_ventas WHERE factura_id = 7`),
			).toEqual([{pago_efectivo: null, pago_transferencia: null}]);
		});

		it('ningún total cambió y las pendientes siguen pendientes', async () => {
			// La de Pedro Ruiz (Grande de Paisa 47.500 + domicilio 4.000) sigue debiéndose completa.
			expect(
				await consultar(
					`SELECT estado, total, monto_pagado FROM facturas_ventas WHERE cliente_nombre = 'Pedro Ruiz'`,
				),
			).toEqual([{estado: 'pendiente', total: '51500', monto_pagado: null}]);
			expect(await consultar(`SELECT COUNT(*)::int AS n FROM facturas_ventas`)).toEqual([{n: 24}]);
		});
	});

	describe('7. inventario unificado', () => {
		it('cajas y bebidas pasan con su saldo (lo negativo queda en 0) y hay reglas de consumo', async () => {
			const items = await consultar(
				`SELECT origen, tipo, cantidad, activo FROM inventario_items ORDER BY origen`,
			);
			const porOrigen = new Map(items.map((i) => [i.origen, i]));

			expect(porOrigen.get('caja:1')).toEqual(expect.objectContaining({tipo: 'caja', cantidad: 40}));
			expect(porOrigen.get('caja:3')).toEqual(expect.objectContaining({cantidad: 0})); // tenía -3
			expect(porOrigen.get('variante:11')).toEqual(expect.objectContaining({tipo: 'bebida', cantidad: 12}));
			expect(porOrigen.get('variante:13')).toEqual(expect.objectContaining({cantidad: 0})); // tenía -2
			expect((await consultar(`SELECT COUNT(*)::int AS n FROM inventario_consumos`))[0].n).toBeGreaterThan(0);
			const [corte] = await consultar(
				`SELECT resultado->>'fechaCorte' AS corte FROM migraciones_datos WHERE id = 'inventario-unificado-v1'`,
			);
			expect(corte.corte).toBeTruthy();
		});
	});
});
