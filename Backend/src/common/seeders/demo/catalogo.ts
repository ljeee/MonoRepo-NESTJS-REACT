import {derivarCategoriaProducto, esCategoriaProducto} from '../../utils/catalogo.util';
import type {Ejecutar} from './escritor';
import type {Catalogo} from './tipos';

/** Lee de la BD el menú, las reglas de sabores y los domiciliarios que el generador usa para armar ventas reales. */
export async function cargarCatalogo(q: Ejecutar): Promise<Catalogo> {
	const variantes = await q(
		`SELECT v.variante_id AS "varianteId", v.producto_id AS "productoId", p.producto_nombre AS producto, v.nombre,
			v.precio::float8 AS precio, v.tamano, p.categoria, p.personalizacion, p.sabor_grupo_id AS "grupoId"
		 FROM producto_variantes v JOIN productos p ON p.producto_id = v.producto_id
		 WHERE COALESCE(v.activo, true) AND COALESCE(p.activo, true)
		 ORDER BY v.variante_id`,
	);
	const grupos = await q(
		`SELECT id, nombre, max_sabores AS "maxSabores", variante_es_sabor AS "varianteEsSabor", usa_tamano AS "usaTamano",
			recargo_extra_desde AS "recargoExtraDesde", recargo_extra_pequena::float8 AS "recargoExtraPequena",
			recargo_extra_mediana::float8 AS "recargoExtraMediana", recargo_extra_grande::float8 AS "recargoExtraGrande"
		 FROM sabor_grupos WHERE COALESCE(activo, true) ORDER BY orden, id`,
	);
	const sabores = await q(
		`SELECT sabor_id AS "saborId", nombre, grupo_id AS "grupoId", recargo_pequena::float8 AS "recargoPequena",
			recargo_mediana::float8 AS "recargoMediana", recargo_grande::float8 AS "recargoGrande"
		 FROM pizza_sabores WHERE COALESCE(activo, true) AND grupo_id IS NOT NULL ORDER BY sabor_id`,
	);
	const domiciliarios = await q(`SELECT telefono, COALESCE(domiciliario_nombre, telefono) AS nombre FROM domiciliarios ORDER BY telefono`);

	return {
		variantes: variantes.map((v) => ({
			varianteId: Number(v.varianteId),
			productoId: Number(v.productoId),
			producto: String(v.producto).trim(),
			nombre: String(v.nombre),
			precio: Number(v.precio),
			tamano: v.tamano ?? null,
			categoria: esCategoriaProducto(v.categoria) ? v.categoria : derivarCategoriaProducto(v.producto, v.personalizacion),
			grupoId: v.grupoId == null ? null : Number(v.grupoId),
		})),
		grupos: grupos.map((g) => ({
			id: Number(g.id),
			nombre: g.nombre,
			maxSabores: Number(g.maxSabores),
			varianteEsSabor: !!g.varianteEsSabor,
			usaTamano: !!g.usaTamano,
			recargoExtraDesde: g.recargoExtraDesde == null ? null : Number(g.recargoExtraDesde),
			recargoExtraPequena: Number(g.recargoExtraPequena),
			recargoExtraMediana: Number(g.recargoExtraMediana),
			recargoExtraGrande: Number(g.recargoExtraGrande),
		})),
		sabores: sabores.map((s) => ({
			saborId: Number(s.saborId),
			nombre: s.nombre,
			grupoId: s.grupoId == null ? null : Number(s.grupoId),
			recargoPequena: Number(s.recargoPequena),
			recargoMediana: Number(s.recargoMediana),
			recargoGrande: Number(s.recargoGrande),
		})),
		domiciliarios: domiciliarios.map((d) => ({telefono: String(d.telefono), nombre: String(d.nombre)})),
	};
}
