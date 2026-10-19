import type {PasoSync} from '../migraciones-datos.types';
import {contarActualizadas, existeColumna} from '../migraciones-datos.utils';
import {normalizarTamano} from '../../utils/catalogo.util';
import {resolverPersonalizacion} from '../../utils/personalizacion.util';
import {GRUPO_CALZONE, GRUPO_PIZZA, RECARGO_TRES_SABORES_POR_DEFECTO} from '../../../pizza-sabores/grupos-base';

interface FilaSabor {
	saborId: number;
	nombre: string;
	tipo: string;
	activo: boolean;
	recargoPequena: number | string;
	recargoMediana: number | string;
	recargoGrande: number | string;
}

/**
 * Pasa los sabores a "grupos de sabores" configurables conservando los precios EXACTOS de hoy:
 *  1. Crea los grupos Pizza (3 sabores, tamaños, recargo extra desde 3) y Calzone (2 sabores, la variante es
 *     el sabor). El recargo por tres sabores sale de la fila `RECARGO_3_SABORES` (el cobro antiguo usaba
 *     `valor || 3000`, así que un tamaño en 0 se cobraba 3000: se copia igual).
 *  2. Asigna cada sabor a su grupo según el `tipo` heredado (tradicional/especial → Pizza, calzone → Calzone).
 *     Si dos sabores quedarían con el mismo nombre en el mismo grupo (p. ej. "Paisa" tradicional y especial)
 *     gana el especial —el que cobraba el recargo— y el otro queda sin grupo e inactivo (no se borra).
 *  3. Un sabor tradicional con recargo > 0 nunca lo cobraba (solo contaban los especiales): ahora el recargo
 *     lo decide el propio sabor, así que se pone en 0 para que el precio no cambie.
 *  4. Asigna cada producto a su grupo igual que lo resolvía el código (`personalizacion`, o el nombre).
 *  5. Rellena `producto_variantes.tamano` de los productos con tamaños, deduciéndolo del nombre.
 *  6. El Calzone no tenía sabores en `pizza_sabores`: el POS viejo usaba los NOMBRES DE SUS VARIANTES como sabores. La carta
 *     nueva lista los sabores del grupo, así que, si el grupo Calzone quedó vacío, se crea un sabor (sin recargo) por cada
 *     variante que sea un sabor (no "UNIDAD" ni "dos sabores"). Sin esto no se podría elegir sabor al vender un calzone.
 *  7. Si un sabor repetido se desactivó, las líneas de venta que ya apuntaban a él pasan al sobreviviente (así la analítica no
 *     parte "Paisa" en dos).
 * La fila de configuración vieja se deja intacta (ya no se muestra ni se usa).
 */
export const saborGruposV1: PasoSync = {
	id: 'sabor-grupos-v1',
	descripcion: 'Grupos de sabores: sabores y productos asignados con los precios actuales',
	modo: 'sync',
	dependeDe: ['productos-categoria-v1'],
	async run({manager, log}) {
		const faltantes: string[] = [];
		if (!(await existeColumna(manager, 'sabor_grupos'))) faltantes.push('sabor_grupos');
		if (!(await existeColumna(manager, 'pizza_sabores', 'grupo_id'))) faltantes.push('pizza_sabores.grupo_id');
		if (!(await existeColumna(manager, 'productos', 'sabor_grupo_id'))) faltantes.push('productos.sabor_grupo_id');
		if (!(await existeColumna(manager, 'producto_variantes', 'tamano')))
			faltantes.push('producto_variantes.tamano');
		if (faltantes.length) throw new Error(`Faltan columnas (¿corrió synchronize?): ${faltantes.join(', ')}`);

		const resultado: Record<string, unknown> = {
			saboresAsignados: 0,
			saboresDuplicadosSinGrupo: [] as string[],
			recargosTradicionalesAnulados: [] as string[],
			productosAsignados: 0,
			productosSinGrupo: 0,
			variantesConTamano: 0,
			lineasReasignadas: 0,
			saboresCalzoneCreados: [] as string[],
		};

		// ── 1. Grupos base ──
		const [config]: {pequena: string; mediana: string; grande: string}[] = await manager.query(
			`SELECT recargo_pequena AS pequena, recargo_mediana AS mediana, recargo_grande AS grande
			 FROM pizza_sabores WHERE nombre = 'RECARGO_3_SABORES' AND tipo = 'configuracion' LIMIT 1`,
		);
		const extra = (valor: string | undefined) => Number(valor) || RECARGO_TRES_SABORES_POR_DEFECTO;
		const pizza = {
			...GRUPO_PIZZA,
			recargoExtraPequena: extra(config?.pequena),
			recargoExtraMediana: extra(config?.mediana),
			recargoExtraGrande: extra(config?.grande),
		};
		for (const g of [pizza, GRUPO_CALZONE]) {
			await manager.query(
				`INSERT INTO sabor_grupos (nombre, max_sabores, variante_es_sabor, usa_tamano, recargo_extra_desde,
				                           recargo_extra_pequena, recargo_extra_mediana, recargo_extra_grande, activo, orden)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
				 ON CONFLICT (nombre) DO NOTHING`,
				[
					g.nombre,
					g.maxSabores,
					g.varianteEsSabor,
					g.usaTamano,
					g.recargoExtraDesde,
					g.recargoExtraPequena,
					g.recargoExtraMediana,
					g.recargoExtraGrande,
					g.orden,
				],
			);
		}
		const grupos: {id: number; nombre: string}[] = await manager.query(
			'SELECT id, nombre FROM sabor_grupos WHERE nombre = ANY($1::text[])',
			[[GRUPO_PIZZA.nombre, GRUPO_CALZONE.nombre]],
		);
		const idPizza = grupos.find((g) => g.nombre === GRUPO_PIZZA.nombre)?.id;
		const idCalzone = grupos.find((g) => g.nombre === GRUPO_CALZONE.nombre)?.id;
		if (idPizza == null || idCalzone == null) throw new Error('No se pudieron crear los grupos base');

		// ── 2. Sabores → grupo ──
		const pendientes: FilaSabor[] = await manager.query(
			`SELECT sabor_id AS "saborId", nombre, tipo, activo,
			        recargo_pequena AS "recargoPequena", recargo_mediana AS "recargoMediana", recargo_grande AS "recargoGrande"
			 FROM pizza_sabores
			 WHERE grupo_id IS NULL AND tipo IN ('tradicional', 'especial', 'calzone')
			 ORDER BY sabor_id`,
		);
		const yaEnGrupo: {saborId: number; grupoId: number; nombre: string}[] = await manager.query(
			'SELECT sabor_id AS "saborId", grupo_id AS "grupoId", nombre FROM pizza_sabores WHERE grupo_id IS NOT NULL',
		);
		/** (grupo|nombre) → sabor que lo ocupa. */
		const ocupados = new Map(yaEnGrupo.map((s) => [`${s.grupoId}|${s.nombre}`, s.saborId]));
		const conLineasDeSabor = await existeColumna(manager, 'ordenes_productos_sabores');
		const grupoDe = (tipo: string) => (tipo === 'calzone' ? idCalzone : idPizza);

		// Entre los repetidos del mismo grupo gana el especial (el que cobraba recargo), luego el de menor id.
		const ordenados = [...pendientes].sort(
			(a, b) => Number(b.tipo === 'especial') - Number(a.tipo === 'especial') || a.saborId - b.saborId,
		);
		const asignadosTradicionales: FilaSabor[] = [];
		for (const s of ordenados) {
			const grupoId = grupoDe(s.tipo);
			const clave = `${grupoId}|${s.nombre}`;
			const sobreviviente = ocupados.get(clave);
			if (sobreviviente !== undefined) {
				await manager.query('UPDATE pizza_sabores SET activo = false WHERE sabor_id = $1', [s.saborId]);
				(resultado.saboresDuplicadosSinGrupo as string[]).push(`${s.nombre} (${s.tipo})`);
				if (conLineasDeSabor) {
					resultado.lineasReasignadas =
						(resultado.lineasReasignadas as number) +
						(await contarActualizadas(
							manager,
							`UPDATE ordenes_productos_sabores SET sabor_id = ${Number(sobreviviente)} WHERE sabor_id = ${Number(s.saborId)} RETURNING 1`,
						));
				}
				continue;
			}
			ocupados.set(clave, s.saborId);
			await manager.query('UPDATE pizza_sabores SET grupo_id = $2 WHERE sabor_id = $1', [s.saborId, grupoId]);
			resultado.saboresAsignados = (resultado.saboresAsignados as number) + 1;
			if (s.tipo === 'tradicional') asignadosTradicionales.push(s);
		}

		// ── 3. Los tradicionales nunca cobraron recargo: que siga igual ──
		for (const s of asignadosTradicionales) {
			if ([s.recargoPequena, s.recargoMediana, s.recargoGrande].some((r) => Number(r) > 0)) {
				await manager.query(
					'UPDATE pizza_sabores SET recargo_pequena = 0, recargo_mediana = 0, recargo_grande = 0 WHERE sabor_id = $1',
					[s.saborId],
				);
				(resultado.recargosTradicionalesAnulados as string[]).push(s.nombre);
			}
		}

		// ── 4. Productos → grupo (misma resolución que usaba el cálculo de precios) ──
		const productos: {productoId: number; productoNombre: string; personalizacion: string | null}[] =
			await manager.query(
				'SELECT producto_id AS "productoId", producto_nombre AS "productoNombre", personalizacion FROM productos WHERE sabor_grupo_id IS NULL',
			);
		for (const p of productos) {
			const pers = resolverPersonalizacion(p.productoNombre, p.personalizacion);
			const grupoId = pers === 'pizza' ? idPizza : pers === 'calzone' ? idCalzone : null;
			if (grupoId == null) {
				resultado.productosSinGrupo = (resultado.productosSinGrupo as number) + 1;
				continue;
			}
			await manager.query('UPDATE productos SET sabor_grupo_id = $2 WHERE producto_id = $1', [
				p.productoId,
				grupoId,
			]);
			resultado.productosAsignados = (resultado.productosAsignados as number) + 1;
		}

		// ── 5. Tamaño explícito de las variantes de productos con tamaños ──
		const variantes: {varianteId: number; nombre: string}[] = await manager.query(
			`SELECT v.variante_id AS "varianteId", v.nombre
			 FROM producto_variantes v
			 JOIN productos p ON p.producto_id = v.producto_id
			 JOIN sabor_grupos g ON g.id = p.sabor_grupo_id
			 WHERE g.usa_tamano AND v.tamano IS NULL`,
		);
		for (const v of variantes) {
			const tamano = normalizarTamano(v.nombre);
			if (!tamano) continue;
			await manager.query('UPDATE producto_variantes SET tamano = $2 WHERE variante_id = $1', [
				v.varianteId,
				tamano,
			]);
			resultado.variantesConTamano = (resultado.variantesConTamano as number) + 1;
		}

		// ── 6. Sabores del Calzone: sus variantes SON los sabores ──
		const [{n: saboresCalzone}]: {n: number}[] = await manager.query(
			'SELECT COUNT(*)::int AS n FROM pizza_sabores WHERE grupo_id = $1',
			[idCalzone],
		);
		if (Number(saboresCalzone) === 0) {
			const tieneActivo = await existeColumna(manager, 'producto_variantes', 'activo');
			const variantesCalzone: {nombre: string}[] = await manager.query(
				`SELECT v.nombre FROM producto_variantes v JOIN productos p ON p.producto_id = v.producto_id
				 WHERE p.sabor_grupo_id = $1 ${tieneActivo ? 'AND v.activo IS NOT FALSE' : ''}
				 ORDER BY v.variante_id`,
				[idCalzone],
			);
			const vistos = new Set<string>();
			for (const v of variantesCalzone) {
				const nombre = (v.nombre ?? '').trim();
				const clave = nombre.toLowerCase();
				// "UNIDAD" y "calzone de dos sabores" son formas de pedirlo, no sabores.
				if (!nombre || vistos.has(clave) || /\bunidad\b|dos sabores/i.test(nombre)) continue;
				vistos.add(clave);
				await manager.query(
					`INSERT INTO pizza_sabores (nombre, tipo, grupo_id, recargo_pequena, recargo_mediana, recargo_grande, activo)
					 SELECT $1, 'calzone', $2, 0, 0, 0, true
					 WHERE NOT EXISTS (SELECT 1 FROM pizza_sabores WHERE grupo_id = $2 AND lower(nombre) = lower($1))`,
					[nombre, idCalzone],
				);
				(resultado.saboresCalzoneCreados as string[]).push(nombre);
			}
		}

		log(`sabor-grupos: ${JSON.stringify(resultado)}`);
		return resultado;
	},
};
