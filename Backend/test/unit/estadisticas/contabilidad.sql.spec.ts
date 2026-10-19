import * as fs from 'fs';
import * as path from 'path';
import {PGlite} from '@electric-sql/pglite';
import {AnaliticaService} from '../../../src/estadisticas/analitica/analitica.service';
import {FacturasVentasService} from '../../../src/facturas-ventas/facturas-ventas.service';
import {FacturasPagosService} from '../../../src/facturas-pagos/facturas-pagos.service';
import {
	sqlCoincideCuenta,
	sqlFacturaValida,
	sqlMontoTransferencia,
	sqlTransferenciasPorCuenta,
} from '../../../src/common/domain/ventas';

/**
 * Contabilidad contra PostgreSQL real (PGlite): transferencias por cuenta, abonos QR a cuentas
 * distintas, cuentas renombradas o eliminadas, y egresos por tipo/categoría. Usa junio de 2026
 * (lo que no toca el seed de la analítica) con sus propios datos.
 */
describe('Contabilidad contra PostgreSQL (PGlite)', () => {
	let pg: PGlite;
	let svc: AnaliticaService;
	const R = {from: '2026-06-01', to: '2026-06-30'};
	const consultar = async (sql: string, params: unknown[] = []) => (await pg.query(sql, params as any[])).rows as any[];

	beforeAll(async () => {
		pg = new PGlite();
		await pg.exec(`SET TIME ZONE 'America/Bogota';`);
		await pg.exec(fs.readFileSync(path.join(__dirname, 'fixtures/schema.sql'), 'utf8'));
		await pg.exec(`
			INSERT INTO cuentas_transferencia (nombre) VALUES ('Nequi'), ('Bancolombia');

			-- A: QR completo a Nequi
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_transferencia, cuenta_transferencia_id, cuenta_transferencia_nombre)
			VALUES ('2026-06-02 12:00:00-05', 'pagado', 'transferencia', 100000, 100000, 100000, 1, 'Nequi');
			-- B: QR a Bancolombia, pero la factura guardó el nombre VIEJO de la cuenta (renombrada después)
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_transferencia, cuenta_transferencia_id, cuenta_transferencia_nombre)
			VALUES ('2026-06-03 12:00:00-05', 'pagado', 'qr', 50000, 50000, 50000, 2, 'Banco viejo');
			-- C: parcial (40k de 60k abonados por QR): 15k a Nequi y 25k a Bancolombia
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_efectivo, pago_transferencia, cuenta_transferencia_id, cuenta_transferencia_nombre, desglose_transferencia)
			VALUES ('2026-06-04 12:00:00-05', 'parcial', NULL, 60000, 40000, 0, 40000, 2, 'Bancolombia',
				'[{"cuentaId":1,"cuenta":"Nequi","monto":15000},{"cuentaId":2,"cuenta":"Bancolombia","monto":25000}]');
			-- D: mixta (30k efectivo + 50k QR) sin cuenta asignada
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_efectivo, pago_transferencia)
			VALUES ('2026-06-05 12:00:00-05', 'pagado', 'efectivo_transferencia', 80000, 80000, 30000, 50000);
			-- E: pendiente con método QR preasignado: no es dinero cobrado
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, cuenta_transferencia_id, cuenta_transferencia_nombre)
			VALUES ('2026-06-06 12:00:00-05', 'pendiente', 'transferencia', 70000, 1, 'Nequi');
			-- F: anulada
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_transferencia, cuenta_transferencia_id, cuenta_transferencia_nombre)
			VALUES ('2026-06-07 12:00:00-05', 'cancelado', 'transferencia', 20000, 20000, 20000, 1, 'Nequi');
			-- G: cuenta eliminada de la tabla (id 9): conserva el nombre que guardó la factura
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_transferencia, cuenta_transferencia_id, cuenta_transferencia_nombre)
			VALUES ('2026-06-08 12:00:00-05', 'pagado', 'transferencia', 10000, 10000, 10000, 9, 'Cuenta borrada');
			-- H: fila vieja que solo guardó el nombre de la cuenta
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_transferencia, cuenta_transferencia_nombre)
			VALUES ('2026-06-09 12:00:00-05', 'pagado', 'transferencia', 5000, 5000, 5000, 'Bancolombia');
			-- Pagada en efectivo con una cuenta vieja pegada (no debe contar como transferencia)
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_efectivo, cuenta_transferencia_id, cuenta_transferencia_nombre)
			VALUES ('2026-06-10 12:00:00-05', 'pagado', 'efectivo', 30000, 30000, 30000, 1, 'Nequi');

			-- Julio: ajustes manuales de precio (aumento, baja, sin precio de lista)
			INSERT INTO productos (producto_nombre, categoria) VALUES ('Pizza', 'pizza');
			INSERT INTO producto_variantes (producto_id, nombre, precio) VALUES (1, 'Grande', 45000);
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_efectivo)
			VALUES ('2026-07-01 12:00:00-05', 'pagado', 'efectivo', 142000, 142000, 142000);
			INSERT INTO ordenes (factura_id, estado_orden) VALUES (10, 'completada');
			INSERT INTO ordenes_productos (orden_id, producto, cantidad, precio_unitario, variante_id, "productoObjProductoId", precio_lista, precio_manual) VALUES
				(1, 'Pizza - Grande', 2, 50000, 1, 1, 45000, true),   -- aumento +10000
				(1, 'Pizza - Grande', 1, 40000, 1, 1, 45000, true),   -- baja -5000
				(1, 'Pizza - Grande', 1, 2000, 1, 1, NULL, true);     -- manual histórica sin lista

			-- Egresos por QR con la cuenta de la que salieron (cuenta_origen_id): Luz es histórico, sin cuenta
			INSERT INTO facturas_pagos (total, nombre_gasto, estado, fecha_factura, metodo, categoria, tipo_gasto, cuenta_origen_id) VALUES
				(1200000, 'Nómina cocina', 'pagado', '2026-06-05', 'qr', 'nomina', 'gasto', 1),
				(300000, 'Queso y harina', 'pagado', '2026-06-06', 'efectivo', 'insumos', 'costo', NULL),
				(800000, 'Nómina pizzeros (costo)', 'pagado', '2026-06-06', 'qr', 'nomina', 'costo', 2),
				(80000, 'Luz', 'pagado', '2026-06-07', 'qr', 'general', NULL, NULL),
				(500000, 'Arriendo', 'pendiente', '2026-06-30', 'qr', 'arriendo', 'gasto', 1);
		`);
		svc = new AnaliticaService({query: consultar} as any);
	}, 60000);

	afterAll(async () => {
		await pg?.close();
	});

	it('transferencias por cuenta: por id con el nombre vigente, abonos repartidos, sin asignar y cuenta eliminada', async () => {
		const mix = await svc.mix(R);

		expect(mix.porCuenta).toEqual([
			// A 100000 + parte de C 15000
			{cuentaId: 1, cuenta: 'Nequi', sinAsignar: false, facturas: 2, monto: 115000},
			// B 50000 (nombre viejo ignorado) + parte de C 25000 + H 5000 (solo nombre)
			{cuentaId: 2, cuenta: 'Bancolombia', sinAsignar: false, facturas: 3, monto: 80000},
			// D: la parte QR de la mixta
			{cuentaId: null, cuenta: 'Sin asignar', sinAsignar: true, facturas: 1, monto: 50000},
			// G: cuenta que ya no está en la tabla
			{cuentaId: 9, cuenta: 'Cuenta borrada', sinAsignar: false, facturas: 1, monto: 10000},
		]);
		// Ni la pendiente (E), ni la anulada (F), ni el efectivo con cuenta pegada cuentan.
	});

	it('el total por cuenta cuadra con lo cobrado por transferencia', async () => {
		const mix = await svc.mix(R);

		const porCuenta = mix.porCuenta.reduce((t, c) => t + c.monto, 0);
		expect(porCuenta).toBe(255000);
		expect(porCuenta).toBe(mix.cobradoPorMetodo.transferencia);
		expect(mix.cobradoPorMetodo.efectivo).toBe(60000); // 30000 de la mixta + 30000 en efectivo
	});

	it('resumen general: el desglose por cuenta viaja con el resumen que usan las pantallas', async () => {
		const r = await svc.resumenGeneral(R.from, R.to);

		expect(r.ventas.porCuenta.map((c) => [c.cuenta, c.monto])).toEqual([
			['Nequi', 115000],
			['Bancolombia', 80000],
			['Sin asignar', 50000],
			['Cuenta borrada', 10000],
		]);
		expect(r.ventas.cobrado).toBe(315000); // 255000 por transferencia + 60000 en efectivo
		expect(r.ventas.cobradoPorMetodo.efectivo + r.ventas.cobradoPorMetodo.transferencia).toBe(r.ventas.cobrado);
	});

	it('egresos QR por cuenta de origen y saldo por cuenta (entradas − salidas pagadas)', async () => {
		const r = await svc.resumenGeneral(R.from, R.to);

		// Solo los egresos por QR; el de efectivo no pertenece a ninguna cuenta. Lo pendiente cuenta en total, no en pagados.
		expect(r.gastos.porCuenta).toEqual([
			{cuentaId: 1, cuenta: 'Nequi', sinAsignar: false, cantidad: 2, total: 1700000, pagados: 1200000},
			{cuentaId: 2, cuenta: 'Bancolombia', sinAsignar: false, cantidad: 1, total: 800000, pagados: 800000},
			{cuentaId: null, cuenta: 'Sin asignar', sinAsignar: true, cantidad: 1, total: 80000, pagados: 80000},
		]);
		expect(r.cuentas).toEqual([
			{cuentaId: 1, cuenta: 'Nequi', sinAsignar: false, entradas: 115000, salidas: 1200000, saldo: -1085000},
			{cuentaId: 2, cuenta: 'Bancolombia', sinAsignar: false, entradas: 80000, salidas: 800000, saldo: -720000},
			{cuentaId: 9, cuenta: 'Cuenta borrada', sinAsignar: false, entradas: 10000, salidas: 0, saldo: 10000},
			{cuentaId: null, cuenta: 'Sin asignar', sinAsignar: true, entradas: 50000, salidas: 80000, saldo: -30000},
		]);
		// Las salidas por cuenta suman los egresos pagados por QR.
		const qrPagados = r.gastos.porMetodo.find((m) => m.metodo === 'qr')?.pagados ?? 0;
		expect(r.cuentas.reduce((t, c) => t + c.salidas, 0)).toBe(qrPagados);
	});

	it('egresos por tipo: costos y gastos separados, lo histórico sin clasificar, pendientes fuera del balance', async () => {
		const r = await svc.resumenGeneral(R.from, R.to);

		expect(r.gastos.total).toBe(2880000);
		expect(r.gastos.pagados).toBe(2380000);
		expect(r.gastos.pendientes).toBe(500000);
		expect(r.gastos.porTipo).toEqual([
			{tipo: 'costo', cantidad: 2, total: 1100000, pagados: 1100000},
			{tipo: 'gasto', cantidad: 2, total: 1700000, pagados: 1200000},
			{tipo: 'sin_clasificar', cantidad: 1, total: 80000, pagados: 80000},
		]);
		// La nómina aparece en ambos tipos: una fila por (categoría, tipo).
		expect(r.gastos.porCategoria.filter((c) => c.categoria === 'nomina')).toEqual(
			expect.arrayContaining([
				{categoria: 'nomina', tipo: 'gasto', cantidad: 1, total: 1200000, pagados: 1200000},
				{categoria: 'nomina', tipo: 'costo', cantidad: 1, total: 800000, pagados: 800000},
			]),
		);
		expect(r.gastos.porCategoria.find((c) => c.categoria === 'general')).toEqual({
			categoria: 'general',
			tipo: 'sin_clasificar',
			cantidad: 1,
			total: 80000,
			pagados: 80000,
		});
		// Estado de resultados: ingresos − costos = utilidad bruta; − gastos = utilidad operativa = balance cobrado.
		expect(r.resultado).toEqual({
			ingresos: 315000,
			costos: 1100000,
			utilidadBruta: -785000,
			gastosOperativos: 1200000,
			sinClasificar: 80000,
			utilidadOperativa: -2065000,
		});
		expect(r.resultado.utilidadOperativa).toBe(r.balance.cobrado);
		// Los totales por tipo suman el total de egresos.
		expect(r.gastos.porTipo.reduce((t, x) => t + x.total, 0)).toBe(r.gastos.total);
	});

	it('productos vendidos completos con su ajuste manual: aumentos, bajas y líneas sin precio de lista aparte', async () => {
		const r = await svc.resumenGeneral('2026-07-01', '2026-07-31');

		expect(r.productos).toEqual([
			{
				clave: '1',
				nombre: 'Pizza - Grande',
				categoria: 'pizza', // de productos.categoria: así el libro diario cuenta cuántas pizzas salieron
				unidades: 4,
				valor: 142000,
				lineasManuales: 3,
				sinPrecioLista: 1,
				aumentos: 10000,
				bajas: -5000,
				ajuste: 5000,
			},
		]);
		expect(r.ajustesPrecio).toEqual({aumentos: 10000, bajas: -5000, neto: 5000, lineasManuales: 3, sinPrecioLista: 1});
	});

	describe('exportación CSV desde el servidor (por tandas, sin tope)', () => {
		const leer = async (gen: AsyncGenerator<string>) => {
			const trozos: string[] = [];
			for await (const t of gen) trozos.push(t);
			return trozos;
		};
		const ventas = () => Object.assign(Object.create(FacturasVentasService.prototype), {repo: {query: consultar}}) as FacturasVentasService;
		const egresos = () => Object.assign(Object.create(FacturasPagosService.prototype), {repo: {query: consultar}}) as FacturasPagosService;

		it('un rango de miles de facturas sale completo, en varias tandas y sin repetir', async () => {
			await pg.exec(`
				INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_efectivo)
				SELECT '2026-08-15 12:00:00-05'::timestamptz + (g || ' seconds')::interval, 'pagado', 'efectivo', 1000, 1000, 1000
				FROM generate_series(1, 2300) g;
			`);

			const trozos = await leer(ventas().csvFacturas({from: '2026-08-01', to: '2026-08-31'}));
			const lineas = trozos.join('').split('\r\n').filter(Boolean);

			expect(trozos.length).toBe(4); // encabezado + 1000 + 1000 + 300
			expect(lineas).toHaveLength(2301); // encabezado + 2300 facturas, ninguna cortada a 50
			const ids = lineas.slice(1).map((l) => Number(l.split(',')[0]));
			expect(new Set(ids).size).toBe(2300);
			expect([...ids].sort((a, b) => b - a)).toEqual(ids); // orden estable por clave descendente
			expect(lineas[0]).toContain('Transferencia');
		});

		it('las columnas de dinero usan las definiciones únicas y filtran por cuenta o solo QR', async () => {
			const todas = (await leer(ventas().csvFacturas({from: '2026-06-01', to: '2026-06-30'}))).join('');
			expect(todas.split('\r\n').filter(Boolean)).toHaveLength(1 + 9); // encabezado + las 9 facturas de junio
			expect(todas).toContain('"no"'); // la anulada no es venta válida

			const qr = (await leer(ventas().csvFacturas({from: '2026-06-01', to: '2026-06-30', conTransferencia: true}))).join('');
			expect(qr.split('\r\n').filter(Boolean)).toHaveLength(1 + 6); // A, B, C, D, G, H

			const nequi = (await leer(ventas().csvFacturas({from: '2026-06-01', to: '2026-06-30', conTransferencia: true, cuentaTransferenciaId: 1}))).join('');
			expect(nequi.split('\r\n').filter(Boolean)).toHaveLength(1 + 2); // A y parte de C
			const sinCuenta = (await leer(ventas().csvFacturas({from: '2026-06-01', to: '2026-06-30', conTransferencia: true, cuentaTransferenciaId: -1}))).join('');
			expect(sinCuenta.split('\r\n').filter(Boolean)).toHaveLength(1 + 1); // D
		});

		it('filtrado por una cuenta, "Transferencia a esta cuenta" suma SOLO su parte, igual que el desglose por cuenta', async () => {
			/** Suma de la última columna (la de la cuenta) en las filas de datos. */
			const sumaCuenta = (csv: string) =>
				csv
					.split('\r\n')
					.filter(Boolean)
					.slice(1)
					.reduce((t, l) => t + Number(l.split(',').pop()), 0);
			const csvDe = async (cuentaTransferenciaId: number) =>
				(await leer(ventas().csvFacturas({...R, conTransferencia: true, cuentaTransferenciaId}))).join('');
			const r = await svc.resumenGeneral(R.from, R.to);
			const enResumen = (cuentaId: number | null) =>
				r.ventas.porCuenta.filter((c) => c.cuentaId === cuentaId && (cuentaId != null || c.sinAsignar)).reduce((t, c) => t + c.monto, 0);

			const nequi = await csvDe(1);
			expect(nequi.split('\r\n')[0]).toContain('Transferencia a esta cuenta');
			// A (100k) + la parte Nequi de C (15k). La columna "Transferencia" de C sigue diciendo 40k (todo su QR).
			expect(sumaCuenta(nequi)).toBe(115000);
			expect(sumaCuenta(nequi)).toBe(enResumen(1));

			// B (guardó un nombre viejo, pero su id es Bancolombia) + 25k de C + H (fila vieja con solo el nombre).
			expect(sumaCuenta(await csvDe(2))).toBe(80000);
			expect(sumaCuenta(await csvDe(2))).toBe(enResumen(2));

			// Sin cuenta asignada: la parte QR de la mixta D.
			expect(sumaCuenta(await csvDe(-1))).toBe(50000);
			expect(sumaCuenta(await csvDe(-1))).toBe(enResumen(null));

			// Sin filtro de cuenta no se agrega la columna.
			const todas = (await leer(ventas().csvFacturas({...R, conTransferencia: true}))).join('');
			expect(todas.split('\r\n')[0]).not.toContain('Transferencia a esta cuenta');
		});

		it('los egresos salen con tipo, categoría y la cuenta de la que salieron; el texto no inyecta fórmulas', async () => {
			await pg.exec("INSERT INTO facturas_pagos (total, nombre_gasto, estado, fecha_factura, metodo, categoria, tipo_gasto) VALUES (1, '=HYPERLINK(\"x\")', 'pagado', '2026-06-20', 'efectivo', 'otros', 'gasto')");
			const csv = (await leer(egresos().csvEgresos({from: '2026-06-01', to: '2026-06-30'}))).join('');
			const lineas = csv.split('\r\n').filter(Boolean);

			expect(lineas).toHaveLength(1 + 6); // encabezado + los 5 de junio + el de la fórmula
			expect(csv).toContain('"Nequi"'); // Nómina cocina salió de Nequi
			expect(csv).toContain('"Bancolombia"');
			expect(csv).toContain('"sin clasificar"');
			expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\""); // neutralizada con apóstrofo y comillas escapadas
			const soloCostos = (await leer(egresos().csvEgresos({from: '2026-06-01', to: '2026-06-30', tipo: 'costo'}))).join('');
			expect(soloCostos.split('\r\n').filter(Boolean)).toHaveLength(1 + 2);
		});
	});

	describe('filtros de la lista de transferencias (mismo criterio que el resumen)', () => {
		const idsConTransferencia = async () =>
			(
				await consultar(
					`SELECT f.factura_id AS id FROM facturas_ventas f
					 WHERE ${sqlFacturaValida('f')} AND ${sqlMontoTransferencia('f')} > 0 AND f."fechaFactura" >= '2026-06-01'
					 ORDER BY 1`,
				)
			).map((r) => Number(r.id));

		it('lista exactamente las facturas que suman en "cobrado por transferencia"', async () => {
			// A, B, C (parcial con abonos QR), D (mixta), G, H. Fuera: E pendiente, F anulada, la de efectivo.
			const ids = await idsConTransferencia();
			const filas = await consultar(
				`SELECT DISTINCT t.factura_id AS id FROM (${sqlTransferenciasPorCuenta(`f."fechaFactura" >= '2026-06-01' AND ${sqlFacturaValida('f')}`)}) t ORDER BY 1`,
			);
			expect(filas.map((r) => Number(r.id))).toEqual(ids);
			expect(ids).toHaveLength(6);
		});

		it('filtrar por una cuenta trae también las facturas abonadas a varias cuentas', async () => {
			const filtrar = async (cuenta: number | null) =>
				(
					await consultar(
						`SELECT f.factura_id AS id FROM facturas_ventas f
						 WHERE ${sqlFacturaValida('f')} AND ${sqlMontoTransferencia('f')} > 0 AND f."fechaFactura" >= '2026-06-01'
						 AND ${cuenta == null ? sqlCoincideCuenta(null) : sqlCoincideCuenta('$1')} ORDER BY 1`,
						cuenta == null ? [] : [cuenta],
					)
				).map((r) => Number(r.id));

			const todas = await idsConTransferencia(); // [A, B, C, D, G, H] = ids 1,2,3,4,7,8
			expect(todas).toEqual([1, 2, 3, 4, 7, 8]);
			// Nequi: A y C (parte de C). Bancolombia: B, C (parte) y H (solo nombre). Sin asignar: D.
			expect(await filtrar(1)).toEqual([1, 3]);
			expect(await filtrar(2)).toEqual([2, 3, 8]);
			expect(await filtrar(null)).toEqual([4]);
		});
	});
});
