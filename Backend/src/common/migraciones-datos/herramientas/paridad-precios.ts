import {calcularRecargoSabores, tamanoDeVariante} from '../../../ordenes/utils/recargos-sabores';
import {type Ejecutar, leerEsquema} from './esquema';

/**
 * Prueba que el precio de cada pizza NO cambia con los grupos de sabores. Compara, para cada variante de pizza y cada
 * combinación de 1 a 3 sabores activos, el precio con la fórmula ANTERIOR (tipo especial/tradicional + fila
 * RECARGO_3_SABORES, leída de las columnas heredadas que la migración conserva) contra la fórmula NUEVA
 * (`calcularRecargoSabores` con los recargos de cada sabor y las reglas del grupo). SOLO LEE.
 */

interface FilaSabor {
	nombre: string;
	tipo: string;
	/** Recargo por tamaño: [pequeña, mediana, grande]. */
	recargos: [number, number, number];
}

/**
 * Cobro de recargos TAL COMO era antes (product-processing.service anterior):
 *  - tamaño por el NOMBRE de la variante (pequeña/pequena/personal → pequeña; mediana → mediana; el resto → grande);
 *  - solo los sabores "especial" cobran, y se toma el MAYOR de los pedidos;
 *  - con 3 o más sabores se suma `RECARGO_3_SABORES[tamaño] || 3000`.
 * Los sabores se buscan por nombre en TODA la tabla, sin mirar grupo ni si están activos.
 */
export function recargoAnterior(
	varianteNombre: string,
	nombres: string[],
	filas: FilaSabor[],
	config3: [number, number, number] | null,
): number {
	const v = (varianteNombre || '').toLowerCase();
	const col =
		v.includes('pequeña') || v.includes('pequena') || v.includes('personal') ? 0 : v.includes('mediana') ? 1 : 2;
	const encontrados = filas.filter((s) => nombres.includes(s.nombre));
	let total = encontrados
		.filter((s) => s.tipo === 'especial')
		.reduce((max, s) => Math.max(max, s.recargos[col] || 0), 0);
	if (nombres.length >= 3) total += config3 ? config3[col] || 3000 : 3000;
	return total;
}

function* combinaciones<T>(lista: T[], tamano: number, desde = 0, actual: T[] = []): Generator<T[]> {
	if (actual.length === tamano) {
		yield [...actual];
		return;
	}
	for (let i = desde; i < lista.length; i++) {
		actual.push(lista[i]);
		yield* combinaciones(lista, tamano, i + 1, actual);
		actual.pop();
	}
}

export interface DiferenciaPrecio {
	producto: string;
	variante: string;
	sabores: string[];
	antes: number;
	ahora: number;
}

export interface ResultadoParidad {
	/** Productos con tamaños comparados. */
	productos: string[];
	combinaciones: number;
	diferencias: DiferenciaPrecio[];
	/** Motivo por el que no se pudo comparar (esquema sin migrar). */
	omitido?: string;
}

export async function compararPreciosSabores(q: Ejecutar): Promise<ResultadoParidad> {
	const esq = await leerEsquema(q);
	if (
		!esq.tiene('sabor_grupos') ||
		!esq.tiene('pizza_sabores', 'grupo_id') ||
		!esq.tiene('productos', 'sabor_grupo_id')
	) {
		return {
			productos: [],
			combinaciones: 0,
			diferencias: [],
			omitido: 'El esquema de grupos de sabores aún no existe',
		};
	}

	const grupos = await q(
		`SELECT id, nombre, max_sabores, usa_tamano, recargo_extra_desde, recargo_extra_pequena, recargo_extra_mediana, recargo_extra_grande
		 FROM sabor_grupos WHERE usa_tamano`,
	);
	const todos = await q(
		`SELECT nombre, tipo, grupo_id, activo, recargo_pequena AS rp, recargo_mediana AS rm, recargo_grande AS rg FROM pizza_sabores`,
	);
	const [cfg] = await q(
		`SELECT recargo_pequena AS rp, recargo_mediana AS rm, recargo_grande AS rg FROM pizza_sabores WHERE nombre = 'RECARGO_3_SABORES' AND tipo = 'configuracion' LIMIT 1`,
	);
	const config3: [number, number, number] | null = cfg
		? [Number(cfg.rp) || 0, Number(cfg.rm) || 0, Number(cfg.rg) || 0]
		: null;
	const filasTodas: FilaSabor[] = todos.map((s) => ({
		nombre: s.nombre,
		tipo: s.tipo,
		recargos: [Number(s.rp) || 0, Number(s.rm) || 0, Number(s.rg) || 0],
	}));

	const resultado: ResultadoParidad = {productos: [], combinaciones: 0, diferencias: []};
	for (const g of grupos) {
		const grupo = {
			usaTamano: true,
			recargoExtraDesde: g.recargo_extra_desde == null ? null : Number(g.recargo_extra_desde),
			recargoExtraPequena: Number(g.recargo_extra_pequena) || 0,
			recargoExtraMediana: Number(g.recargo_extra_mediana) || 0,
			recargoExtraGrande: Number(g.recargo_extra_grande) || 0,
		};
		const delGrupo = todos.filter((s) => Number(s.grupo_id) === Number(g.id));
		const activos = delGrupo.filter((s) => s.activo).map((s) => String(s.nombre));
		const filasGrupo = delGrupo.map((s) => ({
			recargoPequena: Number(s.rp) || 0,
			recargoMediana: Number(s.rm) || 0,
			recargoGrande: Number(s.rg) || 0,
			nombre: String(s.nombre),
		}));
		const maxSabores = Math.min(3, Number(g.max_sabores) || 3);

		const variantes = await q(
			`SELECT p.producto_nombre AS producto, v.nombre, v.tamano, v.precio
			 FROM productos p JOIN producto_variantes v ON v.producto_id = p.producto_id
			 WHERE p.sabor_grupo_id = $1 ORDER BY p.producto_nombre, v.variante_id`,
			[g.id],
		);
		for (const v of variantes) {
			if (!resultado.productos.includes(v.producto)) resultado.productos.push(v.producto);
			const tamano = tamanoDeVariante({nombre: v.nombre, tamano: v.tamano});
			for (let n = 1; n <= maxSabores; n++) {
				for (const nombres of combinaciones(activos, n)) {
					resultado.combinaciones++;
					const antes = Number(v.precio) + recargoAnterior(v.nombre, nombres, filasTodas, config3);
					const ahora =
						Number(v.precio) +
						calcularRecargoSabores(
							grupo,
							filasGrupo.filter((s) => nombres.includes(s.nombre)),
							nombres.length,
							tamano,
						).total;
					if (antes !== ahora) {
						resultado.diferencias.push({
							producto: v.producto,
							variante: v.nombre,
							sabores: nombres,
							antes,
							ahora,
						});
					}
				}
			}
		}
	}
	return resultado;
}
