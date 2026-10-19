import {construirHtmlCierre, construirSeccionesCierre, esc} from '../../../src/common/services/cierre-email';
import {CierresCronService} from '../../../src/cierres/cierres.cron';

const resumen: any = {
	ventas: {
		facturado: 500000,
		cobrado: 420000,
		porCobrar: 80000,
		facturas: 12,
		ticket: 41667,
		ordenes: 12,
		canceladas: 2,
		cobradoPorMetodo: {efectivo: 300000, transferencia: 120000},
		porMetodo: [
			{clave: 'efectivo', facturas: 6, facturado: 0},
			{clave: 'mixto', facturas: 1, facturado: 0},
		],
		porCuenta: [
			{cuentaId: 1, cuenta: 'Nequi <b>Jef</b>', sinAsignar: false, facturas: 3, monto: 90000},
			{cuentaId: null, cuenta: 'Sin asignar', sinAsignar: true, facturas: 1, monto: 30000},
		],
	},
	productos: [
		{nombre: 'Pizza - Grande <script>x</script>', unidades: 10, valor: 450000, lineasManuales: 2, ajuste: -5000},
		{nombre: 'Gaseosa', unidades: 5, valor: 20000, lineasManuales: 0, ajuste: 0},
	],
	ajustesPrecio: {aumentos: 3000, bajas: -8000, neto: -5000, lineasManuales: 2, sinPrecioLista: 1},
	gastos: {
		pagados: 150000,
		pendientes: 20000,
		porTipo: [
			{tipo: 'costo', cantidad: 1, total: 100000, pagados: 100000},
			{tipo: 'gasto', cantidad: 1, total: 70000, pagados: 50000},
			{tipo: 'sin_clasificar', cantidad: 0, total: 0, pagados: 0},
		],
		porCategoria: [
			{categoria: 'insumos', tipo: 'costo', cantidad: 1, total: 100000, pagados: 100000},
			{categoria: 'nomina', tipo: 'gasto', cantidad: 1, total: 70000, pagados: 50000},
		],
	},
	balance: {cobrado: 270000, devengado: 330000},
	resultado: {utilidadBruta: 320000},
};

describe('correo de cierre', () => {
	const html = construirHtmlCierre({fecha: '2026-06-01', resumen, companyName: 'Dfiru <x>', nit: '123', observaciones: 'ok & listo', facturas: [{facturaId: 1, metodo: 'efectivo_transferencia', total: 1000}]});

	it('tiene las 7 secciones, en el orden de la pantalla', () => {
		const titulos = ['1. Ventas del día', '2. Efectivo', '3. QR / Transferencias', '4. Productos vendidos', '5. Ajustes manuales de precio', '6. Gastos', '7. Balance de caja'];
		const posiciones = titulos.map((t) => html.indexOf(t));
		expect(posiciones.every((p) => p >= 0)).toBe(true);
		expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
		expect(construirSeccionesCierre(resumen)).toHaveLength(7);
	});

	it('trae los montos del resumen', () => {
		for (const monto of ['$500.000', '$420.000', '$80.000', '$300.000', '$120.000', '$90.000', '$30.000', '$450.000', '$150.000', '$270.000', '$330.000', '-$8.000', '$3.000']) {
			expect(html).toContain(monto);
		}
		expect(html).toContain('× 10');
		expect(html).toContain('BALANCE DE CAJA (cobrado − gastos pagados)');
		expect(html).toContain('Líneas manuales sin precio de lista');
	});

	it('con egresos por QR muestra lo que salió y el saldo de cada cuenta', () => {
		const conSalidas = {
			...resumen,
			cuentas: [
				{cuentaId: 1, cuenta: 'Nequi <b>Jef</b>', sinAsignar: false, entradas: 90000, salidas: 120000, saldo: -30000},
				{cuentaId: null, cuenta: 'Sin asignar', sinAsignar: true, entradas: 30000, salidas: 0, saldo: 30000},
			],
		};
		const seccion3 = construirSeccionesCierre(conSalidas)[2];
		expect(seccion3).toContain('Pagado por QR (egresos)');
		expect(seccion3).toContain('entró $90.000 · salió $120.000');
		expect(seccion3).toContain('Saldo -$30.000');
		expect(seccion3).not.toContain('<b>Jef</b>');
		// Sin salidas por QR (o sin el dato) no se agrega el bloque.
		expect(construirSeccionesCierre(resumen)[2]).not.toContain('Pagado por QR');
	});

	it('escapa lo que viene de la base de datos', () => {
		expect(html).not.toContain('<script>');
		expect(html).not.toContain('<b>Jef</b>');
		expect(html).toContain('&lt;script&gt;');
		expect(html).toContain('Dfiru &lt;x&gt;');
		expect(esc(`"a" & 'b'`)).toBe('&quot;a&quot; &amp; &#39;b&#39;');
	});
});

describe('cierre automático', () => {
	it('al arrancar y a las 00:05 cierra AYER (hora Bogotá) y envía el correo', async () => {
		const generalCierre = jest.fn().mockResolvedValue({});
		const cron = new CierresCronService({generalCierre} as any);

		await cron.handleDailyClose();

		expect(generalCierre).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), expect.any(String), expect.any(String), false, true);
	});

	it('si el día ya estaba cerrado lo omite sin error', async () => {
		const cron = new CierresCronService({generalCierre: jest.fn().mockRejectedValue(new Error('Ya existe un cierre para la fecha'))} as any);
		await expect(cron.handleDailyClose()).resolves.toBeUndefined();
	});

	it('solo hay UN cron de cierre (el de 00:05 con zona Bogotá)', () => {
		const meta = Reflect.getMetadataKeys(CierresCronService.prototype.handleDailyClose);
		expect(meta.length).toBeGreaterThan(0);
		const src = require('fs').readFileSync(require('path').join(__dirname, '../../../src/cierres/cierres.service.ts'), 'utf8');
		expect(src).not.toMatch(/@Cron\(/);
	});
});
