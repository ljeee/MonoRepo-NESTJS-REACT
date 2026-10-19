import {BOM_UTF8, celdaNumero, celdaTexto, filaCsv} from '../../common/utils/csv.util';
import type {LibroDiario} from './libro-diario.service';

/** $48.000 · -$1.500 */
export const pesos = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('es-CO')}`;

/** 2026-10-18 → 18/10/2026 */
export const fechaCorta = (dia: string) =>
	/^\d{4}-\d{2}-\d{2}$/.test(dia) ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}` : dia;

/** "18/10/2026" o "01/10/2026 al 31/10/2026". */
export const rangoTexto = (from: string, to: string) =>
	from === to ? fechaCorta(from) : `${fechaCorta(from)} al ${fechaCorta(to)}`;

export function tituloLibro(l: Pick<LibroDiario, 'from' | 'to' | 'filtro' | 'cuentaNombre'>): string {
	const filtro =
		l.filtro === 'solo_transferencias'
			? ' · Transferencias y mixto'
			: l.filtro === 'cuenta_especifica'
				? ` · Cuenta ${l.cuentaNombre ?? '—'}`
				: '';
	return `Libro diario — ${rangoTexto(l.from, l.to)}${filtro}`;
}

export function pizzasVendidas(l: Pick<LibroDiario, 'resumen'>): number {
	return (l.resumen?.productos ?? []).filter((p) => p.categoria === 'pizza').reduce((s, p) => s + p.unidades, 0);
}

/**
 * Libro diario en CSV (Excel), con lo mismo que el PDF: una fila por venta con su forma de pago, una por gasto, los
 * totales y, en el libro completo, los productos (por producto y por precio) y los domiciliarios.
 */
export function construirCsvLibroDiario(l: LibroDiario): string {
	const t = celdaTexto;
	const n = celdaNumero;
	let csv = BOM_UTF8 + filaCsv([t(tituloLibro(l))]) + '\r\n';

	csv += filaCsv([t('VENTAS')]);
	csv += filaCsv(
		[
			'Fecha',
			'Hora',
			'Factura',
			'Cliente',
			'Tipo',
			'Estado',
			'Forma de pago',
			'Efectivo',
			'QR',
			'Por cobrar',
			'Total',
			'Domicilio',
			'Productos',
		].map(t),
	);
	for (const v of l.ventas) {
		csv += filaCsv([
			t(v.dia),
			t(v.hora),
			n(v.id),
			t(v.cliente),
			t(v.tipoPedido ?? ''),
			t(v.estado),
			t(v.formaTexto),
			n(v.efectivo),
			n(v.qr),
			n(v.porCobrar),
			n(v.total),
			n(v.domicilio),
			t(v.productos),
		]);
	}
	csv += '\r\n' + filaCsv([t('GASTOS')]);
	csv += filaCsv(['Fecha', 'Concepto', 'Clase', 'Método', 'Estado', 'Valor'].map(t));
	for (const g of l.gastos)
		csv += filaCsv([
			t(g.dia),
			t(g.concepto),
			t(g.clase),
			t(g.metodo),
			t(g.pagado ? 'pagado' : 'pendiente'),
			n(g.valor),
		]);

	const tt = l.totales;
	csv += '\r\n' + filaCsv([t('TOTALES')]);
	const totales: [string, number][] = [
		['Facturado', tt.facturado],
		['Cobrado', tt.cobrado],
		['Efectivo', tt.efectivo],
		['QR / transferencia', tt.qr],
		['Por cobrar', tt.porCobrar],
		['Costo de domicilios', tt.domicilios],
		['Gastos pagados', tt.gastosPagados],
		['Gastos pendientes', tt.gastosPendientes],
		[l.saldoEtiqueta, tt.saldo],
	];
	for (const [k, v] of totales) csv += filaCsv([t(k), n(v)]);

	const r = l.resumen;
	if (l.filtro !== 'cuenta_especifica') {
		csv += '\r\n' + filaCsv([t('QR POR CUENTA')]);
		for (const c of r.ventas.porCuenta)
			csv += filaCsv([t(c.sinAsignar ? 'Sin cuenta asignada' : c.cuenta), n(c.facturas), n(c.monto)]);
	}
	if (l.filtro === 'completo') {
		csv += '\r\n' + filaCsv(['Producto', 'Categoría', 'Unidades', 'Valor vendido'].map(t));
		for (const p of r.productos) csv += filaCsv([t(p.nombre), t(p.categoria ?? ''), n(p.unidades), n(p.valor)]);
		csv += '\r\n' + filaCsv(['Producto', 'Precio', 'Precio manual', 'Precio del menú', 'Unidades', 'Valor'].map(t));
		for (const p of r.productosPorPrecio ?? []) {
			csv += filaCsv([
				t(p.nombre),
				n(p.precio),
				t(p.manual ? 'sí' : 'no'),
				p.precioLista != null ? n(p.precioLista) : t(''),
				n(p.unidades),
				n(p.valor),
			]);
		}
		const d = l.domiciliarios;
		if (d) {
			csv += '\r\n' + filaCsv(['Domiciliario', 'Teléfono', 'Domicilios', 'A pagar'].map(t));
			for (const f of d.filas) csv += filaCsv([t(f.nombre), t(f.telefono), n(f.asignados), n(f.ganancia)]);
			if (d.totales?.sinRepartidor)
				csv += filaCsv([t('Sin repartidor'), t(''), n(d.totales.sinRepartidor), n(0)]);
		}
	}
	return csv;
}
