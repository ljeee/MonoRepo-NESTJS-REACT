import type {Content, CustomTableLayout, TableCell, TDocumentDefinitions} from 'pdfmake/interfaces';
import {textoPdf as T} from '../../common/pdf/pdf.util';
import {fechaCorta, pesos, pizzasVendidas, tituloLibro} from './libro-diario.formato';
import type {EmpresaLibro, GastoLibro, LibroDiario, VentaLibro} from './libro-diario.service';

const GRIS = '#6b7280';
const FONDO_ENCABEZADO = '#eeeeee';
const FONDO_TOTAL = '#f5f5f5';
const NOMBRE_CATEGORIA: Record<string, string> = {
	pizza: 'Pizzas',
	calzone: 'Calzones',
	bebida: 'Bebidas',
	jugo: 'Jugos',
	adicion: 'Adiciones',
	comida: 'Comidas',
	otro: 'Otros',
};
const NOMBRE_TIPO_PEDIDO: Record<string, string> = {mesa: 'Mesa', llevar: 'Para llevar', domicilio: 'Domicilio'};

type Fila = {etiqueta: string; valor: string; negrita?: boolean; nivel?: 0 | 1 | 2};

const LINEAS_FINAS: CustomTableLayout = {
	hLineWidth: (i: number) => (i === 0 ? 0 : 0.5),
	vLineWidth: () => 0,
	hLineColor: () => '#d1d5db',
	paddingTop: () => 2,
	paddingBottom: () => 2,
};

const celda = (texto: unknown, extra: Record<string, unknown> = {}): TableCell =>
	({text: T(texto), ...extra}) as TableCell;
const dinero = (n: number, extra: Record<string, unknown> = {}): TableCell =>
	celda(pesos(n), {alignment: 'right', ...extra});
const entero = (n: number, extra: Record<string, unknown> = {}): TableCell =>
	celda(Math.round(n).toLocaleString('es-CO'), {alignment: 'right', ...extra});

function seccion(titulo: string, nota?: string): Content[] {
	return [{text: T(titulo), style: 'seccion'}, ...(nota ? [{text: T(nota), style: 'nota'} as Content] : [])];
}

function tabla(
	encabezados: string[],
	anchos: (string | number)[],
	filas: TableCell[][],
	vacio = 'Sin datos en el período',
): Content {
	const derecha = (i: number) =>
		encabezados[i].startsWith('$') || /^(Unidades|Asignados|Entregados)$/.test(encabezados[i]);
	const cuerpo: TableCell[][] = [
		encabezados.map((h, i) =>
			celda(h.replace(/^\$/, ''), {
				bold: true,
				fillColor: FONDO_ENCABEZADO,
				fontSize: 7.5,
				alignment: derecha(i) ? 'right' : 'left',
			}),
		),
		...(filas.length
			? filas
			: [
					[
						celda(vacio, {colSpan: encabezados.length, color: GRIS, alignment: 'center'}),
						...encabezados.slice(1).map(() => celda('')),
					],
				]),
	];
	return {
		table: {headerRows: 1, dontBreakRows: true, widths: anchos, body: cuerpo},
		layout: 'lightHorizontalLines',
		margin: [0, 2, 0, 4],
	};
}

/** Tabla de dos columnas (concepto · valor) para los resúmenes. */
function resumen(filas: Fila[]): Content {
	return {
		table: {
			widths: ['*', 120],
			body: filas.map((f) => [
				celda(f.etiqueta, {
					bold: !!f.negrita,
					margin: [(f.nivel ?? 0) * 12, 0, 0, 0],
					color: f.nivel === 2 ? GRIS : undefined,
				}),
				celda(f.valor, {bold: !!f.negrita, alignment: 'right'}),
			]),
		},
		// Sin encabezado: líneas finas parejas (lightHorizontalLines engruesa la línea bajo la primera fila).
		layout: LINEAS_FINAS,
		margin: [0, 2, 0, 4],
	};
}

const filaTotal = (celdas: TableCell[]): TableCell[] =>
	celdas.map((c) => ({...(c as object), bold: true, fillColor: FONDO_TOTAL}) as TableCell);

function conteoFormas(ventas: VentaLibro[]): string {
	const cuenta = (pred: (v: VentaLibro) => boolean) => ventas.filter(pred).length;
	return [
		`Efectivo ${cuenta((v) => v.estado === 'cobrada' && v.forma === 'efectivo')}`,
		`QR ${cuenta((v) => v.estado === 'cobrada' && v.forma === 'qr')}`,
		`Mixto ${cuenta((v) => v.estado === 'cobrada' && v.forma === 'mixto')}`,
		`Abonos ${cuenta((v) => v.estado === 'parcial')}`,
		`Pendientes ${cuenta((v) => v.estado === 'pendiente')}`,
	].join(' · ');
}

function tablaVentas(l: LibroDiario): Content {
	const unDia = l.from === l.to;
	const filas = l.ventas.map((v) => [
		celda(unDia ? v.hora : `${fechaCorta(v.dia).slice(0, 5)} ${v.hora}`),
		celda(`#${v.id}`),
		{
			stack: [
				celda(v.cliente),
				celda(NOMBRE_TIPO_PEDIDO[v.tipoPedido ?? ''] ?? v.tipoPedido ?? '', {fontSize: 6.5, color: GRIS}),
			],
		} as TableCell,
		celda(v.productos || '—', {fontSize: 6.5}),
		celda(v.formaTexto, {bold: v.forma === 'mixto' || v.estado !== 'cobrada'}),
		dinero(v.efectivo),
		dinero(v.qr),
		dinero(v.porCobrar),
		dinero(v.total),
	]);
	const t = l.totales;
	const totales = l.ventas.length
		? [
				filaTotal([
					celda(''),
					celda(''),
					celda(`TOTAL · ${l.ventas.length} ventas`),
					celda(''),
					celda(''),
					dinero(t.efectivo),
					dinero(t.qr),
					dinero(t.porCobrar),
					dinero(t.facturado),
				]),
			]
		: [];
	return tabla(
		[
			'Hora',
			'Factura',
			'Cliente',
			'Productos',
			'Forma de pago',
			'$Efectivo',
			l.filtro === 'cuenta_especifica' ? '$QR a la cuenta' : '$QR',
			'$Por cobrar',
			'$Total',
		],
		[unDia ? 28 : 46, 34, 74, '*', 128, 52, 52, 50, 54],
		[...filas, ...totales],
		'Sin ventas en el período',
	);
}

function tablaGastos(gastos: GastoLibro[], t: LibroDiario['totales']): Content {
	const filas = gastos.map((g) => [
		celda(fechaCorta(g.dia)),
		celda(g.concepto),
		celda(g.clase),
		celda(g.metodo),
		celda(g.pagado ? 'Pagado' : 'Pendiente', {color: g.pagado ? undefined : '#b45309'}),
		dinero(g.valor),
	]);
	const totales = gastos.length
		? [
				filaTotal([celda(''), celda('Total pagado'), celda(''), celda(''), celda(''), dinero(t.gastosPagados)]),
				filaTotal([
					celda(''),
					celda('Pendiente de pago (no resta del balance)'),
					celda(''),
					celda(''),
					celda(''),
					dinero(t.gastosPendientes),
				]),
			]
		: [];
	return tabla(
		['Fecha', 'Concepto', 'Clase', 'Método', 'Estado', '$Valor'],
		[52, '*', 150, 120, 52, 60],
		[...filas, ...totales],
		'Sin gastos en el período',
	);
}

function tablaCuentas(l: LibroDiario): Content {
	const filas = l.resumen.cuentas.map((c) => [
		celda(c.sinAsignar ? 'Sin cuenta asignada (por asignar)' : c.cuenta, {color: c.sinAsignar ? GRIS : undefined}),
		dinero(c.entradas),
		dinero(c.salidas),
		c.sinAsignar ? celda('por asignar', {alignment: 'right', color: GRIS}) : dinero(c.saldo, {bold: true}),
	]);
	return tabla(
		['Cuenta', '$Entró (cobros QR)', '$Salió (gastos QR pagados)', '$Saldo'],
		['*', 110, 130, 90],
		filas,
		'Sin movimientos por QR',
	);
}

function seccionesCompleto(l: LibroDiario): Content[] {
	const r = l.resumen;
	const t = l.totales;
	const sinMetodo = t.cobrado - t.efectivo - t.qr;
	const gastosQr = l.gastos.filter((g) => g.pagado && g.metodo.startsWith('QR')).reduce((s, g) => s + g.valor, 0);

	const porCategoria = new Map<string, {unidades: number; valor: number}>();
	for (const p of r.productos) {
		const c = p.categoria || 'otro';
		const acc = porCategoria.get(c) ?? {unidades: 0, valor: 0};
		acc.unidades += p.unidades;
		acc.valor += p.valor;
		porCategoria.set(c, acc);
	}
	const productos = r.productos.map((p) => [
		celda(p.nombre),
		celda(NOMBRE_CATEGORIA[p.categoria ?? ''] ?? p.categoria ?? '—'),
		entero(p.unidades),
		dinero(p.valor),
	]);
	const subtotales = [...porCategoria.entries()]
		.sort((a, b) => b[1].unidades - a[1].unidades)
		.map(([c, v]) =>
			filaTotal([celda(`Total ${NOMBRE_CATEGORIA[c] ?? c}`), celda(''), entero(v.unidades), dinero(v.valor)]),
		);
	const totalProductos = r.productos.length
		? [
				filaTotal([
					celda('TOTAL PRODUCTOS'),
					celda(''),
					entero(r.productos.reduce((s, p) => s + p.unidades, 0)),
					dinero(r.productos.reduce((s, p) => s + p.valor, 0)),
				]),
			]
		: [];

	const porPrecio = (r.productosPorPrecio ?? []).map((p) => [
		celda(p.nombre),
		celda(
			`${pesos(p.precio)}${p.manual ? ` · precio manual${p.precioLista != null ? ` (menú ${pesos(p.precioLista)})` : ''}` : ''}`,
			{
				bold: p.manual,
				color: p.manual ? '#b45309' : undefined,
			},
		),
		entero(p.unidades),
		dinero(p.valor),
	]);

	const a = r.ajustesPrecio;
	const d = l.domiciliarios;
	const aPagar = d ? d.filas.reduce((s, f) => s + f.ganancia, 0) : 0;

	return [
		...seccion(
			'1. Resumen de dinero',
			'Mismas cifras del cierre de caja: ventas válidas del período (también las por cobrar).',
		),
		resumen([
			{etiqueta: `Facturado (${l.ventas.length} ventas)`, valor: pesos(t.facturado)},
			{etiqueta: 'Cobrado', valor: pesos(t.cobrado), negrita: true},
			{etiqueta: 'Efectivo', valor: pesos(t.efectivo), nivel: 1},
			{etiqueta: 'QR / transferencia', valor: pesos(t.qr), nivel: 1},
			...r.ventas.porCuenta.map((c) => ({
				etiqueta: `${c.sinAsignar ? 'Sin cuenta asignada' : c.cuenta} (${c.facturas} facturas)`,
				valor: pesos(c.monto),
				nivel: 2 as const,
			})),
			...(sinMetodo > 0.5
				? [{etiqueta: 'Cobrado sin método registrado', valor: pesos(sinMetodo), nivel: 1 as const}]
				: []),
			{etiqueta: `Formas de pago: ${conteoFormas(l.ventas)}`, valor: ''},
			{etiqueta: 'Por cobrar', valor: pesos(t.porCobrar)},
			{etiqueta: 'Costo de domicilios (incluido en lo facturado)', valor: pesos(t.domicilios)},
			{etiqueta: 'Gastos pagados', valor: pesos(t.gastosPagados)},
			{etiqueta: 'En efectivo', valor: pesos(t.gastosPagados - gastosQr), nivel: 1},
			{etiqueta: 'Por QR', valor: pesos(gastosQr), nivel: 1},
			{etiqueta: 'Gastos pendientes de pago (no restan)', valor: pesos(t.gastosPendientes)},
			{etiqueta: l.saldoEtiqueta.toUpperCase(), valor: pesos(t.saldo), negrita: true},
		]),
		...seccion(
			'2. Productos vendidos',
			`${pizzasVendidas(l)} pizzas en el período. Valor al precio que se cobró (con los precios cambiados a mano).`,
		),
		tabla(
			['Producto', 'Categoría', 'Unidades', '$Valor'],
			['*', 90, 60, 80],
			[...productos, ...subtotales, ...totalProductos],
			'Sin productos vendidos',
		),
		...seccion(
			'3. Productos por precio',
			'Cuántas salieron a cada precio. En naranja, los precios cambiados a mano (con el precio del menú).',
		),
		tabla(
			['Producto', 'Precio unitario', 'Unidades', '$Valor'],
			['*', 200, 60, 80],
			porPrecio,
			'Sin productos vendidos',
		),
		...seccion('4. Ventas y su forma de pago'),
		tablaVentas(l),
		...seccion('5. Gastos'),
		tablaGastos(l.gastos, t),
		...seccion(
			'6. Cuentas QR',
			'Lo que entró por QR a cada cuenta, lo que salió por gastos pagados por QR y el saldo.',
		),
		tablaCuentas(l),
		...seccion('7. Ajustes manuales de precio'),
		resumen([
			{etiqueta: 'Aumentos sobre el precio del menú', valor: pesos(a.aumentos)},
			{etiqueta: 'Bajas / descuentos', valor: pesos(a.bajas)},
			{etiqueta: 'Ajuste neto', valor: pesos(a.neto), negrita: true},
			{etiqueta: 'Líneas con precio manual', valor: String(a.lineasManuales)},
			...(a.sinPrecioLista
				? [
						{
							etiqueta: 'Manuales sin precio del menú guardado (ajuste no calculable)',
							valor: String(a.sinPrecioLista),
						},
					]
				: []),
		]),
		...seccion(
			'8. Domiciliarios',
			'Cada domicilio cuenta para su repartidor desde que se le asigna; se le paga el costo de domicilio.',
		),
		d
			? tabla(
					['Domiciliario', 'Domicilios', '$A pagar'],
					['*', 70, 90],
					[
						...d.filas.map((f) => [
							celda(`${f.nombre} · ${f.telefono}`),
							entero(f.asignados),
							dinero(f.ganancia),
						]),
						...(d.totales?.sinRepartidor
							? [
									[
										celda('Sin repartidor asignado', {color: GRIS}),
										entero(d.totales.sinRepartidor),
										dinero(0),
									],
								]
							: []),
						...(d.filas.length || d.totales?.domicilios
							? [
									filaTotal([
										celda('TOTAL'),
										entero(d.totales?.domicilios ?? d.filas.reduce((s, f) => s + f.asignados, 0)),
										dinero(aPagar),
									]),
								]
							: []),
					],
					'Sin domicilios en el período',
				)
			: {text: ''},
		...(l.observaciones ? [...seccion('Observaciones del cierre'), {text: T(l.observaciones)} as Content] : []),
	];
}

function seccionesTransferencias(l: LibroDiario): Content[] {
	const t = l.totales;
	const cuenta = (pred: (v: VentaLibro) => boolean) => l.ventas.filter(pred).length;
	if (l.filtro === 'cuenta_especifica') {
		return [
			...seccion(`1. Resumen de la cuenta ${l.cuentaNombre ?? ''}`.trim()),
			resumen([
				{etiqueta: `Entró por QR a la cuenta (${l.ventas.length} facturas)`, valor: pesos(t.qr), negrita: true},
				{etiqueta: 'Salió por gastos pagados desde la cuenta', valor: pesos(t.gastosPagados)},
				{etiqueta: 'Gastos pendientes desde la cuenta (no restan)', valor: pesos(t.gastosPendientes)},
				{etiqueta: l.saldoEtiqueta.toUpperCase(), valor: pesos(t.saldo), negrita: true},
			]),
			...seccion(
				'2. Ventas con QR a la cuenta',
				'La columna QR es solo lo que entró a esta cuenta; la forma de pago muestra el pago completo.',
			),
			tablaVentas(l),
			...seccion('3. Gastos pagados desde la cuenta'),
			tablaGastos(l.gastos, t),
		];
	}
	return [
		...seccion(
			'1. Resumen de QR',
			'Facturas pagadas total o parcialmente por QR (transferencia, mixtas y abonos), completas.',
		),
		resumen([
			{
				etiqueta: `Cobrado por QR / transferencia (${l.ventas.length} facturas)`,
				valor: pesos(t.qr),
				negrita: true,
			},
			...l.resumen.ventas.porCuenta.map((c) => ({
				etiqueta: `${c.sinAsignar ? 'Sin cuenta asignada' : c.cuenta} (${c.facturas} facturas)`,
				valor: pesos(c.monto),
				nivel: 1 as const,
			})),
			{
				etiqueta: 'Efectivo de estas facturas (parte en efectivo de las mixtas y abonos)',
				valor: pesos(t.efectivo),
			},
			{
				etiqueta: `Facturas: QR ${cuenta((v) => v.estado === 'cobrada' && v.forma === 'qr')} · Mixtas ${cuenta((v) => v.estado === 'cobrada' && v.forma === 'mixto')} · Con abonos ${cuenta((v) => v.estado === 'parcial')}`,
				valor: '',
			},
			{etiqueta: 'Por cobrar de estas facturas', valor: pesos(t.porCobrar)},
			{etiqueta: 'Gastos pagados por QR', valor: pesos(t.gastosPagados)},
			{etiqueta: 'Gastos por QR pendientes de pago (no restan)', valor: pesos(t.gastosPendientes)},
			{etiqueta: l.saldoEtiqueta.toUpperCase(), valor: pesos(t.saldo), negrita: true},
		]),
		...seccion('2. Ventas con QR y mixtas'),
		tablaVentas(l),
		...seccion('3. Gastos pagados por QR'),
		tablaGastos(l.gastos, t),
		...seccion('4. Saldo por cuenta'),
		tablaCuentas(l),
	];
}

/**
 * Definición del PDF del libro diario (pdfmake): A4 horizontal, encabezado con el negocio y pie con página. Función
 * pura (sin E/S): `renderizarPdf` la convierte en el archivo. Completo, transferencias y mixto, o una cuenta.
 */
export function docLibroDiario(l: LibroDiario, empresa: EmpresaLibro): TDocumentDefinitions {
	const titulo = tituloLibro(l);
	const generado = new Date().toLocaleString('es-CO', {timeZone: 'America/Bogota'});
	const subtitulo =
		l.filtro === 'completo'
			? `${l.ventas.length} ventas · ${pizzasVendidas(l)} pizzas · cobrado ${pesos(l.totales.cobrado)} (efectivo ${pesos(l.totales.efectivo)} · QR ${pesos(l.totales.qr)})`
			: `${l.ventas.length} facturas con QR · QR ${pesos(l.totales.qr)}`;
	return {
		pageSize: 'A4',
		pageOrientation: 'landscape',
		pageMargins: [28, 28, 28, 34],
		info: {title: T(titulo), author: T(empresa.nombre)},
		defaultStyle: {font: 'Helvetica', fontSize: 8},
		styles: {
			titulo: {fontSize: 14, bold: true},
			subtitulo: {fontSize: 8, color: GRIS, margin: [0, 2, 0, 0]},
			seccion: {fontSize: 11, bold: true, margin: [0, 12, 0, 2]},
			nota: {fontSize: 7, color: GRIS, margin: [0, 0, 0, 2]},
		},
		footer: (pagina: number, total: number) => ({
			text: T(`${titulo} · Página ${pagina} de ${total}`),
			alignment: 'right',
			fontSize: 7,
			color: GRIS,
			margin: [28, 10, 28, 0],
		}),
		content: [
			{
				columns: [
					{
						stack: [
							{text: T(titulo), style: 'titulo'},
							{text: T(subtitulo), style: 'subtitulo'},
						],
					},
					{
						width: 220,
						stack: [
							{text: T(empresa.nombre), bold: true, alignment: 'right'},
							...(empresa.nit
								? [{text: T(`NIT ${empresa.nit}`), alignment: 'right', color: GRIS} as Content]
								: []),
							{text: T(`Generado: ${generado}`), alignment: 'right', color: GRIS, fontSize: 7},
						],
					},
				],
				margin: [0, 0, 0, 4],
			},
			...(l.filtro === 'completo' ? seccionesCompleto(l) : seccionesTransferencias(l)),
		],
	};
}
