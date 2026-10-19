import {BadRequestException, Injectable, Logger} from '@nestjs/common';
import {InjectDataSource} from '@nestjs/typeorm';
import {ConfigService} from '@nestjs/config';
import {DataSource} from 'typeorm';
import {AnaliticaService} from '../../estadisticas/analitica/analitica.service';
import type {FiltrosAnaliticaDto} from '../../estadisticas/analitica/analitica.dto';
import {EmpresaService, normalizarCorreos} from '../../empresa/empresa.service';
import {MailService} from '../../common/services/mail.service';
import {getBogotaRange} from '../../common/utils/date.utils';
import {
	sqlCobrado,
	sqlDomicilioCuenta,
	sqlFacturaValida,
	sqlFechaBogota,
	sqlMontoEfectivo,
	sqlPorCobrar,
	sqlTransferenciasPorCuenta,
} from '../../common/domain/ventas';
import {CATEGORIAS_GASTO, tipoPorCategoria} from '../../common/utils/gastos.util';
import {construirHtmlCierre} from '../../common/services/cierre-email';
import type {DomiciliariosCierre, ResumenCierre} from '../../common/services/cierre-email';
import {renderizarPdf} from '../../common/pdf/pdf.util';
import type {FiltroLibro} from './libro-diario.dto';
import {construirCsvLibroDiario, pesos, rangoTexto} from './libro-diario.formato';
import {docLibroDiario} from './libro-diario.pdf';

export const MAX_DIAS_LIBRO = 366;

export interface OpcionesLibroDiario {
	from: string;
	to: string;
	filtro?: FiltroLibro;
	cuentaId?: number;
	/** Observaciones del cierre (van al final del libro). */
	observaciones?: string | null;
}

export type EstadoVenta = 'cobrada' | 'parcial' | 'pendiente';
export type FormaPago = 'efectivo' | 'qr' | 'mixto' | 'pendiente' | 'sin_metodo';

export interface VentaLibro {
	id: number;
	/** YYYY-MM-DD y HH:MM en hora de Bogotá. */
	dia: string;
	hora: string;
	cliente: string;
	tipoPedido: string | null;
	estado: EstadoVenta;
	forma: FormaPago;
	/** "Efectivo", "QR · Diana", "Mixto: efectivo $X + QR $Y (Diana)", "Abonos: …", "Pendiente". */
	formaTexto: string;
	total: number;
	/** Lo cobrado de la factura (efectivo + QR; en datos viejos puede no tener método). */
	cobrado: number;
	efectivo: number;
	/** QR de la factura (con «cuenta específica», solo la parte de esa cuenta). */
	qr: number;
	qrPorCuenta: {cuentaId: number | null; cuenta: string; monto: number}[];
	porCobrar: number;
	domicilio: number;
	/** "2x Pizza - Grande (Paisa + Carnes) (precio manual $52.000, menú $48.000), 1x Coca Cola". */
	productos: string;
}

export interface GastoLibro {
	id: string;
	dia: string;
	concepto: string;
	/** "Costo · Insumos y materia prima" */
	clase: string;
	/** "Efectivo", "QR · Diana", "QR · sin cuenta asignada", "Efectivo (fuera de caja)" */
	metodo: string;
	pagado: boolean;
	valor: number;
}

export interface LibroDiario {
	from: string;
	to: string;
	filtro: FiltroLibro;
	cuentaId: number | null;
	cuentaNombre: string | null;
	ventas: VentaLibro[];
	gastos: GastoLibro[];
	totales: {
		facturado: number;
		/** Completo: = resumen.ventas.cobrado (también lo cobrado sin método registrado). */
		cobrado: number;
		efectivo: number;
		qr: number;
		porCobrar: number;
		domicilios: number;
		gastosPagados: number;
		gastosPendientes: number;
		/** Completo: balance de caja (cobrado − gastos pagados). QR: QR − gastos QR. Cuenta: su saldo. */
		saldo: number;
	};
	saldoEtiqueta: string;
	/** Mismas cifras del cierre (GET /estadisticas/resumen) para el consolidado. */
	resumen: ResumenCierre;
	domiciliarios: DomiciliariosCierre | null;
	observaciones: string | null;
}

export interface EmpresaLibro {
	nombre: string;
	nit: string;
}

const NOMBRE_TIPO_GASTO: Record<string, string> = {
	costo: 'Costo',
	gasto: 'Gasto operativo',
	sin_clasificar: 'Sin clasificar',
};
const esMetodoQr = (metodo: string) => metodo === 'qr' || metodo === 'transferencia';

/** Método de un gasto como se muestra en el libro: Efectivo, QR · Nequi, QR · sin cuenta, Efectivo (fuera de caja). */
function metodoGasto(metodo: string, cuenta: string | null): string {
	if (esMetodoQr(metodo)) return `QR · ${cuenta ?? 'sin cuenta asignada'}`;
	if (metodo === 'efectivo_no_caja') return 'Efectivo (fuera de caja)';
	if (metodo === 'efectivo') return 'Efectivo';
	return metodo;
}

const listaCuentas = (cuentas: VentaLibro['qrPorCuenta']) =>
	cuentas.length === 1 ? cuentas[0].cuenta : cuentas.map((c) => `${c.cuenta} ${pesos(c.monto)}`).join(', ');

/** Forma de pago de una venta, en texto para el libro. */
export function formaDePago(v: {
	estado: EstadoVenta;
	efectivo: number;
	qrTotal: number;
	porCobrar: number;
	cuentas: VentaLibro['qrPorCuenta'];
}): {
	forma: FormaPago;
	texto: string;
} {
	const forma: FormaPago =
		v.efectivo > 0 && v.qrTotal > 0
			? 'mixto'
			: v.qrTotal > 0
				? 'qr'
				: v.efectivo > 0
					? 'efectivo'
					: v.estado === 'pendiente'
						? 'pendiente'
						: 'sin_metodo';
	if (v.estado === 'pendiente') return {forma: 'pendiente', texto: 'Pendiente (por cobrar)'};
	if (v.estado === 'parcial') {
		const partes = [
			...(v.efectivo > 0 ? [`efectivo ${pesos(v.efectivo)}`] : []),
			...(v.qrTotal > 0 ? [`QR ${pesos(v.qrTotal)} (${listaCuentas(v.cuentas)})`] : []),
		];
		return {forma, texto: `Abonos: ${partes.join(' + ') || 'sin desglose'} · debe ${pesos(v.porCobrar)}`};
	}
	if (forma === 'mixto')
		return {
			forma,
			texto: `Mixto: efectivo ${pesos(v.efectivo)} + QR ${pesos(v.qrTotal)} (${listaCuentas(v.cuentas)})`,
		};
	if (forma === 'qr') return {forma, texto: `QR · ${listaCuentas(v.cuentas)}`};
	if (forma === 'efectivo') return {forma, texto: 'Efectivo'};
	return {forma, texto: 'Cobrada (sin método registrado)'};
}

/**
 * Libro diario, generado en el servidor: es el MISMO documento que se ve en Contabilidad y que se envía en cada cierre
 * (PDF completo + PDF de transferencias y mixto). Una fila por venta con su forma de pago (efectivo, QR con la cuenta,
 * mixto, abonos, pendiente) y una por gasto con su método; totales con las definiciones de `common/domain/ventas.ts`
 * (cuadran con GET /estadisticas/resumen) y el consolidado del resumen (productos por producto y por precio, cuentas,
 * ajustes manuales, domiciliarios).
 *
 * Filtros: completo · solo_transferencias (= «transferencias y mixto»: facturas con alguna parte por QR, COMPLETAS,
 * con su efectivo aparte, y los gastos pagados por QR) · cuenta_especifica (lo que entró y salió de UNA cuenta).
 */
@Injectable()
export class LibroDiarioService {
	private readonly logger = new Logger(LibroDiarioService.name);

	constructor(
		@InjectDataSource() private readonly ds: DataSource,
		private readonly analitica: AnaliticaService,
		private readonly empresa: EmpresaService,
		private readonly mail: MailService,
		private readonly config: ConfigService,
	) {}

	async generar(o: OpcionesLibroDiario): Promise<LibroDiario> {
		const filtro: FiltroLibro = o.filtro ?? 'completo';
		validarRango(o.from, o.to);
		if (filtro === 'cuenta_especifica' && !o.cuentaId) throw new BadRequestException('Indica la cuenta (cuentaId)');

		const {start, end} = getBogotaRange(o.from, o.to);
		const donde = `f."fechaFactura" BETWEEN $1 AND $2 AND ${sqlFacturaValida('f')}`;
		const [facturas, transferencias, egresos, cuenta, resumen, domiciliarios] = await Promise.all([
			this.ds.query<
				{
					id: number;
					dia: string;
					hora: string;
					cliente: string;
					tipo_pedido: string | null;
					estado: string | null;
					total: number;
					cobrado: number;
					efectivo: number;
					por_cobrar: number;
					costo_dom: number;
				}[]
			>(
				`SELECT f.factura_id AS id,
					to_char(${sqlFechaBogota('f')}, 'YYYY-MM-DD') AS dia, to_char(${sqlFechaBogota('f')}, 'HH24:MI') AS hora,
					COALESCE(NULLIF(trim(f.cliente_nombre), ''), 'Sin nombre') AS cliente,
					(SELECT o.tipo_pedido FROM ordenes o WHERE o.factura_id = f.factura_id ORDER BY o.orden_id LIMIT 1) AS tipo_pedido,
					f.estado, COALESCE(f.total, 0)::float8 AS total, ${sqlCobrado('f')}::float8 AS cobrado,
					${sqlMontoEfectivo('f')}::float8 AS efectivo, ${sqlPorCobrar('f')}::float8 AS por_cobrar,
					COALESCE((SELECT d.costo_domicilio FROM domicilios d WHERE d.factura_id = f.factura_id AND ${sqlDomicilioCuenta('d')} ORDER BY d.domicilio_id LIMIT 1), 0)::float8 AS costo_dom
				 FROM facturas_ventas f WHERE ${donde}
				 ORDER BY f."fechaFactura", f.factura_id`,
				[start, end],
			),
			this.ds.query<{factura_id: number; cuenta_id: number | null; cuenta: string | null; monto: number}[]>(
				`SELECT t.factura_id, t.cuenta_id, t.cuenta, t.monto::float8 AS monto FROM (${sqlTransferenciasPorCuenta(donde)}) t
				 ORDER BY t.factura_id, t.cuenta_id NULLS LAST, t.cuenta`,
				[start, end],
			),
			// facturas_pagos.fecha_factura es DATE: se compara contra las fechas tal cual (igual que el resumen).
			this.ds.query<
				{
					id: string;
					dia: string;
					nombre: string;
					total: number;
					pagado: boolean;
					metodo: string;
					categoria: string;
					tipo_gasto: string | null;
					cuenta_origen_id: number | null;
					cuenta_origen: string | null;
				}[]
			>(
				`SELECT g.pagos_id::text AS id, to_char(g.fecha_factura, 'YYYY-MM-DD') AS dia,
					COALESCE(NULLIF(trim(g.nombre_gasto), ''), 'Sin descripción') AS nombre, COALESCE(g.total, 0)::float8 AS total,
					COALESCE(g.estado IN ('pagado', 'pagada'), false) AS pagado, COALESCE(NULLIF(g.metodo, ''), 'efectivo') AS metodo,
					COALESCE(NULLIF(g.categoria, ''), 'general') AS categoria, NULLIF(g.tipo_gasto, '') AS tipo_gasto, g.cuenta_origen_id,
					ct.nombre AS cuenta_origen
				 FROM facturas_pagos g LEFT JOIN cuentas_transferencia ct ON ct.id = g.cuenta_origen_id
				 WHERE g.fecha_factura BETWEEN $1::date AND $2::date
				 ORDER BY g.fecha_factura, g.pagos_id`,
				[o.from, o.to],
			),
			filtro === 'cuenta_especifica'
				? this.ds.query<{nombre: string}[]>('SELECT nombre FROM cuentas_transferencia WHERE id = $1', [
						o.cuentaId,
					])
				: Promise.resolve([] as {nombre: string}[]),
			this.analitica.resumenGeneral(o.from, o.to),
			filtro === 'completo'
				? this.analitica.domiciliarios({from: o.from, to: o.to} as FiltrosAnaliticaDto)
				: Promise.resolve(null),
		]);

		const transferenciasDe = new Map<number, VentaLibro['qrPorCuenta']>();
		for (const t of transferencias) {
			const lista = transferenciasDe.get(t.factura_id) ?? [];
			lista.push({cuentaId: t.cuenta_id, cuenta: t.cuenta || 'sin cuenta asignada', monto: t.monto});
			transferenciasDe.set(t.factura_id, lista);
		}

		// Qué facturas van: completo = todas las ventas válidas; transferencias y mixto = las que tienen alguna parte
		// por QR; una cuenta = las que tienen QR a esa cuenta.
		const elegidas = facturas.filter((f) => {
			const cuentas = transferenciasDe.get(f.id) ?? [];
			if (filtro === 'solo_transferencias') return cuentas.length > 0;
			if (filtro === 'cuenta_especifica') return cuentas.some((c) => c.cuentaId === o.cuentaId);
			return true;
		});
		const productos = await this.detalleProductos(elegidas.map((f) => f.id));

		const ventas: VentaLibro[] = elegidas.map((f) => {
			const cuentas = transferenciasDe.get(f.id) ?? [];
			const qrTotal = cuentas.reduce((s, c) => s + c.monto, 0);
			const estado: EstadoVenta =
				f.estado === 'parcial'
					? 'parcial'
					: f.estado === 'pagado' || f.estado === 'pagada'
						? 'cobrada'
						: 'pendiente';
			const {forma, texto} = formaDePago({
				estado,
				efectivo: f.efectivo,
				qrTotal,
				porCobrar: f.por_cobrar,
				cuentas,
			});
			return {
				id: f.id,
				dia: f.dia,
				hora: f.hora,
				cliente: f.cliente,
				tipoPedido: f.tipo_pedido,
				estado,
				forma,
				formaTexto: texto,
				total: f.total,
				cobrado: f.cobrado,
				efectivo: f.efectivo,
				qr:
					filtro === 'cuenta_especifica'
						? cuentas.filter((c) => c.cuentaId === o.cuentaId).reduce((s, c) => s + c.monto, 0)
						: qrTotal,
				qrPorCuenta: cuentas,
				porCobrar: f.por_cobrar,
				domicilio: f.costo_dom,
				productos: productos.get(f.id) ?? '',
			};
		});

		// Gastos: completo = todos; transferencias = los pagados por QR; una cuenta = los QR que salieron de ella
		// (cuenta_origen_id; los QR viejos sin cuenta quedan fuera hasta asignarlos).
		const gastos: GastoLibro[] = egresos
			.filter(
				(g) =>
					filtro === 'completo' ||
					(filtro === 'solo_transferencias' && esMetodoQr(g.metodo)) ||
					(filtro === 'cuenta_especifica' && esMetodoQr(g.metodo) && g.cuenta_origen_id === o.cuentaId),
			)
			.map((g) => {
				const tipo = g.tipo_gasto ?? tipoPorCategoria(g.categoria) ?? 'sin_clasificar';
				const categoria = CATEGORIAS_GASTO.find((c) => c.id === g.categoria)?.nombre ?? 'Sin categoría';
				return {
					id: g.id,
					dia: g.dia,
					concepto: g.nombre,
					clase: `${NOMBRE_TIPO_GASTO[tipo] ?? tipo} · ${categoria}`,
					metodo: metodoGasto(g.metodo, g.cuenta_origen),
					pagado: g.pagado,
					valor: g.total,
				};
			});

		const suma = <T>(lista: T[], valor: (x: T) => number) => lista.reduce((s, x) => s + valor(x), 0);
		const efectivo = suma(ventas, (v) => v.efectivo);
		const qr = suma(ventas, (v) => v.qr);
		const gastosPagados = suma(
			gastos.filter((g) => g.pagado),
			(g) => g.valor,
		);
		const cuentaNombre = cuenta[0]?.nombre ?? null;
		const cobrado = suma(ventas, (v) => v.cobrado);
		const saldo = filtro === 'completo' ? cobrado - gastosPagados : qr - gastosPagados;
		const saldoEtiqueta =
			filtro === 'solo_transferencias'
				? 'Saldo QR (cobrado por QR − gastos pagados por QR)'
				: filtro === 'cuenta_especifica'
					? `Saldo de la cuenta${cuentaNombre ? ` ${cuentaNombre}` : ''} (entró − salió)`
					: 'Balance de caja (cobrado − gastos pagados)';

		return {
			from: o.from,
			to: o.to,
			filtro,
			cuentaId: filtro === 'cuenta_especifica' ? (o.cuentaId ?? null) : null,
			cuentaNombre,
			ventas,
			gastos,
			totales: {
				facturado: suma(ventas, (v) => v.total),
				cobrado,
				efectivo,
				qr,
				porCobrar: suma(ventas, (v) => v.porCobrar),
				domicilios: suma(ventas, (v) => v.domicilio),
				gastosPagados,
				gastosPendientes: suma(
					gastos.filter((g) => !g.pagado),
					(g) => g.valor,
				),
				saldo,
			},
			saldoEtiqueta,
			resumen,
			domiciliarios,
			observaciones: o.observaciones?.trim() || null,
		};
	}

	/** "2x Pizza - Grande (Paisa + Carnes) (precio manual $52.000, menú $48.000), 1x Coca Cola" por factura. */
	private async detalleProductos(ids: number[]): Promise<Map<number, string>> {
		const mapa = new Map<number, string>();
		if (!ids.length) return mapa;
		const lineas = await this.ds.query<
			{
				factura_id: number;
				cantidad: number;
				producto: string;
				precio: number;
				manual: boolean;
				lista: number | null;
			}[]
		>(
			`SELECT o.factura_id, COALESCE(op.cantidad, 1)::float8 AS cantidad, COALESCE(NULLIF(trim(op.producto), ''), 'Producto') AS producto,
				COALESCE(op.precio_unitario, 0)::float8 AS precio, op.precio_manual IS TRUE AS manual, op.precio_lista::float8 AS lista
			 FROM ordenes_productos op JOIN ordenes o ON o.orden_id = op.orden_id
			 WHERE o.factura_id = ANY($1::int[]) AND o.estado_orden IS DISTINCT FROM 'cancelado'
			 ORDER BY o.factura_id, op.id`,
			[ids],
		);
		for (const l of lineas) {
			const manual = l.manual
				? ` (precio manual ${pesos(l.precio)}${l.lista != null ? `, menú ${pesos(l.lista)}` : ''})`
				: '';
			const texto = `${l.cantidad}x ${l.producto}${manual}`;
			mapa.set(l.factura_id, mapa.has(l.factura_id) ? `${mapa.get(l.factura_id)}, ${texto}` : texto);
		}
		return mapa;
	}

	async pdf(o: OpcionesLibroDiario): Promise<Buffer> {
		const [libro, empresa] = await Promise.all([this.generar(o), this.datosEmpresa()]);
		return renderizarPdf(docLibroDiario(libro, empresa));
	}

	async csv(o: OpcionesLibroDiario): Promise<string> {
		return construirCsvLibroDiario(await this.generar(o));
	}

	/**
	 * A quién va el correo del cierre: el dueño (REPORT_EMAIL) y la contadora (Configuración POS, o CONTADOR_EMAIL),
	 * sin repetidos. Vacío = no se envía.
	 */
	async destinatarios(): Promise<string[]> {
		const contador =
			(await this.empresa.getCorreoContador()) ?? normalizarCorreos(this.config.get<string>('CONTADOR_EMAIL'));
		const todos = [normalizarCorreos(this.config.get<string>('REPORT_EMAIL')), contador]
			.filter((c): c is string => !!c)
			.flatMap((c) => c.split(',').map((x) => x.trim()))
			.filter(Boolean);
		const vistos = new Set<string>();
		return todos.filter((c) => (vistos.has(c.toLowerCase()) ? false : (vistos.add(c.toLowerCase()), true)));
	}

	/**
	 * Correo con los DOS libros del rango en PDF (completo y transferencias y mixto) al dueño y a la contadora. El
	 * cuerpo es el resumen del cierre (mismas cifras). Lo usa el cierre (automático a las 4 a. m. o manual) y el botón
	 * de Contabilidad. Lanza si no hay destinatarios o el correo no está configurado.
	 */
	async enviar(
		from: string,
		to: string,
		opciones: {observaciones?: string | null; motivo?: 'cierre' | 'manual'} = {},
	): Promise<{enviadoA: string[]; adjuntos: string[]}> {
		const destinos = await this.destinatarios();
		if (!destinos.length) {
			throw new BadRequestException(
				'No hay a quién enviar: configura REPORT_EMAIL en el servidor o el correo de la contadora en Configuración POS',
			);
		}
		if (!this.mail.configurado())
			throw new BadRequestException('El servidor de correo no está configurado (MAIL_HOST)');

		const empresa = await this.datosEmpresa();
		const [completo, transferencias] = await Promise.all([
			this.generar({from, to, filtro: 'completo', observaciones: opciones.observaciones}),
			this.generar({from, to, filtro: 'solo_transferencias'}),
		]);
		const [pdfCompleto, pdfTransferencias] = await Promise.all([
			renderizarPdf(docLibroDiario(completo, empresa)),
			renderizarPdf(docLibroDiario(transferencias, empresa)),
		]);
		const sufijo = from === to ? from : `${from}_${to}`;
		const adjuntos = [
			{filename: `libro-diario-${sufijo}.pdf`, content: pdfCompleto, contentType: 'application/pdf'},
			{
				filename: `libro-diario-transferencias-${sufijo}.pdf`,
				content: pdfTransferencias,
				contentType: 'application/pdf',
			},
		];
		const esCierre = opciones.motivo === 'cierre';
		const html = construirHtmlCierre({
			fecha: rangoTexto(from, to),
			empresa: {nombreComercial: empresa.nombre, nit: empresa.nit},
			resumen: completo.resumen,
			domiciliarios: completo.domiciliarios,
			observaciones: completo.observaciones,
			companyName: empresa.nombre,
			nit: empresa.nit,
			titulo: esCierre ? 'Cierre de Jornada' : 'Libro diario',
			tituloVentas: from === to ? 'Ventas del día' : 'Ventas del período',
			nota: 'Adjuntos: el libro diario completo (todas las ventas con su forma de pago, productos por precio, gastos y cuentas) y el libro de transferencias y mixto, en PDF.',
		});
		await this.mail.enviarConAdjuntos(destinos, {
			asunto: `${esCierre ? 'Cierre de caja' : 'Libro diario'} ${rangoTexto(from, to)} - ${empresa.nombre}`,
			html,
			adjuntos,
			remitente: empresa.nombre,
		});
		this.logger.log(`Libros ${rangoTexto(from, to)} enviados a ${destinos.join(', ')}`);
		return {enviadoA: destinos, adjuntos: adjuntos.map((a) => a.filename)};
	}

	private async datosEmpresa(): Promise<EmpresaLibro> {
		const e = (await this.empresa.getConfig()) as {nombreComercial?: string; razonSocial?: string; nit?: string};
		return {
			nombre: e?.nombreComercial || e?.razonSocial || this.config.get<string>('COMPANY_NAME', 'Dfiru Pizzería'),
			nit: e?.nit || this.config.get<string>('COMPANY_NIT', ''),
		};
	}
}

function validarRango(from: string, to: string) {
	const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
	if (!Number.isFinite(ms) || ms < 0) throw new BadRequestException('El rango de fechas no es válido');
	if (ms / 86_400_000 + 1 > MAX_DIAS_LIBRO)
		throw new BadRequestException(`El libro diario admite hasta ${MAX_DIAS_LIBRO} días`);
}
