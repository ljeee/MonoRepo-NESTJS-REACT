import {BadRequestException} from '@nestjs/common';
import {sqlFacturaValida, sqlFechaBogota, sqlMetodoNormalizado} from '../../common/domain/ventas';
import {getBogotaDateString, getBogotaRange} from '../../common/utils/date.utils';
import type {FiltrosAnaliticaDto} from './analitica.dto';

/** Máximo de días por consulta (protege la BD de consultas de años completos sin querer). */
export const MAX_DIAS_RANGO = 366;

const DIA_MS = 24 * 60 * 60 * 1000;

/** Acumula los valores de una consulta y devuelve los placeholders $1, $2… */
export class ParametrosSql {
	readonly valores: unknown[] = [];

	agregar(valor: unknown): string {
		this.valores.push(valor);
		return `$${this.valores.length}`;
	}
}

export interface Rango {
	inicio: Date;
	fin: Date;
}

export interface PeriodoConsulta {
	actual: Rango;
	/** Período inmediatamente anterior de igual duración (solo si se pidió comparar). */
	anterior: Rango | null;
	/** Días del rango pedido (inclusivo). */
	dias: number;
}

/**
 * Valida el rango y calcula el período a consultar. Si el rango termina HOY, el
 * período actual se corta en "ahora" y el anterior cubre la MISMA ventana horaria
 * (hoy hasta las 3 p. m. contra ayer hasta las 3 p. m.), para no comparar un día
 * a medias contra uno completo.
 */
export function calcularPeriodo(from: string, to: string, comparar = false, ahora: Date = new Date()): PeriodoConsulta {
	if (from > to) throw new BadRequestException('"from" no puede ser posterior a "to"');
	const {start, end} = getBogotaRange(from, to);
	const dias = Math.round((end.getTime() + 1 - start.getTime()) / DIA_MS);
	if (dias > MAX_DIAS_RANGO) {
		throw new BadRequestException(`El rango máximo es de ${MAX_DIAS_RANGO} días`);
	}

	const terminaHoy = to === getBogotaDateString(ahora) && ahora.getTime() < end.getTime();
	const actual: Rango = {inicio: start, fin: terminaHoy ? ahora : end};

	let anterior: Rango | null = null;
	if (comparar) {
		const inicioAnterior = new Date(start.getTime() - dias * DIA_MS);
		anterior = {
			inicio: inicioAnterior,
			fin: new Date(inicioAnterior.getTime() + (actual.fin.getTime() - start.getTime())),
		};
	}
	return {actual, anterior, dias};
}

/** Bucket de estado de pago de una factura válida. */
export function sqlEstadoPago(f = 'f'): string {
	return `(CASE WHEN ${f}.estado IN ('pagado', 'pagada') THEN 'cobrada' WHEN ${f}.estado = 'parcial' THEN 'parcial' ELSE 'pendiente' END)`;
}

export interface OpcionesCondiciones {
	/** Agregar los filtros de orden (tipo de pedido, canal, usuario) como EXISTS sobre las órdenes de la factura. */
	ordenComoExists?: boolean;
	/** Agregar los filtros de línea (producto, tamaño, sabor…) como EXISTS sobre las líneas de la factura. */
	lineasComoExists?: boolean;
}

/**
 * Condiciones a nivel de FACTURA (alias `f`): rango, venta válida y filtros propios
 * de la factura. Los filtros de orden y de línea se agregan como EXISTS para no
 * multiplicar totales al hacer join (una factura con 3 líneas no suma 3 veces).
 */
export function condicionesFactura(
	filtros: FiltrosAnaliticaDto,
	rango: Rango,
	p: ParametrosSql,
	{ordenComoExists = true, lineasComoExists = true}: OpcionesCondiciones = {},
): string[] {
	const c: string[] = [
		`f."fechaFactura" BETWEEN ${p.agregar(rango.inicio)} AND ${p.agregar(rango.fin)}`,
		sqlFacturaValida('f'),
	];

	if (filtros.metodoPago?.length) c.push(`${sqlMetodoNormalizado('f')} = ANY(${p.agregar(filtros.metodoPago)})`);
	if (filtros.estadoPago?.length) c.push(`${sqlEstadoPago('f')} = ANY(${p.agregar(filtros.estadoPago)})`);
	if (filtros.diaSemana?.length) {
		c.push(`EXTRACT(ISODOW FROM ${sqlFechaBogota('f')})::int = ANY(${p.agregar(filtros.diaSemana)}::int[])`);
	}
	if (filtros.horaDesde != null)
		c.push(`EXTRACT(HOUR FROM ${sqlFechaBogota('f')})::int >= ${p.agregar(filtros.horaDesde)}`);
	if (filtros.horaHasta != null)
		c.push(`EXTRACT(HOUR FROM ${sqlFechaBogota('f')})::int <= ${p.agregar(filtros.horaHasta)}`);
	if (filtros.cliente) {
		const tel = p.agregar(filtros.cliente);
		c.push(
			`(f.telefono_cliente = ${tel} OR EXISTS (SELECT 1 FROM domicilios d_c WHERE d_c.factura_id = f.factura_id AND d_c.telefono = ${tel}))`,
		);
	}
	if (filtros.domiciliario) {
		c.push(
			`EXISTS (SELECT 1 FROM domicilios d_d WHERE d_d.factura_id = f.factura_id AND d_d.telefono_domiciliario_asignado = ${p.agregar(filtros.domiciliario)})`,
		);
	}

	if (ordenComoExists) {
		const orden = condicionesOrden(filtros, p, 'o_f');
		if (orden.length) {
			c.push(
				`EXISTS (SELECT 1 FROM ordenes o_f WHERE o_f.factura_id = f.factura_id AND o_f.estado_orden IS DISTINCT FROM 'cancelado' AND ${orden.join(' AND ')})`,
			);
		}
	}

	if (lineasComoExists) {
		const lineas = condicionesLinea(filtros, p, 'op_f');
		if (lineas.length) {
			c.push(
				`EXISTS (SELECT 1 FROM ordenes o_l JOIN ordenes_productos op_f ON op_f.orden_id = o_l.orden_id WHERE o_l.factura_id = f.factura_id AND o_l.estado_orden IS DISTINCT FROM 'cancelado' AND ${lineas.join(' AND ')})`,
			);
		}
	}

	return c;
}

/** Condiciones sobre una orden (alias dado). */
export function condicionesOrden(filtros: FiltrosAnaliticaDto, p: ParametrosSql, o: string): string[] {
	const c: string[] = [];
	if (filtros.tipoPedido?.length) c.push(`${o}.tipo_pedido = ANY(${p.agregar(filtros.tipoPedido)})`);
	if (filtros.canal?.length) c.push(`${o}.canal = ANY(${p.agregar(filtros.canal)})`);
	if (filtros.usuario) c.push(`${o}.usuario_creacion_id = ${p.agregar(filtros.usuario)}`);
	return c;
}

/** Condiciones sobre una línea de venta (alias dado de ordenes_productos). */
export function condicionesLinea(filtros: FiltrosAnaliticaDto, p: ParametrosSql, op: string): string[] {
	const c: string[] = [];
	if (filtros.categoria?.length) c.push(`${op}.categoria = ANY(${p.agregar(filtros.categoria)})`);
	if (filtros.productoId?.length)
		c.push(`${op}."productoObjProductoId" = ANY(${p.agregar(filtros.productoId)}::int[])`);
	if (filtros.varianteId?.length) c.push(`${op}.variante_id = ANY(${p.agregar(filtros.varianteId)}::int[])`);
	if (filtros.tamano?.length) c.push(`${op}.tamano = ANY(${p.agregar(filtros.tamano)})`);
	if (filtros.precioManual != null) c.push(`${op}.precio_manual IS ${filtros.precioManual ? 'TRUE' : 'NOT TRUE'}`);
	if (filtros.saborId?.length) {
		c.push(
			`EXISTS (SELECT 1 FROM ordenes_productos_sabores s_f WHERE s_f.orden_producto_id = ${op}.id AND s_f.sabor_id = ANY(${p.agregar(filtros.saborId)}::int[]))`,
		);
	}
	if (filtros.saborGrupoId?.length) {
		c.push(
			`EXISTS (SELECT 1 FROM productos p_g WHERE p_g.producto_id = ${op}."productoObjProductoId" AND p_g.sabor_grupo_id = ANY(${p.agregar(filtros.saborGrupoId)}::int[]))`,
		);
	}
	return c;
}

/** true si hay algún filtro a nivel de línea (los KPIs de dinero pasan a "facturas que incluyen…"). */
export function hayFiltrosDeLinea(filtros: FiltrosAnaliticaDto): boolean {
	return Boolean(
		filtros.categoria?.length ||
		filtros.productoId?.length ||
		filtros.varianteId?.length ||
		filtros.tamano?.length ||
		filtros.saborId?.length ||
		filtros.saborGrupoId?.length ||
		filtros.precioManual != null,
	);
}

/**
 * FROM + WHERE para consultas a nivel de LÍNEA (ventas de productos): línea → orden →
 * factura. Los filtros de línea se aplican directo sobre `op` (no como EXISTS) para
 * que solo cuenten las líneas que cumplen (p. ej. solo las pizzas grandes).
 */
export function fromLineas(filtros: FiltrosAnaliticaDto, rango: Rango, p: ParametrosSql, joinsExtra = ''): string {
	const c = [
		...condicionesFactura(filtros, rango, p, {ordenComoExists: false, lineasComoExists: false}),
		`o.estado_orden IS DISTINCT FROM 'cancelado'`,
		...condicionesOrden(filtros, p, 'o'),
		...condicionesLinea(filtros, p, 'op'),
	];
	return `FROM ordenes_productos op
		JOIN ordenes o ON o.orden_id = op.orden_id
		JOIN facturas_ventas f ON f.factura_id = o.factura_id
		${joinsExtra}
		WHERE ${c.join('\n\t\tAND ')}`;
}

/** 'YYYY-MM-DD' (hora de Bogotá) de un instante; para generate_series y etiquetas. */
export function fechaBogota(instante: Date): string {
	return getBogotaDateString(instante);
}

/** FROM + WHERE para consultas a nivel de FACTURA. */
export function fromFacturas(filtros: FiltrosAnaliticaDto, rango: Rango, p: ParametrosSql): string {
	return `FROM facturas_ventas f
		WHERE ${condicionesFactura(filtros, rango, p).join('\n\t\tAND ')}`;
}

/** Granularidad por defecto según la duración del rango. */
export function granularidadPorDefecto(dias: number): 'dia' | 'semana' | 'mes' {
	if (dias <= 62) return 'dia';
	if (dias <= 180) return 'semana';
	return 'mes';
}
