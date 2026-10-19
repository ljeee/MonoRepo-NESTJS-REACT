import type {EntityManager} from 'typeorm';
import {derivarCategoriaProducto, esCategoriaProducto} from '../../utils/catalogo.util';
import {parsearLineaVenta} from '../../../ordenes/utils/parsear-linea-venta';
import type {
	ContextoCatalogo,
	ProductoCatalogo,
	VarianteCatalogo,
} from '../../../ordenes/utils/parsear-linea-venta.types';
import type {PasoBackground} from '../migraciones-datos.types';
import {existeColumna} from '../migraciones-datos.utils';

const TAMANO_LOTE = 500;

interface FilaPendiente {
	id: string;
	producto: string | null;
	varianteId: number | null;
	base: string | null;
}

/** Catálogo (variantes, productos, sabores) leído una vez por arranque. null si faltan tablas. */
export async function cargarContextoCatalogo(manager: EntityManager): Promise<ContextoCatalogo | null> {
	if (
		!(await existeColumna(manager, 'ordenes_productos', 'detalle_version')) ||
		!(await existeColumna(manager, 'ordenes_productos_sabores'))
	) {
		return null;
	}

	const filasVariantes: {
		varianteId: number;
		nombre: string;
		productoId: number;
		productoNombre: string;
		categoria: string | null;
		personalizacion: string | null;
	}[] = await manager.query(
		`SELECT v.variante_id AS "varianteId", v.nombre, v.producto_id AS "productoId",
		        p.producto_nombre AS "productoNombre", p.categoria, p.personalizacion
		 FROM producto_variantes v
		 JOIN productos p ON p.producto_id = v.producto_id`,
	);

	const filasProductos: {
		productoId: number;
		productoNombre: string;
		categoria: string | null;
		personalizacion: string | null;
		variantes: string[] | null;
	}[] = await manager.query(
		`SELECT p.producto_id AS "productoId", p.producto_nombre AS "productoNombre", p.categoria, p.personalizacion,
		        array_agg(v.nombre) FILTER (WHERE v.variante_id IS NOT NULL) AS variantes
		 FROM productos p
		 LEFT JOIN producto_variantes v ON v.producto_id = p.producto_id
		 GROUP BY p.producto_id`,
	);

	// Sabores del catálogo ya agrupados (`sabor-grupos-v1`). Dos precauciones para no ensuciar la analítica:
	//  - los repetidos que esa migración dejó inactivos y sin grupo NO entran (el histórico se reasigna al sobreviviente);
	//  - pizza y calzone comparten nombres ("Carnes", "De Casa"): cada sabor lleva su familia para que la línea de un
	//    calzone no se asocie al sabor de pizza (y al revés).
	const conGrupo = await existeColumna(manager, 'pizza_sabores', 'grupo_id');
	const conFlagCalzone = conGrupo && (await existeColumna(manager, 'sabor_grupos', 'variante_es_sabor'));
	const sabores: {
		saborId: number;
		nombre: string;
		tipo: string;
		grupoId: number | null;
		grupoCalzone: boolean | null;
	}[] = await manager.query(
		`SELECT s.sabor_id AS "saborId", s.nombre, s.tipo,
			        ${conGrupo ? 's.grupo_id' : 'NULL::int'} AS "grupoId",
			        ${conFlagCalzone ? 'g.variante_es_sabor' : 'NULL::boolean'} AS "grupoCalzone"
			 FROM pizza_sabores s
			 ${conFlagCalzone ? 'LEFT JOIN sabor_grupos g ON g.id = s.grupo_id' : ''}
			 WHERE s.tipo IS DISTINCT FROM 'configuracion'
			 ${conGrupo ? 'AND NOT (s.grupo_id IS NULL AND s.activo = false)' : ''}
			 ORDER BY s.sabor_id`,
	);

	const categoriaDe = (categoria: string | null, nombre: string, personalizacion: string | null) =>
		esCategoriaProducto(categoria) ? categoria : derivarCategoriaProducto(nombre, personalizacion);

	const variantes = new Map<number, VarianteCatalogo>(
		filasVariantes.map((v) => [
			Number(v.varianteId),
			{
				varianteId: Number(v.varianteId),
				nombre: v.nombre,
				productoId: Number(v.productoId),
				productoNombre: v.productoNombre,
				categoria: categoriaDe(v.categoria, v.productoNombre, v.personalizacion),
			},
		]),
	);

	const productos: ProductoCatalogo[] = filasProductos.map((p) => ({
		productoId: Number(p.productoId),
		productoNombre: p.productoNombre,
		categoria: categoriaDe(p.categoria, p.productoNombre, p.personalizacion),
		tieneVariantes: (p.variantes?.length ?? 0) > 0,
		variantes: p.variantes ?? [],
	}));

	const esCalzone = (s: (typeof sabores)[number]): boolean | undefined => {
		if (s.grupoId != null && s.grupoCalzone != null) return Boolean(s.grupoCalzone);
		if (s.tipo === 'calzone') return true;
		if (s.tipo === 'tradicional' || s.tipo === 'especial') return false;
		return undefined;
	};

	return {
		variantes,
		productos,
		sabores: sabores.map((s) => ({
			saborId: Number(s.saborId),
			nombre: s.nombre,
			tipo: s.tipo,
			esCalzone: esCalzone(s),
		})),
	};
}

/**
 * Backfill del histórico de líneas de venta: deduce producto, variante, tamaño,
 * categoría y sabores a partir del texto guardado (y de variante_id cuando existe).
 *
 * Idempotente y reanudable: procesa filas con detalle_version NULL y SIEMPRE las marca
 * ('v1' o 'v1-error'), así un lote nunca se repite ni se atasca. Las líneas nuevas ya
 * nacen con 'v1' desde ProductProcessingService.
 */
export const ventasDetalleV1: PasoBackground<ContextoCatalogo | null> = {
	id: 'ventas-detalle-v1',
	descripcion: 'Detalle estructurado (producto, tamaño, sabores) del histórico de ventas',
	modo: 'background',
	// Va DESPUÉS de los grupos de sabores: lee el catálogo ya agrupado y sin los repetidos (ver cargarContextoCatalogo).
	dependeDe: ['productos-categoria-v1', 'sabor-grupos-v1'],

	preparar: cargarContextoCatalogo,

	async lote({manager}, ctx) {
		if (!ctx) return {procesadas: 0, terminado: true, conteos: {omitido: 1}};

		const filas: FilaPendiente[] = await manager.query(
			`SELECT op.id, op.producto, op.variante_id AS "varianteId", op.base
			 FROM ordenes_productos op
			 WHERE op.detalle_version IS NULL
			 ORDER BY op.id
			 LIMIT $1
			 FOR UPDATE SKIP LOCKED`,
			[TAMANO_LOTE],
		);
		if (!filas.length) return {procesadas: 0, terminado: true, conteos: {}};

		const conteos: Record<string, number> = {procesadas: 0, conProducto: 0, conSabores: 0, saboresSinClasificar: 0};

		for (const fila of filas) {
			const id = String(fila.id);
			try {
				// Savepoint por fila: un error SQL en una línea no aborta el lote completo.
				await manager.transaction(async (m) => {
					const res = parsearLineaVenta(
						{
							texto: fila.producto,
							varianteId: fila.varianteId != null ? Number(fila.varianteId) : null,
							base: fila.base,
						},
						ctx,
					);

					await m.query(
						`UPDATE ordenes_productos
						 SET "productoObjProductoId" = $2, producto_base = $3, variante_nombre = $4,
						     tamano = $5, categoria = $6, detalle_version = 'v1'
						 WHERE id = $1`,
						[id, res.productoId, res.productoBase, res.varianteNombre, res.tamano, res.categoria],
					);

					for (const s of res.sabores) {
						await m.query(
							`INSERT INTO ordenes_productos_sabores (orden_producto_id, sabor_id, sabor_nombre, posicion, fraccion)
							 VALUES ($1, $2, $3, $4, $5)`,
							[id, s.saborId, s.nombre, s.posicion, s.fraccion],
						);
					}

					conteos.procesadas++;
					if (res.productoId != null) conteos.conProducto++;
					else conteos[`sinProducto:${res.motivo}`] = (conteos[`sinProducto:${res.motivo}`] ?? 0) + 1;
					if (res.sabores.length) conteos.conSabores++;
					conteos.saboresSinClasificar += res.sabores.filter((s) => s.saborId == null).length;
				});
			} catch {
				await manager.query(`UPDATE ordenes_productos SET detalle_version = 'v1-error' WHERE id = $1`, [id]);
				conteos.errores = (conteos.errores ?? 0) + 1;
			}
		}

		return {procesadas: filas.length, terminado: filas.length < TAMANO_LOTE, conteos};
	},
};
