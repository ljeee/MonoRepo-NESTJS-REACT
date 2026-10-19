import * as fs from 'fs';
import * as path from 'path';
import {PGlite} from '@electric-sql/pglite';
import {AnaliticaService} from '../../../src/estadisticas/analitica/analitica.service';
import {productosCategoriaV1} from '../../../src/common/migraciones-datos/pasos/productos-categoria-v1';
import {ventasDetalleV1, cargarContextoCatalogo} from '../../../src/common/migraciones-datos/pasos/ventas-detalle-v1';

/**
 * Ejecuta el SQL REAL de la analítica y del backfill contra un PostgreSQL embebido
 * (PGlite, Postgres compilado a WASM). Los datos de fixtures/seed.sql cubren: pagada en
 * efectivo, mixta con domicilio y precio manual, parcial, cancelada, importada por CSV
 * (sin orden ni monto_pagado) e histórico sin detalle estructurado.
 */
describe('Analítica contra PostgreSQL (PGlite)', () => {
	let pg: PGlite;
	let manager: any;
	let svc: AnaliticaService;
	const F = {from: '2026-05-01', to: '2026-05-31'};

	beforeAll(async () => {
		pg = new PGlite();
		await pg.exec(`SET TIME ZONE 'America/Bogota';`);
		await pg.exec(fs.readFileSync(path.join(__dirname, 'fixtures/schema.sql'), 'utf8'));
		await pg.exec(fs.readFileSync(path.join(__dirname, 'fixtures/seed.sql'), 'utf8'));

		let savepoint = 0;
		manager = {
			query: async (sql: string, params: unknown[] = []) => (await pg.query(sql, params as any[])).rows,
			// Transacción anidada = SAVEPOINT, igual que TypeORM dentro de una transacción.
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
		svc = new AnaliticaService({query: manager.query} as any);
	}, 60000);

	afterAll(async () => {
		await pg?.close();
	});

	it('KPIs de dinero con las definiciones únicas', async () => {
		const r = await svc.resumen({...F, comparar: true});
		expect(r.actual).toEqual(
			expect.objectContaining({
				facturado: 292000, // excluye la factura de la orden cancelada
				facturas: 5, // incluye la importada por CSV sin orden
				cobrado: 277000, // parcial cuenta lo abonado; CSV sin monto_pagado cuenta el total
				porCobrar: 15000,
				ordenes: 4,
				canceladas: 1,
				tasaCancelacion: 20,
				unidades: 9,
				descuentos: 4000,
			}),
		);
		expect(r.anterior?.facturado).toBe(0);
		expect(r.destacados.pizzaMasVendida).toEqual({tamano: 'grande', sabores: ['Carnes', 'Paisa'], unidades: 2});
	});

	it('el reparto por método suma exactamente lo cobrado', async () => {
		const mix = await svc.mix(F);
		expect(mix.cobradoPorMetodo).toEqual({efectivo: 197000, transferencia: 80000});
		// La fila vieja que solo guardó el NOMBRE ('Nequi') se enlaza con la cuenta por nombre.
		expect(mix.porCuenta).toEqual(
			expect.arrayContaining([
				{cuentaId: 1, cuenta: 'Nequi', sinAsignar: false, facturas: 1, monto: 20000},
				// parcial con abono QR sin cuenta (10000) + importada por CSV sin cuenta (50000)
				{cuentaId: null, cuenta: 'Sin asignar', sinAsignar: true, facturas: 2, monto: 60000},
			]),
		);
		// Lo cobrado por cuenta cuadra con lo cobrado por transferencia.
		expect(mix.porCuenta.reduce((t, c) => t + c.monto, 0)).toBe(mix.cobradoPorMetodo.transferencia);
	});

	it('el backfill estructura el histórico y es idempotente', async () => {
		await pg.exec('BEGIN');
		await productosCategoriaV1.run({manager, log: () => undefined});
		await pg.exec('COMMIT');

		const ctx = await cargarContextoCatalogo(manager);
		await pg.exec('BEGIN');
		const lote = await ventasDetalleV1.lote({manager, log: () => undefined}, ctx);
		await pg.exec('COMMIT');
		expect(lote).toEqual(
			expect.objectContaining({
				procesadas: 4,
				terminado: true,
				conteos: expect.objectContaining({saboresSinClasificar: 1}),
			}),
		);

		const filas = await manager.query(
			`SELECT op.producto, op."productoObjProductoId" AS producto_id, op.tamano, op.categoria,
				(SELECT string_agg(coalesce(s.sabor_id::text, '-') || ':' || s.sabor_nombre, ', ' ORDER BY s.posicion)
				 FROM ordenes_productos_sabores s WHERE s.orden_producto_id = op.id) AS sabores
			 FROM ordenes_productos op WHERE op.orden_id = 5 ORDER BY op.id`,
		);
		expect(filas).toEqual([
			{
				producto: 'pizza grande paisa y carnes',
				producto_id: 1,
				tamano: 'grande',
				categoria: 'pizza',
				sabores: '1:Paisa, 2:Carnes',
			},
			{
				producto: 'Pizza - Grande (Hawaiana + Marciana)',
				producto_id: 1,
				tamano: 'grande',
				categoria: 'pizza',
				sabores: '3:Hawaiana, -:Marciana',
			},
			{producto: 'Pizza Burguer - Paisa', producto_id: 4, tamano: null, categoria: 'comida', sabores: null},
			{producto: 'Calzone', producto_id: 2, tamano: null, categoria: 'calzone', sabores: '4:De la Casa'},
		]);

		const segundo = await ventasDetalleV1.lote({manager, log: () => undefined}, ctx);
		expect(segundo.procesadas).toBe(0);
	});

	it('productos agrupados por producto y por tamaño, con comparación', async () => {
		const porProducto = await svc.productos({...F, agrupar: 'producto', comparar: true});
		expect(porProducto.filas[0]).toEqual(
			expect.objectContaining({nombre: 'Pizza', unidades: 5, veces: 3, anterior: {unidades: 0, ingresos: 0}}),
		);
		const porTamano = await svc.productos({...F, agrupar: 'tamano'});
		expect(porTamano.filas.map((f) => [f.clave, f.unidades])).toEqual([
			['grande', 4],
			['mediana', 1],
		]);
	});

	it('sabores: ranking, filtro por tamaño, matriz y combinaciones', async () => {
		const sabores = await svc.sabores(F);
		expect(sabores.filas.slice(0, 2).map((s) => [s.nombre, s.apariciones, s.porciones])).toEqual([
			['Carnes', 3, 1.5],
			['Paisa', 3, 1.5],
		]);
		expect(sabores.sinClasificar).toEqual({apariciones: 1, porciones: 0.5});

		const grandes = await svc.sabores({...F, tamano: ['grande']});
		expect(grandes.filas.find((s) => s.nombre === 'Hawaiana')?.apariciones).toBe(1);

		const matriz = await svc.saboresMatriz(F);
		expect(matriz.tamanos).toEqual(['mediana', 'grande']);

		const combinaciones = await svc.combinaciones(F);
		expect(combinaciones.filas[0]).toEqual({sabores: ['Carnes', 'Paisa'], pizzas: 3, lineas: 2});
	});

	it('serie, horarios, clientes, domiciliarios, opciones y calidad corren sin error', async () => {
		const serie = await svc.serie({...F, granularidad: 'semana', comparar: true});
		expect(serie.puntos.reduce((s, p) => s + p.facturado, 0)).toBe(292000);
		expect(serie.anterior).toHaveLength(serie.puntos.length);

		const horarios = await svc.horarios(F);
		expect(horarios.porDia[6]).toEqual({diaSemana: 7, facturas: 1, facturado: 94000}); // 10-may-2026 fue domingo

		const clientes = await svc.clientes(F);
		expect(clientes.filas[0]).toEqual(
			expect.objectContaining({telefono: '3001112222', facturas: 2, gasto: 127000}),
		);

		// Solo los teléfonos pedidos (aunque lleguen con +57), sin depender del top: lo usa la lista de clientes.
		const soloUno = await svc.clientes({...F, telefonos: ['+57 300 111 2222', '3000000000']});
		expect(soloUno.filas.map((f) => f.telefono)).toEqual(['3001112222']);

		const domiciliarios = await svc.domiciliarios(F);
		expect(domiciliarios.filas[0]).toEqual(expect.objectContaining({nombre: 'Pedro', entregas: 1, ganancia: 5000}));
		// Resumen diario: cuántos domicilios salieron cada día y de quién (día en hora de Bogotá).
		expect(domiciliarios.totales).toEqual({domicilios: 1, sinRepartidor: 0, asignados: 1, entregados: 1, costoDomicilios: 5000, aPagar: 5000});
		expect(domiciliarios.porDia).toEqual([
			{dia: '2026-05-11', telefono: '3110000000', nombre: 'Pedro', domicilios: 1, entregas: 1, ganancia: 5000},
		]);

		const opciones = await svc.opciones();
		expect(opciones.sabores.map((s) => s.nombre)).not.toContain('RECARGO_3_SABORES');
		expect(opciones.grupos.map((g) => g.nombre)).toEqual(['Pizza', 'Calzone']);
		expect(opciones.sabores.find((x) => x.nombre === 'Paisa')?.grupoId).toBe(1);

		const calidad = await svc.calidadDatos();
		expect(calidad.lineas.pendientes).toBe(0);
	});

	it('clientes paginados en el servidor: páginas sin solaparse, orden del SQL y totales de TODO el período', async () => {
		// Junio (las demás pruebas usan mayo): empate de gasto entre Uno y Cuatro, recurrentes, un cliente sin
		// teléfono y una "Mesa 4" que no es un cliente.
		await pg.exec(`INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, cliente_nombre, telefono_cliente) VALUES
			('2026-06-01 12:00:00-05','pagado','efectivo',10000,10000,'Uno','3101000001'),
			('2026-06-20 12:00:00-05','pagado','efectivo',30000,30000,'Uno','+57 310 100 0001'),
			('2026-06-05 12:00:00-05','pagado','efectivo',50000,50000,'Dos','3101000002'),
			('2026-06-02 12:00:00-05','pagado','efectivo',5000,5000,'Tres','3101000003'),
			('2026-06-03 12:00:00-05','pagado','efectivo',5000,5000,'Tres','3101000003'),
			('2026-06-25 12:00:00-05','pagado','efectivo',5000,5000,'Tres','3101000003'),
			('2026-06-10 12:00:00-05','pagado','efectivo',40000,40000,'Cuatro','3101000004'),
			('2026-06-15 12:00:00-05','pagado','efectivo',20000,20000,'Laura',NULL),
			('2026-06-16 12:00:00-05','pagado','efectivo',99000,99000,'Mesa 4',NULL)`);
		const J = {from: '2026-06-01', to: '2026-06-30'};

		const todos = await svc.clientes({...J, limit: 200});
		expect(todos.total).toBe(5);
		expect(todos.resumen).toEqual({clientes: 5, recurrentes: 2, gasto: 165000});
		// Empate de gasto (Uno y Cuatro, 40.000): desempata la clave, así el orden es estable entre páginas.
		expect(todos.filas.map((c) => c.nombre)).toEqual(['Dos', 'Uno', 'Cuatro', 'Laura', 'Tres']);

		for (const orden of ['gasto', 'facturas', 'ticket', 'ultimaVisita'] as const) {
			const completo = await svc.clientes({...J, orden, limit: 200});
			// De a un cliente por página: juntas dan exactamente la lista completa, en el mismo orden.
			const paginas: (typeof completo.filas)[number][] = [];
			for (let i = 0; i < completo.total; i++) {
				const pagina = await svc.clientes({...J, orden, limit: 1, offset: i});
				expect(pagina.total).toBe(completo.total);
				expect(pagina.resumen).toEqual(completo.resumen);
				paginas.push(...pagina.filas);
			}
			expect(paginas.map((c) => c.clave)).toEqual(completo.filas.map((c) => c.clave));
			expect(new Set(paginas.map((c) => c.clave)).size).toBe(completo.total);

			const valor = (c: (typeof completo.filas)[number]) =>
				orden === 'ultimaVisita' ? new Date(c.ultimaVisita).getTime() : orden === 'ticket' ? c.gasto / c.facturas : c[orden];
			for (let i = 1; i < completo.filas.length; i++) {
				expect(valor(completo.filas[i - 1])).toBeGreaterThanOrEqual(valor(completo.filas[i]));
			}
		}

		// Página fuera de rango: sin filas, pero con los totales.
		const vacia = await svc.clientes({...J, limit: 10, offset: 1000});
		expect(vacia.filas).toEqual([]);
		expect(vacia.total).toBe(todos.total);
		expect(vacia.resumen).toEqual(todos.resumen);
	});

	it('resumen general de dinero con gastos', async () => {
		const r = await svc.resumenGeneral(F.from, F.to);
		expect(r.gastos).toEqual(expect.objectContaining({total: 35000, pagados: 20000, pendientes: 15000}));
		// Egresos por tipo y categoría; la utilidad bruta resta solo los costos pagados.
		expect(r.gastos.porTipo).toEqual([
			{tipo: 'costo', cantidad: 1, total: 20000, pagados: 20000},
			{tipo: 'gasto', cantidad: 1, total: 15000, pagados: 0},
			{tipo: 'sin_clasificar', cantidad: 0, total: 0, pagados: 0},
		]);
		expect(r.gastos.porCategoria).toEqual(
			expect.arrayContaining([{categoria: 'insumos', tipo: 'costo', cantidad: 1, total: 20000, pagados: 20000}]),
		);
		expect(r.gastos.porMetodo).toEqual(
			expect.arrayContaining([{metodo: 'qr', total: 15000, pagados: 0}]),
		);
		expect(r.resultado).toEqual({
			ingresos: 277000,
			costos: 20000,
			utilidadBruta: 257000,
			gastosOperativos: 0,
			sinClasificar: 0,
			utilidadOperativa: 257000,
		});
		expect(r.resultado.utilidadOperativa).toBe(r.balance.cobrado);
		// Productos vendidos del rango (completo) y ajuste manual de precio: la mediana se vendió a 28000
		// con lista 32000 → baja de 4000; sin aumentos; las líneas históricas sin precio_lista no se inventan.
		expect(r.productos.reduce((t, x) => t + x.valor, 0)).toBe(282000);
		expect(r.productos.reduce((t, x) => t + x.unidades, 0)).toBe(9);
		expect(r.ajustesPrecio).toEqual({aumentos: 0, bajas: -4000, neto: -4000, lineasManuales: 1, sinPrecioLista: 0});
		const mediana = r.productos.find((x) => x.bajas === -4000);
		expect(mediana).toEqual(expect.objectContaining({unidades: 1, valor: 28000, ajuste: -4000, lineasManuales: 1}));
		expect(r.balance).toEqual({devengado: 257000, cobrado: 257000});
		expect(r.ventas.costoDomicilios).toBe(5000);
		// El desglose por estado cuadra con los totales (lo usan los chips de las pantallas de dinero).
		const suma = (k: 'facturas' | 'porCobrar') => r.ventas.porEstado.reduce((t, e) => t + e[k], 0);
		expect(suma('facturas')).toBe(r.ventas.facturas);
		expect(suma('porCobrar')).toBe(r.ventas.porCobrar);
	});

	it('todos los filtros combinados generan SQL válido y filtran bien', async () => {
		const r = await svc.resumen({
			...F,
			tipoPedido: ['domicilio'],
			canal: ['web'],
			productoId: [1],
			tamano: ['mediana'],
			diaSemana: [1, 2, 3, 4, 5, 6, 7],
			horaDesde: 18,
			horaHasta: 23,
			metodoPago: ['mixto'],
			estadoPago: ['cobrada'],
			cliente: '3001112222',
			domiciliario: '3110000000',
			saborId: [3],
			saborGrupoId: [1],
			precioManual: true,
			categoria: ['pizza'],
		});
		expect(r.filtrosDeLinea).toBe(true);
		expect(r.actual).toEqual(expect.objectContaining({facturado: 33000, facturas: 1, unidades: 1}));
	});

	it('top de productos para el cierre agrupa por producto + variante', async () => {
		expect(await svc.topProductosCierre('2026-05-10')).toEqual([
			{producto: 'Pizza - Grande', totalVendido: 2, ingresos: 90000},
			{producto: 'GASEOSA - Coca Cola Personal', totalVendido: 1, ingresos: 4000},
		]);
	});
});
