import {derivarCategoriaProducto} from '../../utils/catalogo.util';
import type {PasoSync} from '../migraciones-datos.types';
import {existeColumna} from '../migraciones-datos.utils';

/**
 * Asigna `productos.categoria` a los productos que aún no la tienen, deduciéndola de
 * `personalizacion` y del nombre. No toca categorías ya configuradas por el admin.
 */
export const productosCategoriaV1: PasoSync = {
	id: 'productos-categoria-v1',
	descripcion: 'Categoría inicial de productos (deducida de personalización y nombre)',
	modo: 'sync',
	async run({manager}) {
		if (!(await existeColumna(manager, 'productos', 'categoria'))) {
			return {omitido: 'columna productos.categoria inexistente'};
		}

		const productos: {productoId: number; productoNombre: string; personalizacion: string | null}[] =
			await manager.query(
				`SELECT producto_id AS "productoId", producto_nombre AS "productoNombre", personalizacion
				 FROM productos WHERE categoria IS NULL`,
			);

		const porCategoria: Record<string, number> = {};
		for (const p of productos) {
			const categoria = derivarCategoriaProducto(p.productoNombre, p.personalizacion);
			await manager.query('UPDATE productos SET categoria = $2 WHERE producto_id = $1', [
				p.productoId,
				categoria,
			]);
			porCategoria[categoria] = (porCategoria[categoria] ?? 0) + 1;
		}

		return {actualizados: productos.length, porCategoria};
	},
};
