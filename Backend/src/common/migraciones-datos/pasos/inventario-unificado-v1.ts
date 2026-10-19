import type {EntityManager} from 'typeorm';
import type {PasoSync} from '../migraciones-datos.types';
import {existeColumna} from '../migraciones-datos.utils';
import {
	categoriaBebidaPorNombre,
	categoriaCajaDeVariante,
	categoriaCajaPorNombre,
	nombreItemBebida,
	type CategoriaBebida,
} from '../../../inventario/inventario.util';
import {ID_MIGRACION_INVENTARIO} from '../../../inventario/inventario-estado.service';

const CATEGORIAS_BEBIDA_LEGADAS = ['gaseosa', 'jugo', 'cerveza', 'agua', 'otra'];

interface NuevoItem {
	tipo: 'caja' | 'bebida';
	nombre: string;
	categoria: string;
	cantidad: number;
	alerta: number | null;
	objetivo: number | null;
	activo: boolean;
	origen: string;
}

/** Inserta el ítem (si su `origen` no existe ya) con su movimiento de saldo inicial. Devuelve el id o null. */
async function insertarItem(manager: EntityManager, it: NuevoItem): Promise<number | null> {
	const filas: {id: number}[] = await manager.query(
		`INSERT INTO inventario_items (tipo, nombre, categoria, cantidad, alerta_minimo, nivel_objetivo, activo, origen)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 ON CONFLICT (origen) DO NOTHING
		 RETURNING id`,
		[it.tipo, it.nombre, it.categoria, it.cantidad, it.alerta, it.objetivo, it.activo, it.origen],
	);
	const id = filas[0]?.id ?? null;
	if (id !== null) {
		await manager.query(
			`INSERT INTO inventario_movimientos (item_id, tipo, delta, aplicado, cantidad_resultante, nota)
			 VALUES ($1, 'migracion', $2, $2, $2, 'Saldo migrado del inventario anterior')`,
			[id, it.cantidad],
		);
	}
	return id;
}

/**
 * Pasa cajas y bebidas al inventario unificado y crea las reglas de consumo.
 *  1. `inventario_cajas` → ítems `caja` con su saldo y configuración.
 *  2. Variantes de bebida → ítems `bebida` con regla 1:1. Las embotelladas quedan activas;
 *     jugos/limonadas (preparados) solo se migran, inactivos, si tenían stock o config.
 *     Las pulpas (`ingredientes_bebidas`) no se migran: el negocio dejó de controlarlas.
 *  3. Reglas de caja `auto` para pizzas y calzones según su tamaño (solo para llevar).
 *  4. Un movimiento `migracion` por ítem con el saldo. El historial viejo NO se copia:
 *     queda en sus tablas, consultable por SQL.
 * La fecha de corte (`resultado.fechaCorte`) separa las órdenes que ya descontó el
 * sistema viejo (no se reconcilian) de las nuevas.
 */
export const inventarioUnificadoV1: PasoSync = {
	id: ID_MIGRACION_INVENTARIO,
	descripcion: 'Inventario unificado: cajas y bebidas embotelladas con reglas de consumo',
	modo: 'sync',
	dependeDe: ['productos-categoria-v1'],
	async run({manager, log}) {
		if (!(await existeColumna(manager, 'inventario_items'))) {
			throw new Error('Tabla inventario_items inexistente: ¿corrió synchronize?');
		}
		const [{ahora}]: {ahora: Date}[] = await manager.query('SELECT now() AS ahora');
		const conteos: Record<string, number> = {
			cajas: 0,
			bebidasActivas: 0,
			bebidasInactivas: 0,
			reglasBebida: 0,
			reglasCaja: 0,
			variantesSinCaja: 0,
			variantesOmitidas: 0,
			pulpasDescartadas: 0,
		};

		// ── 1. Cajas ──
		if (await existeColumna(manager, 'inventario_cajas')) {
			const cajas: {
				id: number;
				nombre: string;
				cantidad: number;
				alertaMinimo: number | null;
				nivelObjetivo: number | null;
			}[] = await manager.query(
				`SELECT id, nombre, cantidad, "alertaMinimo", ${
					(await existeColumna(manager, 'inventario_cajas', 'nivelObjetivo'))
						? '"nivelObjetivo"'
						: 'NULL AS "nivelObjetivo"'
				} FROM inventario_cajas ORDER BY id`,
			);
			for (const c of cajas) {
				const id = await insertarItem(manager, {
					tipo: 'caja',
					nombre: (c.nombre || `Caja ${c.id}`).trim(),
					categoria: categoriaCajaPorNombre(c.nombre),
					cantidad: Math.max(0, Number(c.cantidad) || 0),
					alerta: c.alertaMinimo,
					objetivo: c.nivelObjetivo,
					activo: true,
					origen: `caja:${c.id}`,
				});
				if (id !== null) conteos.cajas++;
			}
		}

		// ── 2. Bebidas (por variante) ──
		const tieneConfigBebida = await existeColumna(manager, 'producto_variantes', 'categoria_bebida');
		const variantes: {
			varianteId: number;
			varianteNombre: string;
			productoNombre: string;
			categoriaProducto: string | null;
			activo: boolean;
			stock: number;
			categoriaLegada: string | null;
			alerta: number | null;
			objetivo: number | null;
		}[] = await manager.query(
			`SELECT v.variante_id AS "varianteId", v.nombre AS "varianteNombre", p.producto_nombre AS "productoNombre",
			        p.categoria AS "categoriaProducto", (v.activo AND p.activo IS NOT FALSE) AS activo,
			        COALESCE(v.stock_bebida, 0) AS stock,
			        ${tieneConfigBebida ? 'v.categoria_bebida' : 'NULL'} AS "categoriaLegada",
			        ${tieneConfigBebida ? 'v.alerta_bebida' : 'NULL'} AS alerta,
			        ${tieneConfigBebida ? 'v.nivel_objetivo_bebida' : 'NULL'} AS objetivo
			 FROM producto_variantes v JOIN productos p ON p.producto_id = v.producto_id
			 ORDER BY v.variante_id`,
		);

		for (const v of variantes) {
			const stock = Math.max(0, Number(v.stock) || 0);
			const legada = CATEGORIAS_BEBIDA_LEGADAS.includes(v.categoriaLegada ?? '') ? v.categoriaLegada : null;
			let categoria: CategoriaBebida | 'jugo' | null =
				(legada as CategoriaBebida | 'jugo' | null) ??
				categoriaBebidaPorNombre(`${v.productoNombre} ${v.varianteNombre}`) ??
				(v.categoriaProducto === 'bebida' ? 'otra' : null);
			if (!categoria && stock > 0) categoria = 'otra';

			// Pizzas, comida, etc.: no son bebidas.
			if (!categoria || v.categoriaProducto === 'pizza' || v.categoriaProducto === 'calzone') continue;

			const preparada = categoria === 'jugo';
			// Jugo preparado sin stock ni configuración: nada que conservar.
			if (preparada && stock === 0 && legada === null) continue;
			if (!v.activo && stock === 0) {
				conteos.variantesOmitidas++;
				continue;
			}

			const activo = v.activo && !preparada;
			const id = await insertarItem(manager, {
				tipo: 'bebida',
				nombre: nombreItemBebida(v.productoNombre, v.varianteNombre),
				categoria,
				cantidad: stock,
				alerta: v.alerta,
				objetivo: v.objetivo,
				activo,
				origen: `variante:${v.varianteId}`,
			});
			if (id === null) continue;
			if (activo) {
				conteos.bebidasActivas++;
				await manager.query(
					`INSERT INTO inventario_consumos (item_id, variante_id, cantidad, solo_para_llevar, origen)
					 VALUES ($1, $2, 1, false, 'auto') ON CONFLICT (variante_id, item_id) DO NOTHING`,
					[id, v.varianteId],
				);
				conteos.reglasBebida++;
			} else {
				conteos.bebidasInactivas++;
			}
		}

		// ── 3. Reglas de caja para pizzas y calzones ──
		const cajasNuevas: {id: number; categoria: string}[] = await manager.query(
			`SELECT id, categoria FROM inventario_items WHERE tipo = 'caja' AND activo ORDER BY id`,
		);
		for (const v of variantes) {
			if (!v.activo) continue;
			const categoriaCaja = categoriaCajaDeVariante(v.categoriaProducto, v.productoNombre, v.varianteNombre);
			if (!categoriaCaja) continue;
			const caja = cajasNuevas.find((c) => c.categoria === categoriaCaja);
			if (!caja) {
				conteos.variantesSinCaja++;
				continue;
			}
			const r: unknown[] = await manager.query(
				`INSERT INTO inventario_consumos (item_id, variante_id, cantidad, solo_para_llevar, origen)
				 VALUES ($1, $2, 1, true, 'auto') ON CONFLICT (variante_id, item_id) DO NOTHING RETURNING id`,
				[caja.id, v.varianteId],
			);
			if (r.length) conteos.reglasCaja++;
		}

		if (await existeColumna(manager, 'ingredientes_bebidas')) {
			const [{n}]: {n: number}[] = await manager.query('SELECT COUNT(*)::int AS n FROM ingredientes_bebidas');
			conteos.pulpasDescartadas = n;
		}

		log(`inventario unificado: ${JSON.stringify(conteos)}`);
		return {...conteos, fechaCorte: new Date(ahora).toISOString()};
	},
};
