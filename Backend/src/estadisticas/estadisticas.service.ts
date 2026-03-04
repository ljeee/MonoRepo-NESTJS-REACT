import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Ordenes } from '../ordenes/esquemas/ordenes.entity';
import { OrdenesProductos } from '../ordenes-productos/esquemas/ordenes-productos.entity';
import { FacturasVentas } from '../facturas-ventas/esquemas/facturas-ventas.entity';
import { FacturasPagos } from '../facturas-pagos/esquemas/facturas-pagos.entity';

@Injectable()
export class EstadisticasService {
	constructor(
		@InjectRepository(Ordenes)
		private readonly ordenesRepo: Repository<Ordenes>,
		@InjectRepository(OrdenesProductos)
		private readonly opRepo: Repository<OrdenesProductos>,
		@InjectRepository(FacturasVentas)
		private readonly facturasRepo: Repository<FacturasVentas>,
		@InjectRepository(FacturasPagos)
		private readonly pagosRepo: Repository<FacturasPagos>,
	) {}

	// ─── Top Productos ────────────────────────────────────────────────────────────
	async productosTop(from: string, to: string, limit = 10) {
		const result = await this.opRepo
			.createQueryBuilder('op')
			.select('op.producto', 'producto')
			.addSelect('SUM(op.cantidad)', 'totalVendido')
			.addSelect('SUM(op.cantidad * op.precio_unitario)', 'ingresos')
			.innerJoin('op.orden', 'o')
			.where('o.fechaOrden BETWEEN :from AND :to', { from, to })
			.andWhere("o.estadoOrden != 'cancelado'")
			.groupBy('op.producto')
			.orderBy('"totalVendido"', 'DESC')
			.limit(limit)
			.getRawMany();

		return result.map((r) => ({
			producto: r.producto,
			totalVendido: Number(r.totalVendido) || 0,
			ingresos: Number(r.ingresos) || 0,
		}));
	}

	// ─── Top Sabores (extraídos del texto del producto) ───────────────────────────
	async saboresTop(from: string, to: string, limit = 10) {
		// Los sabores están embebidos en el campo 'producto' 
		// ej: "Pizza Grande (paisa + carnes)" o "Pizza Grande paisa y carnes"
		// Hacemos un query que busque las pizzas y extraiga los sabores
		const pizzas = await this.opRepo
			.createQueryBuilder('op')
			.select('op.producto', 'producto')
			.addSelect('op.cantidad', 'cantidad')
			.innerJoin('op.orden', 'o')
			.where('o.fechaOrden BETWEEN :from AND :to', { from, to })
			.andWhere("o.estadoOrden != 'cancelado'")
			.andWhere("LOWER(op.producto) LIKE '%pizza%'")
			.getRawMany();

		// Parse sabores from product string
		const saborCount: Record<string, number> = {};
		for (const row of pizzas) {
			const nombre: string = row.producto || '';
			const cantidad = Number(row.cantidad) || 1;

			// Try to extract from parentheses: "Pizza Grande (paisa + carnes)"
			const parenMatch = nombre.match(/\(([^)]+)\)/);
			if (parenMatch) {
				const sabores = parenMatch[1].split(/\s*\+\s*/).map((s: string) => s.trim().toLowerCase());
				for (const s of sabores) {
					if (s) saborCount[s] = (saborCount[s] || 0) + cantidad;
				}
				continue;
			}

			// Try to extract after size: "Pizza Grande paisa y carnes"
			const afterSize = nombre.replace(/^pizza\s+(pequeña|mediana|grande)\s*/i, '');
			if (afterSize && afterSize !== nombre) {
				const sabores = afterSize.split(/\s+y\s+/).map((s: string) => s.trim().toLowerCase());
				for (const s of sabores) {
					if (s) saborCount[s] = (saborCount[s] || 0) + cantidad;
				}
			}
		}

		return Object.entries(saborCount)
			.map(([sabor, cantidad]) => ({ sabor, cantidad }))
			.sort((a, b) => b.cantidad - a.cantidad)
			.slice(0, limit);
	}

	// ─── Ventas por Hora ──────────────────────────────────────────────────────────
	async ventasPorHora(fecha?: string, from?: string, to?: string) {
		const qb = this.ordenesRepo
			.createQueryBuilder('o')
			.select("EXTRACT(HOUR FROM o.fecha_orden)", 'hora')
			.addSelect('COUNT(*)', 'cantidad')
			.addSelect('SUM(f.total)', 'total')
			.innerJoin('o.factura', 'f')
			.andWhere("o.estado_orden != 'cancelado'");

		if (from && to) {
			qb.where('o.fecha_orden BETWEEN :from AND :to', {
				from: new Date(`${from}T00:00:00`),
				to: new Date(`${to}T23:59:59`),
			});
		} else if (fecha) {
			qb.where("o.fecha_orden::date = :fecha", { fecha });
		} else {
			const hoy = new Date().toISOString().slice(0, 10);
			qb.where("o.fecha_orden::date = :fecha", { fecha: hoy });
		}

		const result = await qb
			.groupBy('hora')
			.orderBy('hora', 'ASC')
			.getRawMany();

		return result.map((r) => ({
			hora: Number(r.hora),
			cantidad: Number(r.cantidad),
			total: Number(r.total) || 0,
		}));
	}

	// ─── Ventas por Día ───────────────────────────────────────────────────────────
	async ventasPorDia(from: string, to: string) {
		const result = await this.ordenesRepo
			.createQueryBuilder('o')
			.select("o.fecha_orden::date", 'fecha')
			.addSelect('COUNT(*)', 'cantidad')
			.addSelect('SUM(f.total)', 'total')
			.innerJoin('o.factura', 'f')
			.where('o.fecha_orden BETWEEN :from AND :to', { from, to })
			.andWhere("o.estado_orden != 'cancelado'")
			.groupBy('fecha')
			.orderBy('fecha', 'ASC')
			.getRawMany();

		return result.map((r) => ({
			fecha: r.fecha,
			cantidad: Number(r.cantidad),
			total: Number(r.total) || 0,
			ticketPromedio: Number(r.cantidad) > 0 ? Math.round(Number(r.total) / Number(r.cantidad)) : 0,
		}));
	}

	// ─── Métodos de Pago ──────────────────────────────────────────────────────────
	async metodosPago(from: string, to: string) {
		const result = await this.facturasRepo
			.createQueryBuilder('f')
			.select('f.metodo', 'metodo')
			.addSelect('COUNT(*)', 'cantidad')
			.addSelect('SUM(f.total)', 'total')
			.where("f.fechaFactura BETWEEN :from AND :to", { from, to })
			.andWhere("f.estado != 'cancelado'")
			.groupBy('f.metodo')
			.orderBy('"total"', 'DESC')
			.getRawMany();

		const grandTotal = result.reduce((sum, r) => sum + (Number(r.total) || 0), 0);

		return result.map((r) => ({
			metodo: r.metodo || 'sin método',
			cantidad: Number(r.cantidad),
			total: Number(r.total) || 0,
			porcentaje: grandTotal > 0 ? Math.round(((Number(r.total) || 0) / grandTotal) * 100) : 0,
		}));
	}

	// ─── Resumen del Período ──────────────────────────────────────────────────────
	async resumenPeriodo(from: string, to: string) {
		const [ventasResult, egresosResult, ordenesResult, canceladosResult] = await Promise.all([
			this.facturasRepo
				.createQueryBuilder('f')
				.select('COUNT(*)', 'count')
				.addSelect('COALESCE(SUM(f.total), 0)', 'total')
				.where("f.fechaFactura BETWEEN :from AND :to", { from, to })
				.andWhere("f.estado != 'cancelado'")
				.getRawOne(),
			this.pagosRepo
				.createQueryBuilder('p')
				.select('COALESCE(SUM(p.total), 0)', 'total')
				.where("p.fechaFactura BETWEEN :from AND :to", { from, to })
				.getRawOne(),
			this.ordenesRepo
				.createQueryBuilder('o')
				.select('COUNT(*)', 'count')
				.where("o.fecha_orden BETWEEN :from AND :to", { from, to })
				.andWhere("o.estado_orden != 'cancelado'")
				.getRawOne(),
			this.ordenesRepo
				.createQueryBuilder('o')
				.select('COUNT(*)', 'count')
				.where("o.fecha_orden BETWEEN :from AND :to", { from, to })
				.andWhere("o.estado_orden = 'cancelado'")
				.getRawOne(),
		]);

		const totalVentas = Number(ventasResult?.total) || 0;
		const totalEgresos = Number(egresosResult?.total) || 0;
		const facturas = Number(ventasResult?.count) || 0;
		const ordenes = Number(ordenesResult?.count) || 0;
		const cancelados = Number(canceladosResult?.count) || 0;
		const totalOrdenes = ordenes + cancelados;

		return {
			totalVentas,
			totalEgresos,
			balanceNeto: totalVentas - totalEgresos,
			facturas,
			ordenes,
			cancelados,
			ticketPromedio: facturas > 0 ? Math.round(totalVentas / facturas) : 0,
			tasaCancelacion: totalOrdenes > 0 ? Math.round((cancelados / totalOrdenes) * 1000) / 10 : 0,
		};
	}

	// ─── Clientes Frecuentes ──────────────────────────────────────────────────────
	async clientesFrecuentes(limit = 10) {
		const result = await this.facturasRepo
			.createQueryBuilder('f')
			.select('f.cliente_nombre', 'clienteNombre')
			.addSelect('COUNT(*)', 'totalOrdenes')
			.addSelect('SUM(f.total)', 'gastoTotal')
			.addSelect('MAX(f.fechaFactura)', 'ultimaVisita')
			.where("f.cliente_nombre IS NOT NULL")
			.andWhere("f.cliente_nombre != ''")
			.andWhere("f.estado != 'cancelado'")
			.groupBy('f.cliente_nombre')
			.orderBy('"totalOrdenes"', 'DESC')
			.limit(limit)
			.getRawMany();

		return result.map((r) => ({
			clienteNombre: r.clienteNombre,
			totalOrdenes: Number(r.totalOrdenes),
			gastoTotal: Number(r.gastoTotal) || 0,
			ultimaVisita: r.ultimaVisita,
		}));
	}

	// ─── Top Variantes de Producto ────────────────────────────────────────────────
	async variantesTop(from: string, to: string, limit = 10) {
		const result = await this.opRepo
			.createQueryBuilder('op')
			.select('pv.nombre', 'variante')
			.addSelect('p.nombre', 'producto')
			.addSelect('SUM(op.cantidad)', 'totalVendido')
			.addSelect('SUM(op.cantidad * op.precio_unitario)', 'ingresos')
			.innerJoin('op.orden', 'o')
			.innerJoin('op.variante', 'pv')
			.innerJoin('op.productoObj', 'p')
			.where('o.fechaOrden BETWEEN :from AND :to', { from, to })
			.andWhere("o.estadoOrden != 'cancelado'")
			.andWhere('op.variante_id IS NOT NULL')
			.groupBy('pv.nombre')
			.addGroupBy('p.nombre')
			.orderBy('"totalVendido"', 'DESC')
			.limit(limit)
			.getRawMany();

		return result.map((r) => ({
			variante: r.variante,
			producto: r.producto,
			totalVendido: Number(r.totalVendido) || 0,
			ingresos: Number(r.ingresos) || 0,
		}));
	}

	// ─── Historial de Cliente ─────────────────────────────────────────────────────
	async clienteHistorial(telefono: string) {
		// The Ordenes entity has no telefono field.
		// Strategy: find orders via domicilios.telefono OR via factura.clienteNombre
		// matched against the clientes table.

		// 1. Find orders linked to domicilios with this phone
		const ordenesViaDomicilio = await this.ordenesRepo
			.createQueryBuilder('o')
			.innerJoin('o.domicilios', 'd', 'd.telefono = :tel', { tel: telefono })
			.leftJoinAndSelect('o.productos', 'op')
			.leftJoinAndSelect('o.factura', 'f')
			.orderBy('o.fechaOrden', 'DESC')
			.take(50)
			.getMany();

		// 2. Find orders via factura that has clienteNombre matching
		//    the client name from clientes table
		const ordenesViaFactura = await this.ordenesRepo
			.createQueryBuilder('o')
			.innerJoin('o.factura', 'f')
			.innerJoin('clientes', 'c', 'c.cliente_nombre = f.cliente_nombre AND c.telefono = :tel', { tel: telefono })
			.leftJoinAndSelect('o.productos', 'op')
			.leftJoinAndSelect('o.factura', 'fv')
			.orderBy('o.fechaOrden', 'DESC')
			.take(50)
			.getMany();

		// Merge & deduplicate by ordenId
		const seen = new Set<number>();
		const ordenes: typeof ordenesViaDomicilio = [];
		for (const o of [...ordenesViaDomicilio, ...ordenesViaFactura]) {
			if (!seen.has(o.ordenId)) {
				seen.add(o.ordenId);
				ordenes.push(o);
			}
		}
		ordenes.sort((a, b) => new Date(b.fechaOrden).getTime() - new Date(a.fechaOrden).getTime());

		// Compute stats
		const totalOrdenes = ordenes.length;
		const completadas = ordenes.filter(o => o.estadoOrden !== 'cancelado');
		const gastoTotal = completadas.reduce((sum, o) => {
			return sum + (Number(o.factura?.total) || 0);
		}, 0);
		const ticketPromedio = completadas.length > 0
			? Math.round(gastoTotal / completadas.length)
			: 0;

		// Count product frequency
		const productoCount: Record<string, number> = {};
		for (const o of completadas) {
			for (const p of o.productos || []) {
				const key = p.producto || 'Desconocido';
				productoCount[key] = (productoCount[key] || 0) + (Number(p.cantidad) || 1);
			}
		}
		const productosTop = Object.entries(productoCount)
			.map(([nombre, cantidad]) => ({ nombre, cantidad }))
			.sort((a, b) => b.cantidad - a.cantidad)
			.slice(0, 10);

		return {
			totalOrdenes,
			completadas: completadas.length,
			canceladas: totalOrdenes - completadas.length,
			gastoTotal,
			ticketPromedio,
			productosTop,
			ultimaVisita: ordenes[0]?.fechaOrden || null,
			ordenes: ordenes.slice(0, 50).map(o => ({
				ordenId: o.ordenId,
				fechaOrden: o.fechaOrden,
				estadoOrden: o.estadoOrden,
				tipoPedido: o.tipoPedido,
				total: Number(o.factura?.total) || 0,
				productos: (o.productos || []).map(p => ({
					nombre: p.producto,
					cantidad: Number(p.cantidad) || 0,
				})),
			})),
		};
	}
}
