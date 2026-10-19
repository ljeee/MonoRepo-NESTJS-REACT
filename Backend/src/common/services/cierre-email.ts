/**
 * HTML del correo de cierre. Lee el MISMO objeto que la pantalla de cierre de caja
 * (GET /estadisticas/resumen → AnaliticaService.resumenGeneral) y repite sus secciones en el mismo orden:
 *   1) Ventas del día · 2) Efectivo · 3) QR/transferencias (total y por cuenta) · 4) Productos vendidos
 *   5) Ajustes manuales de precio · 6) Gastos (costos vs gastos) · 7) Balance de caja
 * Todo texto que viene de la BD (productos, cuentas, clientes, observaciones) se ESCAPA.
 */

export type ResumenCierre = Awaited<ReturnType<import('../../estadisticas/analitica/analitica.service').AnaliticaService['resumenGeneral']>>;
export type DomiciliariosCierre = Awaited<ReturnType<import('../../estadisticas/analitica/analitica.service').AnaliticaService['domiciliarios']>>;

export interface DatosCierreEmail {
	fecha: string;
	empresa?: {nombreComercial?: string; razonSocial?: string; nit?: string} | null;
	resumen: ResumenCierre;
	/** Sección 8 (domiciliarios del día); sin ella el correo trae las 7 de siempre. */
	domiciliarios?: DomiciliariosCierre | null;
	observaciones?: string | null;
	facturas?: {facturaId: number; metodo?: string | null; total: number}[];
	companyName: string;
	nit: string;
	/** Encabezado del correo (por defecto «Cierre de Jornada»). */
	titulo?: string;
	/** Título de la sección 1 (por defecto «Ventas del día»). */
	tituloVentas?: string;
	/** Texto al final (p. ej. qué PDF van adjuntos). */
	nota?: string;
}

const NOMBRE_CATEGORIA_PRODUCTO: Record<string, string> = {
	pizza: 'Pizzas',
	calzone: 'Calzones',
	bebida: 'Bebidas',
	jugo: 'Jugos',
	adicion: 'Adiciones',
	comida: 'Comidas',
	otro: 'Otros',
};

export function esc(valor: unknown): string {
	return String(valor ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export const cop = (n: number): string => {
	const v = Math.round(Number(n) || 0);
	return `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('es-CO')}`;
};

const NOMBRE_CATEGORIA: Record<string, string> = {
	general: 'Sin categoría',
	insumos: 'Insumos y materia prima',
	mercancia: 'Bebidas y mercancía para reventa',
	empaques: 'Empaques y desechables',
	nomina: 'Nómina',
	servicios: 'Servicios',
	arriendo: 'Arriendo',
	mantenimiento: 'Mantenimiento',
	transporte: 'Transporte',
	publicidad: 'Publicidad',
	impuestos: 'Impuestos y trámites',
	otros: 'Otros gastos',
};

const NOMBRE_TIPO: Record<string, string> = {costo: 'Costos', gasto: 'Gastos operativos', sin_clasificar: 'Sin clasificar'};

const fila = (etiqueta: string, valor: string, opciones: {negrita?: boolean; sub?: boolean; color?: string} = {}) => `
	<tr${opciones.sub ? ' class="small-text"' : ''}>
		<td style="${opciones.sub ? 'padding-left: 18px; color: #94A3B8;' : ''}${opciones.negrita ? 'font-weight: 900;' : ''}">${etiqueta}</td>
		<td style="text-align: right; font-weight: ${opciones.negrita ? 900 : 700}; ${opciones.color ? `color: ${opciones.color};` : ''}">${valor}</td>
	</tr>`;

const seccion = (numero: number, titulo: string, cuerpo: string, columnas = ['Concepto', 'Valor']) => `
	<h3 class="section-title">${numero}. ${esc(titulo)}</h3>
	<table class="table" style="margin-bottom: 30px;">
		<thead><tr><th style="width: 60%;">${esc(columnas[0])}</th><th style="text-align: right;">${esc(columnas[1])}</th></tr></thead>
		<tbody>${cuerpo}</tbody>
	</table>`;

/**
 * Secciones 1–7, en el orden de la pantalla de cierre de caja. El libro diario las usa como "consolidado"
 * del período (`tituloVentas: 'Ventas del período'`).
 */
export function construirSeccionesCierre(r: ResumenCierre, opciones: {tituloVentas?: string} = {}): string[] {
	const {ventas, gastos, resultado} = r;
	const efectivo = ventas.cobradoPorMetodo.efectivo;
	const transferencia = ventas.cobradoPorMetodo.transferencia;
	const facturasDe = (clave: string) => ventas.porMetodo.find((m) => m.clave === clave)?.facturas ?? 0;

	// Unidades y valor por categoría (cuántas pizzas salieron): sale de productos.categoria.
	const porCategoria = new Map<string, {unidades: number; valor: number}>();
	for (const p of r.productos) {
		const c = p.categoria || 'otro';
		const acc = porCategoria.get(c) ?? {unidades: 0, valor: 0};
		acc.unidades += p.unidades;
		acc.valor += p.valor;
		porCategoria.set(c, acc);
	}
	const filasCategoria = [...porCategoria.entries()]
		.sort((a, b) => b[1].unidades - a[1].unidades)
		.map(([c, v]) => fila(`${esc(NOMBRE_CATEGORIA_PRODUCTO[c] ?? c)}: ${v.unidades} unidades`, cop(v.valor), {sub: true}));

	const s1 = seccion(
		1,
		opciones.tituloVentas ?? 'Ventas del día',
		[
			fila('Facturado', cop(ventas.facturado), {negrita: true}),
			fila('Cobrado', cop(ventas.cobrado), {color: '#10B981'}),
			fila('Por cobrar', cop(ventas.porCobrar), {color: '#F5A524'}),
			fila(`Facturas válidas`, String(ventas.facturas), {sub: true}),
			fila('Órdenes (sin canceladas)', String(ventas.ordenes), {sub: true}),
			fila('Órdenes canceladas', String(ventas.canceladas), {sub: true}),
			fila('Ticket promedio', cop(ventas.ticket), {sub: true}),
		].join(''),
	);

	const s2 = seccion(
		2,
		'Efectivo',
		[
			fila('Vendido en efectivo (incluye la parte efectivo de pagos mixtos y abonos)', cop(efectivo), {negrita: true}),
			fila(`Facturas con efectivo`, String(facturasDe('efectivo') + facturasDe('mixto')), {sub: true}),
		].join(''),
	);

	const s3 = seccion(
		3,
		'QR / Transferencias',
		[
			fila('Total por QR / transferencia', cop(transferencia), {negrita: true}),
			...ventas.porCuenta.map((c) =>
				fila(`↳ ${esc(c.cuenta)}${c.sinAsignar ? ' (sin cuenta asignada)' : ''} — ${c.facturas} fact.`, cop(c.monto), {sub: true}),
			),
			// Lo que salió por QR (egresos pagados) y el saldo de cada cuenta: entró − salió.
			...(r.cuentas?.some((c) => c.salidas > 0)
				? [
						fila('Pagado por QR (egresos)', cop(r.cuentas.reduce((t, c) => t + c.salidas, 0)), {negrita: true, color: '#EF4444'}),
						...r.cuentas.map((c) =>
							c.sinAsignar
								? // No es una cuenta en negativo: cobros y egresos por QR a los que no se les dijo la cuenta.
									fila(
										`↳ Sin cuenta asignada: entró ${cop(c.entradas)} (cobros QR) · salió ${cop(c.salidas)} (egresos QR)`,
										'Por asignar',
										{sub: true},
									)
								: fila(`↳ ${esc(c.cuenta)}: entró ${cop(c.entradas)} · salió ${cop(c.salidas)}`, `Saldo ${cop(c.saldo)}`, {sub: true}),
						),
					]
				: []),
		].join(''),
	);

	const s4 = seccion(
		4,
		'Productos vendidos',
		ventas && r.productos.length
			? r.productos.map((p) => fila(`${esc(p.nombre)} <span style="color:#94A3B8">× ${Number(p.unidades)}</span>`, cop(p.valor))).join('') +
					filasCategoria.join('') +
					fila(
						`TOTAL (${r.productos.reduce((t, p) => t + p.unidades, 0)} unidades)`,
						cop(r.productos.reduce((t, p) => t + p.valor, 0)),
						{negrita: true},
					) +
					// Por precio: cuántas salieron a cada precio, con los cambiados a mano aparte.
					((r.productosPorPrecio ?? []).length
						? fila('Por precio', '', {negrita: true}) +
							(r.productosPorPrecio ?? [])
								.map((p) =>
									fila(
										`${esc(p.nombre)} · ${cop(p.precio)}${p.manual ? ` <span style="color:#F5A524">(precio manual${p.precioLista != null ? `, menú ${cop(p.precioLista)}` : ''})</span>` : ''} × ${Number(p.unidades)}`,
										cop(p.valor),
										{sub: true},
									),
								)
								.join('')
						: '')
			: '<tr><td colspan="2" style="text-align:center; opacity:0.5;">Sin productos vendidos</td></tr>',
		['Producto y cantidad', 'Valor'],
	);

	const a = r.ajustesPrecio;
	const conAjuste = r.productos.filter((p) => p.lineasManuales > 0);
	const s5 = seccion(
		5,
		'Ajustes manuales de precio',
		[
			fila('Aumentos sobre el precio de lista', cop(a.aumentos), {color: '#10B981'}),
			fila('Bajas / descuentos', cop(a.bajas), {color: '#EF4444'}),
			fila('Ajuste neto', cop(a.neto), {negrita: true}),
			fila('Líneas con precio manual', String(a.lineasManuales), {sub: true}),
			...(a.sinPrecioLista > 0 ? [fila('Líneas manuales sin precio de lista (no calculable)', String(a.sinPrecioLista), {sub: true})] : []),
			...conAjuste.map((p) => fila(`↳ ${esc(p.nombre)} (${p.lineasManuales} línea${p.lineasManuales === 1 ? '' : 's'})`, cop(p.ajuste), {sub: true})),
		].join(''),
	);

	const tipo = (t: string) => gastos.porTipo.find((x) => x.tipo === t);
	const s6 = seccion(
		6,
		'Gastos',
		[
			fila('Pagados', cop(gastos.pagados), {negrita: true, color: '#EF4444'}),
			fila('Pendientes de pago', cop(gastos.pendientes), {sub: true}),
			...['costo', 'gasto', 'sin_clasificar']
				.filter((t) => (tipo(t)?.total ?? 0) > 0)
				.flatMap((t) => [
					fila(`${NOMBRE_TIPO[t]} (pagados)`, cop(tipo(t)?.pagados ?? 0), {sub: true}),
					...gastos.porCategoria
						.filter((c) => c.tipo === t)
						.map((c) => fila(`&nbsp;&nbsp;· ${esc(NOMBRE_CATEGORIA[c.categoria] ?? c.categoria)} (${c.cantidad})`, cop(c.total), {sub: true})),
				]),
		].join(''),
	);

	const s7 = seccion(
		7,
		'Balance de caja',
		[
			fila('Cobrado', cop(ventas.cobrado)),
			fila('− Gastos pagados', cop(gastos.pagados)),
			fila('BALANCE DE CAJA (cobrado − gastos pagados)', cop(r.balance.cobrado), {negrita: true, color: '#F5A524'}),
			fila('Utilidad bruta (cobrado − costos pagados)', cop(resultado.utilidadBruta), {sub: true}),
			fila('Resultado devengado (facturado − todos los gastos)', cop(r.balance.devengado), {sub: true}),
		].join(''),
	);

	return [s1, s2, s3, s4, s5, s6, s7];
}

/** Sección de domiciliarios: cuántos domicilios salieron, cuántos llevó cada repartidor y cuánto se les paga. */
export function construirSeccionDomiciliarios(numero: number, d: DomiciliariosCierre): string {
	const t = d.totales;
	const aPagar = d.filas.reduce((s, f) => s + f.ganancia, 0);
	const cuerpo = [
		fila('Domicilios', String(t?.domicilios ?? d.filas.reduce((s, f) => s + f.asignados, 0)), {negrita: true}),
		...(t?.sinRepartidor ? [fila('Sin repartidor asignado', String(t.sinRepartidor), {sub: true, color: '#F5A524'})] : []),
		...d.filas.map((f) =>
			fila(`↳ ${esc(f.nombre)} — ${f.asignados} domicilio${f.asignados === 1 ? '' : 's'}`, cop(f.ganancia), {sub: true}),
		),
		fila('A pagar a domiciliarios (costo de domicilio de lo asignado)', cop(aPagar), {negrita: true, color: '#F5A524'}),
	].join('');
	return seccion(numero, 'Domiciliarios', d.filas.length || t?.domicilios ? cuerpo : '<tr><td colspan="2" style="text-align:center; opacity:0.5;">Sin domicilios</td></tr>');
}

export function construirHtmlCierre(d: DatosCierreEmail): string {
	const detalle = (d.facturas ?? [])
		.map(
			(f) => `
		<tr class="small-text"><td>${esc(f.facturaId)}</td><td>${esc(f.metodo ? String(f.metodo).replace(/_/g, ' ').toUpperCase() : 'SIN MÉTODO')}</td><td style="text-align:right;">${cop(f.total)}</td></tr>`,
		)
		.join('');

	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8" />
	<style>
		body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0F172A; color: #F8FAFC; margin: 0; padding: 20px; }
		.container { max-width: 640px; margin: 0 auto; background-color: #1E293B; border-radius: 20px; border: 1px solid #334155; overflow: hidden; }
		.header { background-color: #F5A524; padding: 32px 20px; text-align: center; }
		.header h1 { margin: 0; color: #0F172A; font-size: 24px; font-weight: 900; text-transform: uppercase; }
		.header p { margin: 5px 0 0; color: #0F172A; opacity: 0.8; font-weight: 600; font-size: 12px; }
		.content { padding: 30px 20px; }
		.section-title { font-size: 13px; font-weight: 900; margin: 0 0 12px; color: #F5A524; letter-spacing: 1px; text-transform: uppercase; }
		.table { width: 100%; border-collapse: collapse; table-layout: fixed; }
		.table th { text-align: left; font-size: 10px; color: #CBD5E1; text-transform: uppercase; padding: 8px 5px; border-bottom: 1px solid #475569; }
		.table td { padding: 9px 5px; font-size: 12px; color: #FFFFFF; border-bottom: 1px solid rgba(255,255,255,0.05); word-break: break-word; }
		.table .small-text td { font-size: 11px; }
		.footer { padding: 24px; text-align: center; background-color: rgba(0,0,0,0.2); }
		.footer p { margin: 0; font-size: 10px; color: #94A3B8; font-weight: bold; letter-spacing: 1px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>${esc(d.titulo ?? 'Cierre de Jornada')}</h1>
			<p>${esc(d.companyName)} | NIT: ${esc(d.nit)} | FECHA: ${esc(d.fecha)}</p>
		</div>
		<div class="content">
			${construirSeccionesCierre(d.resumen, {tituloVentas: d.tituloVentas}).join('\n')}
			${d.domiciliarios ? construirSeccionDomiciliarios(8, d.domiciliarios) : ''}
			${d.observaciones ? `<h3 class="section-title">Observaciones</h3><p style="font-size:12px;">${esc(d.observaciones)}</p>` : ''}
			${
				detalle
					? `<h3 class="section-title">Detalle de transacciones cobradas</h3>
			<table class="table"><thead><tr><th style="width:25%;">ID</th><th style="width:45%;">Medio de pago</th><th style="text-align:right;">Valor</th></tr></thead><tbody>${detalle}</tbody></table>`
					: ''
			}
			${d.nota ? `<p style="font-size:12px; color:#CBD5E1; margin-top:24px;">${esc(d.nota)}</p>` : ''}
		</div>
		<div class="footer"><p>Dfiruexpo POS — Sistema de Gestión Inteligente</p></div>
	</div>
</body>
</html>`;
}
