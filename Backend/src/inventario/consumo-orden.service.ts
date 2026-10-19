import {Injectable, Logger} from '@nestjs/common';
import type {EntityManager} from 'typeorm';
import {InventarioEstadoService} from './inventario-estado.service';

export interface OpcionesReconciliar {
	/** La orden se va a borrar (o su factura): todo lo consumido vuelve. */
	eliminada?: boolean;
}

interface PlanItem {
	itemId: number;
	/** Consumo objetivo según el estado actual de la orden. */
	objetivo: number;
	/** Lo pedido hasta ahora (−Σ delta). */
	pedido: number;
	/** Lo descontado de verdad hasta ahora (−Σ aplicado). */
	aplicado: number;
}

/**
 * Lleva el inventario al consumo que corresponde a la orden TAL COMO ESTÁ AHORA.
 * Se llama desde todo lo que crea o invalida una venta (crear, editar, cancelar, borrar
 * la orden o su factura), dentro de la misma transacción y después de escribir.
 *
 * No guarda estado propio: compara el objetivo T (reglas × líneas; 0 si está anulada)
 * con lo ya registrado en los movimientos de la orden y escribe solo la diferencia, así
 * que llamarlo de nuevo no hace nada (idempotente) y sirve para cualquier edición:
 *  - T > pedido → se pide T − pedido (lo que no hay en stock queda como faltante).
 *  - T < pedido → se devuelve max(0, aplicado − T): solo lo que de verdad salió.
 */
@Injectable()
export class ConsumoOrdenService {
	private readonly logger = new Logger(ConsumoOrdenService.name);

	constructor(private readonly estado: InventarioEstadoService) {}

	/**
	 * Usa SOLO el `manager` recibido (un repositorio inyectado se bloquearía contra la
	 * transacción en curso). Corre en un savepoint: si algo falla se registra y la orden
	 * sigue adelante — un problema de inventario nunca debe impedir vender.
	 * Devuelve true si movió algo.
	 */
	async reconciliar(ordenId: number, manager: EntityManager, opciones: OpcionesReconciliar = {}): Promise<boolean> {
		const corte = await this.estado.fechaCorte(manager);
		if (!corte) return false;
		try {
			return await manager.transaction((m) => this.reconciliarEn(m, ordenId, corte, opciones.eliminada ?? false));
		} catch (err) {
			this.logger.warn(`Orden #${ordenId}: no se pudo reconciliar el inventario — ${(err as Error)?.message}`);
			return false;
		}
	}

	private async reconciliarEn(m: EntityManager, ordenId: number, corte: Date, eliminada: boolean): Promise<boolean> {
		// 1. Bloquear la orden: dos ediciones simultáneas no pueden calcular sobre el mismo libro.
		const [orden]: {
			fechaOrden: Date;
			tipoPedido: string | null;
			estadoOrden: string | null;
			estadoFactura: string | null;
		}[] = await m.query(
			`SELECT o.fecha_orden AS "fechaOrden", o.tipo_pedido AS "tipoPedido",
				        o.estado_orden AS "estadoOrden", f.estado AS "estadoFactura"
				 FROM ordenes o LEFT JOIN facturas_ventas f ON f.factura_id = o.factura_id
				 WHERE o.orden_id = $1
				 FOR UPDATE OF o`,
			[ordenId],
		);

		// Órdenes anteriores a la migración: las descontó el sistema viejo; no se tocan.
		if (orden && new Date(orden.fechaOrden) < corte) return false;

		const anulada =
			eliminada ||
			!orden ||
			(orden.estadoOrden ?? '').toLowerCase() === 'cancelado' ||
			(orden.estadoFactura ?? '').toLowerCase() === 'cancelado';
		const paraLlevar = ['domicilio', 'llevar'].includes((orden?.tipoPedido ?? '').toLowerCase());

		// 2. Objetivo según reglas × líneas actuales.
		const objetivos: {itemId: number; cantidad: number; activo: boolean}[] = anulada
			? []
			: await m.query(
					`SELECT c.item_id AS "itemId",
					        ROUND(SUM(c.cantidad * COALESCE(op.cantidad, 1)))::int AS cantidad,
					        bool_and(i.activo) AS activo
					 FROM ordenes_productos op
					 JOIN inventario_consumos c ON c.variante_id = op.variante_id
					 JOIN inventario_items i ON i.id = c.item_id
					 WHERE op.orden_id = $1 AND (NOT c.solo_para_llevar OR $2::boolean)
					 GROUP BY c.item_id`,
					[ordenId, paraLlevar],
				);

		// 3. Lo ya registrado para esta orden.
		const libro: {itemId: number; delta: number; aplicado: number}[] = await m.query(
			`SELECT item_id AS "itemId", SUM(delta)::int AS delta, SUM(aplicado)::int AS aplicado
			 FROM inventario_movimientos
			 WHERE orden_id = $1 AND tipo IN ('venta', 'devolucion')
			 GROUP BY item_id`,
			[ordenId],
		);

		const plan = new Map<number, PlanItem>();
		for (const l of libro) {
			plan.set(l.itemId, {itemId: l.itemId, objetivo: 0, pedido: -l.delta, aplicado: -l.aplicado});
		}
		for (const o of objetivos) {
			const actual = plan.get(o.itemId) ?? {itemId: o.itemId, objetivo: 0, pedido: 0, aplicado: 0};
			// Un ítem desactivado ya no consume, pero lo que ya consumió sigue contando.
			actual.objetivo = o.activo || actual.pedido > 0 ? o.cantidad : 0;
			plan.set(o.itemId, actual);
		}

		const cambios = [...plan.values()].filter((p) => p.objetivo !== p.pedido);
		if (!cambios.length) return false;

		// 4. Bloquear los ítems siempre en el mismo orden (evita deadlocks entre órdenes).
		const ids = cambios.map((c) => c.itemId).sort((a, b) => a - b);
		const filas: {id: number; cantidad: number}[] = await m.query(
			'SELECT id, cantidad FROM inventario_items WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
			[ids],
		);
		const stock = new Map(filas.map((f) => [f.id, Number(f.cantidad)]));

		for (const c of cambios.sort((a, b) => a.itemId - b.itemId)) {
			const anterior = stock.get(c.itemId);
			if (anterior === undefined) continue;

			let tipo: 'venta' | 'devolucion';
			let delta: number;
			let aplicado: number;
			if (c.objetivo > c.pedido) {
				tipo = 'venta';
				delta = -(c.objetivo - c.pedido);
				aplicado = -Math.min(anterior, c.objetivo - c.pedido);
			} else {
				tipo = 'devolucion';
				delta = c.pedido - c.objetivo;
				aplicado = Math.max(0, c.aplicado - c.objetivo);
			}
			const resultante = anterior + aplicado;

			await m.query('UPDATE inventario_items SET cantidad = $2, actualizado_en = now() WHERE id = $1', [
				c.itemId,
				resultante,
			]);
			await m.query(
				`INSERT INTO inventario_movimientos (item_id, tipo, delta, aplicado, cantidad_resultante, orden_id, nota)
				 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[
					c.itemId,
					tipo,
					delta,
					aplicado,
					resultante,
					ordenId,
					tipo === 'venta' ? `Orden #${ordenId}` : `Orden #${ordenId} (${anulada ? 'anulada' : 'editada'})`,
				],
			);
			stock.set(c.itemId, resultante);
		}
		return true;
	}
}
