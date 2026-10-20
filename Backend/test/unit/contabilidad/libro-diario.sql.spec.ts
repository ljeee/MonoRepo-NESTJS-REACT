import * as fs from 'fs';
import * as path from 'path';
import {BadRequestException} from '@nestjs/common';
import {PGlite} from '@electric-sql/pglite';
import {AnaliticaService} from '../../../src/estadisticas/analitica/analitica.service';
import {LibroDiarioService} from '../../../src/contabilidad/libro-diario/libro-diario.service';
import {docLibroDiario} from '../../../src/contabilidad/libro-diario/libro-diario.pdf';
import {renderizarPdf, textoPdf} from '../../../src/common/pdf/pdf.util';

/**
 * Libro diario del servidor contra PostgreSQL real (PGlite): una fila por venta con su forma de pago y una por gasto.
 * Sus totales deben ser los del resumen que ven las pantallas y el cierre (cobrado, efectivo, QR por cuenta, por
 * cobrar, gastos pagados, balance de caja). Octubre de 2026 con datos propios.
 */
describe('Libro diario (PGlite)', () => {
	let pg: PGlite;
	let analitica: AnaliticaService;
	let libro: LibroDiarioService;
	const mail = {configurado: jest.fn(() => true), enviarConAdjuntos: jest.fn(async () => undefined)};
	const empresa = {
		getCorreoContador: jest.fn(async (): Promise<string | null> => 'conta@ejemplo.com'),
		getConfig: jest.fn(async () => ({nombreComercial: 'Dfiru Pizzería', nit: '900'})),
	};
	const variables: Record<string, string> = {REPORT_EMAIL: 'dueno@ejemplo.com'};
	const config = {get: jest.fn((k: string, d?: unknown) => variables[k] ?? d)};
	const R = {from: '2026-10-01', to: '2026-10-31'};
	const textoDe = (doc: unknown) => JSON.stringify(doc);

	beforeAll(async () => {
		pg = new PGlite();
		await pg.exec(`SET TIME ZONE 'America/Bogota';`);
		await pg.exec(fs.readFileSync(path.join(__dirname, '../estadisticas/fixtures/schema.sql'), 'utf8'));
		await pg.exec(`
			INSERT INTO cuentas_transferencia (nombre) VALUES ('Nequi'), ('Bancolombia');
			INSERT INTO domiciliarios (telefono, domiciliario_nombre) VALUES ('3110000000', 'Pedro');
			-- 1: efectivo con domicilio y productos (la misma pizza a precio del menú y con precio manual)
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_efectivo, cliente_nombre)
			VALUES ('2026-10-02 19:00:00-05', 'pagado', 'efectivo', 60000, 60000, 60000, 'Ana');
			-- 2: QR completo a Nequi
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_transferencia, cuenta_transferencia_id, cuenta_transferencia_nombre, cliente_nombre)
			VALUES ('2026-10-03 20:00:00-05', 'pagado', 'transferencia', 30000, 30000, 30000, 1, 'Nequi', 'Beto');
			-- 3: parcial 40k de 60k abonados por QR a dos cuentas
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_efectivo, pago_transferencia, cuenta_transferencia_id, cuenta_transferencia_nombre, desglose_transferencia, cliente_nombre)
			VALUES ('2026-10-04 12:00:00-05', 'parcial', NULL, 60000, 40000, 0, 40000, 2, 'Bancolombia',
				'[{"cuentaId":1,"cuenta":"Nequi","monto":15000},{"cuentaId":2,"cuenta":"Bancolombia","monto":25000}]', 'Caro');
			-- 4: mixta 30k efectivo + 50k QR sin cuenta, con domicilio sin repartidor
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_efectivo, pago_transferencia, cliente_nombre)
			VALUES ('2026-10-05 13:00:00-05', 'pagado', 'efectivo_transferencia', 80000, 80000, 30000, 50000, 'Dani');
			-- 5: pendiente (por cobrar) · 6: anulada · 7: cobrada pero con la orden cancelada (no es venta válida)
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, cliente_nombre) VALUES ('2026-10-06 12:00:00-05', 'pendiente', 'efectivo', 70000, 'Eva');
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_efectivo, cliente_nombre) VALUES ('2026-10-07 12:00:00-05', 'cancelado', 'efectivo', 20000, 20000, 20000, 'Fer');
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_efectivo, cliente_nombre) VALUES ('2026-10-08 12:00:00-05', 'pagado', 'efectivo', 25000, 25000, 25000, 'Gabo');

			INSERT INTO ordenes (factura_id, tipo_pedido, estado_orden) VALUES (1, 'domicilio', 'completada'), (4, 'domicilio', 'completada'), (7, 'mesa', 'cancelado');
			INSERT INTO ordenes_productos (orden_id, producto, cantidad, precio_unitario, categoria, precio_lista, precio_manual) VALUES
				(1, 'Pizza - Grande', 1, 52000, 'pizza', 48000, true),
				(1, 'Pizza - Grande', 2, 48000, 'pizza', 48000, false),
				(1, 'Coca Cola - Personal', 2, 4000, 'bebida', 4000, false),
				(3, 'Pizza - Mediana (Hawaiana)', 1, 25000, 'pizza', 25000, false);
			INSERT INTO domicilios (factura_id, orden_id, telefono_domiciliario_asignado, costo_domicilio, estado_domicilio) VALUES
				-- asignado pero nadie lo marcó entregado (lo normal en la operación): igual cuenta para Pedro
				(1, 1, '3110000000', 5000, 'pendiente'),
				(4, 2, NULL, 3000, 'pendiente'),
				-- cancelado: no cuenta en ninguna cifra (ni para Pedro ni en el costo de domicilios)
				(2, NULL, '3110000000', 4000, 'cancelado');

			INSERT INTO facturas_pagos (total, nombre_gasto, estado, fecha_factura, metodo, categoria, tipo_gasto, cuenta_origen_id) VALUES
				(20000, 'Queso', 'pagado', '2026-10-02', 'efectivo', 'insumos', 'costo', NULL),
				(5000, 'Arriendo', 'pendiente', '2026-10-03', 'efectivo', 'arriendo', 'gasto', NULL),
				(15000, 'Harina', 'pagado', '2026-10-03', 'qr', 'insumos', 'costo', 1),
				(7000, 'Empaques', 'pagado', '2026-10-04', 'qr', 'empaques', 'costo', 2),
				(4000, 'Luz', 'pagado', '2026-10-04', 'qr', 'general', NULL, NULL),
				(9000, 'Gas', 'pendiente', '2026-10-05', 'qr', 'servicios', 'gasto', 1);
		`);
		const ds = {
			query: async (sql: string, params: unknown[] = []) => (await pg.query(sql, params as any[])).rows as any[],
		};
		analitica = new AnaliticaService(ds as any);
		libro = new LibroDiarioService(ds as any, analitica, empresa as any, mail as any, config as any);
	}, 60000);

	afterAll(async () => {
		await pg?.close();
	});

	beforeEach(() => {
		mail.enviarConAdjuntos.mockClear();
		mail.configurado.mockReturnValue(true);
		variables.REPORT_EMAIL = 'dueno@ejemplo.com';
	});

	it('libro completo: una fila por venta válida y totales = resumen (cobrado, efectivo, QR, por cobrar, gastos, balance)', async () => {
		const [l, r] = await Promise.all([
			libro.generar({...R, filtro: 'completo'}),
			analitica.resumenGeneral(R.from, R.to),
		]);

		expect(l.ventas.map((v) => v.id)).toEqual([1, 2, 3, 4, 5]); // ni la anulada (6) ni la de orden cancelada (7)
		expect(l.totales).toEqual({
			facturado: r.ventas.facturado,
			cobrado: r.ventas.cobrado,
			efectivo: r.ventas.cobradoPorMetodo.efectivo,
			qr: r.ventas.cobradoPorMetodo.transferencia,
			porCobrar: r.ventas.porCobrar,
			domicilios: 8000,
			gastosPagados: r.gastos.pagados,
			gastosPendientes: r.gastos.pendientes,
			saldo: r.balance.cobrado,
		});
		expect(l.totales.cobrado).toBe(210000);
		expect(l.saldoEtiqueta).toContain('Balance de caja');
		// Cada domicilio cuenta para su repartidor desde que se le asigna; el cancelado no.
		expect(l.domiciliarios?.totales).toEqual({
			domicilios: 2,
			sinRepartidor: 1,
			asignados: 1,
			entregados: 1,
			costoDomicilios: 8000,
			aPagar: 5000,
		});
		expect(l.domiciliarios?.filas).toEqual([
			{telefono: '3110000000', nombre: 'Pedro', asignados: 1, entregas: 1, ganancia: 5000, ticketPromedio: 60000},
		]);
		// Las mismas cifras de domicilios en el libro, el resumen (cierre, correo, pantallas de dinero) y la analítica.
		const d = l.domiciliarios!;
		expect(l.totales.domicilios).toBe(r.ventas.costoDomicilios);
		expect(d.totales.costoDomicilios).toBe(r.ventas.costoDomicilios);
		expect(d.totales.aPagar).toBe(d.filas.reduce((s, f) => s + f.ganancia, 0));
		expect(d.totales.asignados).toBe(d.filas.reduce((s, f) => s + f.asignados, 0));
		expect(d.porDia.reduce((s, x) => s + x.domicilios, 0)).toBe(d.totales.domicilios);
		expect(l.ventas.find((v) => v.id === 2)?.domicilio).toBe(0);
	});

	it('cada venta dice cómo se pagó: efectivo, QR con la cuenta, abonos a dos cuentas, mixto y pendiente', async () => {
		const l = await libro.generar({...R, filtro: 'completo'});
		const forma = Object.fromEntries(l.ventas.map((v) => [v.id, [v.forma, v.formaTexto]]));
		expect(forma).toEqual({
			1: ['efectivo', 'Efectivo'],
			2: ['qr', 'QR · Nequi'],
			3: ['qr', 'Abonos: QR $40.000 (Nequi $15.000, Bancolombia $25.000) · debe $20.000'],
			4: ['mixto', 'Mixto: efectivo $30.000 + QR $50.000 (sin cuenta asignada)'],
			5: ['pendiente', 'Pendiente (por cobrar)'],
		});
		const v1 = l.ventas[0];
		expect(v1).toEqual(
			expect.objectContaining({
				tipoPedido: 'domicilio',
				estado: 'cobrada',
				efectivo: 60000,
				qr: 0,
				domicilio: 5000,
			}),
		);
		expect(v1.productos).toBe(
			'1x Pizza - Grande (precio manual $52.000, menú $48.000), 2x Pizza - Grande, 2x Coca Cola - Personal',
		);
		expect(l.gastos.map((g) => [g.concepto, g.metodo, g.pagado])).toEqual([
			['Queso', 'Efectivo', true],
			['Arriendo', 'Efectivo', false],
			['Harina', 'QR · Nequi', true],
			['Empaques', 'QR · Bancolombia', true],
			['Luz', 'QR · sin cuenta asignada', true],
			['Gas', 'QR · Nequi', false],
		]);
	});

	it('productos por precio: la misma pizza a precio del menú y con precio manual en filas aparte', async () => {
		const r = await analitica.resumenGeneral(R.from, R.to);
		expect(
			r.productosPorPrecio.map((p) => [p.nombre, p.precio, p.manual, p.precioLista, p.unidades, p.valor]),
		).toEqual([
			['Coca Cola - Personal', 4000, false, null, 2, 8000],
			['Pizza - Grande', 48000, false, null, 2, 96000],
			['Pizza - Grande', 52000, true, 48000, 1, 52000],
		]);
	});

	it('transferencias y mixto: facturas con QR completas (efectivo de las mixtas aparte) y gastos por QR', async () => {
		const [l, r] = await Promise.all([
			libro.generar({...R, filtro: 'solo_transferencias'}),
			analitica.resumenGeneral(R.from, R.to),
		]);
		expect(l.ventas.map((v) => v.id)).toEqual([2, 3, 4]);
		expect(l.totales.qr).toBe(r.ventas.cobradoPorMetodo.transferencia);
		expect(l.totales.efectivo).toBe(30000); // la parte en efectivo de la mixta
		expect(l.gastos.map((g) => g.concepto)).toEqual(['Harina', 'Empaques', 'Luz', 'Gas']);
		expect([l.totales.gastosPagados, l.totales.gastosPendientes]).toEqual([26000, 9000]);
		expect(l.totales.saldo).toBe(120000 - 26000);
		expect(l.domiciliarios).toBeNull();
	});

	it('una cuenta: solo su parte de cada venta y sus gastos; el saldo es el de resumen.cuentas', async () => {
		const r = await analitica.resumenGeneral(R.from, R.to);
		for (const cuentaId of [1, 2]) {
			const l = await libro.generar({...R, filtro: 'cuenta_especifica', cuentaId});
			const c = r.cuentas.find((x) => x.cuentaId === cuentaId)!;
			expect([l.totales.qr, l.totales.gastosPagados, l.totales.saldo]).toEqual([c.entradas, c.salidas, c.saldo]);
		}
		const nequi = await libro.generar({...R, filtro: 'cuenta_especifica', cuentaId: 1});
		expect(nequi.cuentaNombre).toBe('Nequi');
		expect(nequi.ventas.map((v) => [v.id, v.qr])).toEqual([
			[2, 30000],
			[3, 15000],
		]);
	});

	it('PDF: secciones, formas de pago, precios manuales y cuentas; el archivo es un PDF', async () => {
		const empresaPdf = {nombre: 'Dfiru Pizzería', nit: '900'};
		const completo = await libro.generar({...R, filtro: 'completo', observaciones: 'Todo bien'});
		const texto = textoDe(docLibroDiario(completo, empresaPdf));
		for (const s of [
			'1. Resumen de dinero',
			'2. Productos vendidos',
			'3. Productos por precio',
			'4. Ventas y su forma de pago',
			'5. Gastos',
			'6. Cuentas QR',
			'7. Ajustes manuales de precio',
			'8. Domiciliarios',
			'Observaciones del cierre',
		]) {
			expect(texto).toContain(s);
		}
		expect(texto).toContain('Mixto: efectivo $30.000 + QR $50.000 (sin cuenta asignada)');
		expect(texto).toContain('$52.000 · precio manual (menú $48.000)');
		expect(texto).toContain('Total Pizzas');
		expect(texto).not.toMatch(/d[ée]bito|cr[ée]dito/i);

		const qr = textoDe(docLibroDiario(await libro.generar({...R, filtro: 'solo_transferencias'}), empresaPdf));
		expect(qr).toContain('1. Resumen de QR');
		expect(qr).toContain('Libro diario — 01/10/2026 al 31/10/2026 · Transferencias y mixto');

		const pdf = await libro.pdf({...R, filtro: 'completo'});
		expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
	});

	it('archivo: el PDF o el CSV con el nombre de la fecha (el mismo de los adjuntos del correo)', async () => {
		const dia = await libro.archivo({from: '2026-10-02', to: '2026-10-02', filtro: 'completo'}, 'pdf');
		expect(dia.nombre).toBe('libro-diario-2026-10-02.pdf');
		expect((dia.contenido as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
		const csv = await libro.archivo({...R, filtro: 'solo_transferencias'}, 'csv');
		expect(csv.nombre).toBe('libro-diario-transferencias-2026-10-01_a_2026-10-31.csv');
		expect(String(csv.contenido)).toContain('"VENTAS"');
		const cuenta = await libro.archivo({...R, filtro: 'cuenta_especifica', cuentaId: 2}, 'pdf');
		expect(cuenta.nombre).toBe('libro-diario-cuenta-bancolombia-2026-10-01_a_2026-10-31.pdf');
	});

	it('textoPdf deja solo lo que la fuente estándar puede dibujar', () => {
		expect(textoPdf('−5 ↳ a → b ñÑáé¿¡ — · 😀')).toBe('-5 > a -> b ñÑáé¿¡ — · ');
	});

	it('CSV para Excel: ventas con forma de pago, gastos y totales', async () => {
		const csv = await libro.csv({...R, filtro: 'completo'});
		expect(csv.startsWith('﻿')).toBe(true);
		expect(csv).toContain('"VENTAS"');
		expect(csv).toContain('"Mixto: efectivo $30.000 + QR $50.000 (sin cuenta asignada)"');
		expect(csv).toContain('"Cobrado",210000');
		expect(csv).toContain('"Pizza - Grande",52000,"sí",48000,1,52000');
	});

	it('enviar: un correo con los 2 PDF al dueño (REPORT_EMAIL) y a la contadora, sin repetidos', async () => {
		const res = await libro.enviar('2026-10-02', '2026-10-05', {motivo: 'cierre', observaciones: 'Sin novedad'});
		expect(res).toEqual({
			enviadoA: ['dueno@ejemplo.com', 'conta@ejemplo.com'],
			adjuntos: [
				'libro-diario-2026-10-02_a_2026-10-05.pdf',
				'libro-diario-transferencias-2026-10-02_a_2026-10-05.pdf',
			],
		});
		const [destinos, datos] = mail.enviarConAdjuntos.mock.calls[0] as unknown as [
			string[],
			{asunto: string; html: string; adjuntos: {content: Buffer}[]},
		];
		expect(destinos).toEqual(['dueno@ejemplo.com', 'conta@ejemplo.com']);
		expect(datos.asunto).toBe('Cierre de caja 02/10/2026 al 05/10/2026 - Dfiru Pizzería');
		expect(datos.html).toContain('Sin novedad');
		expect(datos.adjuntos.map((a) => a.content.subarray(0, 5).toString())).toEqual(['%PDF-', '%PDF-']);

		// La contadora con el mismo correo del dueño: una sola vez.
		variables.REPORT_EMAIL = 'conta@ejemplo.com';
		expect(await libro.destinatarios()).toEqual(['conta@ejemplo.com']);
	});

	it('enviar sin destinatarios o sin servidor de correo responde 400', async () => {
		variables.REPORT_EMAIL = '';
		empresa.getCorreoContador.mockResolvedValueOnce(null);
		await expect(libro.enviar('2026-10-02', '2026-10-02')).rejects.toBeInstanceOf(BadRequestException);
		mail.configurado.mockReturnValue(false);
		await expect(libro.enviar('2026-10-02', '2026-10-02')).rejects.toBeInstanceOf(BadRequestException);
		expect(mail.enviarConAdjuntos).not.toHaveBeenCalled();
	});

	it('rango inválido o mayor a un año', async () => {
		await expect(libro.generar({from: '2026-10-05', to: '2026-10-01'})).rejects.toBeInstanceOf(BadRequestException);
		await expect(libro.generar({from: '2025-01-01', to: '2026-10-01'})).rejects.toBeInstanceOf(BadRequestException);
		await expect(libro.generar({...R, filtro: 'cuenta_especifica'})).rejects.toBeInstanceOf(BadRequestException);
	});
});
