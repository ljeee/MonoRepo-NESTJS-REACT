import {AnaliticaService} from '../../../estadisticas/analitica/analitica.service';
import {PASOS_MIGRACION} from '../pasos';
import {ESQUEMA_NUEVO} from './auditoria';
import {type Ejecutar, leerEsquema, numero} from './esquema';
import {type FilaVentasMes, type LineaBase, TABLAS_SIN_CAMBIOS, capturarLineaBase} from './linea-base';
import {compararPreciosSabores} from './paridad-precios';

/**
 * Verificación POSTERIOR a la migración. SOLO LEE. Comprueba, con la base ya migrada y el backend nuevo arrancado
 * (pero SIN reabrir el local):
 *  1. que el esquema y TODOS los pasos de datos terminaron bien;
 *  2. contra la línea base: que no cambió ni una fila ni un peso (conteos, dinero por mes, huellas);
 *  3. que lo transformado quedó bien: categorías, grupos de sabores, inventario, detalle de ventas;
 *  4. que el precio de cada pizza es el mismo que antes;
 *  5. que la analítica nueva da las mismas cifras que el SQL directo.
 */

export type EstadoPrueba = 'ok' | 'falla' | 'aviso';

export interface Prueba {
	id: string;
	titulo: string;
	estado: EstadoPrueba;
	detalle?: string;
}

export interface ResultadoVerificacion {
	generadaEn: string;
	pruebas: Prueba[];
	fallas: number;
	avisos: number;
	ok: boolean;
}

type Fila = Record<string, unknown>;

/** Diferencias entre dos listas de filas comparadas por clave. */
function diferencias<T extends Fila>(antes: T[], despues: T[], clave: keyof T): string[] {
	const mapaDespues = new Map(despues.map((f) => [String(f[clave]), f]));
	const mensajes: string[] = [];
	for (const a of antes) {
		const d = mapaDespues.get(String(a[clave]));
		if (!d) {
			mensajes.push(`${String(a[clave])}: ya no existe`);
			continue;
		}
		const campos = Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(d[k]));
		if (campos.length)
			mensajes.push(
				`${String(a[clave])}: ${campos.map((c) => `${c} ${JSON.stringify(a[c])} → ${JSON.stringify(d[c])}`).join(', ')}`,
			);
		mapaDespues.delete(String(a[clave]));
	}
	for (const k of mapaDespues.keys()) mensajes.push(`${k}: apareció después de la línea base`);
	return mensajes;
}

/**
 * Compara el dinero por mes. facturado, cobrado y por cobrar deben ser IDÉNTICOS. El reparto efectivo/QR solo puede SUBIR:
 * `facturas-montos-v1` completa el desglose de los pagos mixtos que tenían una sola parte, y ese dinero pasa de "sin
 * repartir" a su medio (efectivo + QR sigue sin superar lo cobrado).
 */
function compararDinero(antes: FilaVentasMes[], despues: FilaVentasMes[]) {
	const estrictas: string[] = [];
	const bajas: string[] = [];
	const subidas: string[] = [];
	const mapa = new Map(despues.map((f) => [f.mes, f]));
	for (const a of antes) {
		const d = mapa.get(a.mes);
		if (!d) {
			estrictas.push(`${a.mes}: el mes ya no existe`);
			continue;
		}
		for (const campo of ['facturas', 'validas', 'facturado', 'cobrado', 'porCobrar'] as const) {
			if (a[campo] !== d[campo]) estrictas.push(`${a.mes} ${campo} ${a[campo]} → ${d[campo]}`);
		}
		for (const campo of ['efectivo', 'transferencia'] as const) {
			if (d[campo] < a[campo]) bajas.push(`${a.mes} ${campo} ${a[campo]} → ${d[campo]}`);
			else if (d[campo] > a[campo]) subidas.push(`${a.mes} ${campo} +${d[campo] - a[campo]}`);
		}
		if (d.efectivo + d.transferencia > d.cobrado + 1)
			estrictas.push(
				`${a.mes}: efectivo + QR (${d.efectivo + d.transferencia}) supera lo cobrado (${d.cobrado})`,
			);
		mapa.delete(a.mes);
	}
	for (const m of mapa.keys()) estrictas.push(`${m}: mes nuevo después de la línea base`);
	return {estrictas, bajas, subidas};
}

const resumen = (mensajes: string[], max = 6) =>
	mensajes.slice(0, max).join(' | ') + (mensajes.length > max ? ` … (+${mensajes.length - max} más)` : '');

/** Estado de cada paso registrado en `migraciones_datos`. */
export async function estadoPasos(q: Ejecutar): Promise<{id: string; estado: string; resultado: unknown}[]> {
	const esq = await leerEsquema(q);
	const guardados = esq.tiene('migraciones_datos')
		? await q(`SELECT id, estado, resultado FROM migraciones_datos`)
		: [];
	const porId = new Map(guardados.map((g) => [g.id, g]));
	return PASOS_MIGRACION.map((p) => ({
		id: p.id,
		estado: porId.get(p.id)?.estado ?? 'sin ejecutar',
		resultado: porId.get(p.id)?.resultado ?? null,
	}));
}

/** Espera a que ningún paso siga pendiente o en curso (el detalle de ventas corre en segundo plano). */
export async function esperarPasos(
	q: Ejecutar,
	opciones: {tiempoMaxMs?: number; cadaMs?: number; alAvanzar?: (texto: string) => void} = {},
) {
	const limite = Date.now() + (opciones.tiempoMaxMs ?? 30 * 60_000);
	for (;;) {
		const pasos = await estadoPasos(q);
		const pendientes = pasos.filter((p) => p.estado === 'en_progreso' || p.estado === 'sin ejecutar');
		opciones.alAvanzar?.(pasos.map((p) => `${p.id}=${p.estado}`).join(' · '));
		if (!pendientes.length || Date.now() > limite) return pasos;
		await new Promise((r) => setTimeout(r, opciones.cadaMs ?? 3000));
	}
}

export async function verificarMigracion(q: Ejecutar, base?: LineaBase | null): Promise<ResultadoVerificacion> {
	const esq = await leerEsquema(q);
	const pruebas: Prueba[] = [];
	const registrar = (id: string, titulo: string, estado: EstadoPrueba, detalle?: string): void => {
		pruebas.push({id, titulo, estado, detalle});
	};
	const intentar = async (id: string, titulo: string, fn: () => Promise<void>) => {
		try {
			await fn();
		} catch (error) {
			registrar(id, titulo, 'falla', `Error al verificar: ${(error as Error)?.message ?? error}`);
		}
	};

	// ── 1. Esquema y pasos ──
	await intentar('esquema', 'El esquema nuevo existe completo', async () => {
		const faltan = ESQUEMA_NUEVO.filter((e) => !esq.tiene(e.tabla, e.columna)).map((e) =>
			e.columna ? `${e.tabla}.${e.columna}` : e.tabla,
		);
		registrar(
			'esquema',
			'El esquema nuevo existe completo',
			faltan.length ? 'falla' : 'ok',
			faltan.length ? `Faltan: ${faltan.join(', ')}` : undefined,
		);
	});

	await intentar('pasos', 'Las migraciones de datos terminaron', async () => {
		const pasos = await estadoPasos(q);
		const mal = pasos.filter((p) => p.estado === 'error' || p.estado === 'sin ejecutar');
		const enCurso = pasos.filter((p) => p.estado === 'en_progreso');
		registrar(
			'pasos',
			'Las migraciones de datos terminaron',
			mal.length ? 'falla' : enCurso.length ? 'aviso' : 'ok',
			mal.length
				? `Con problema: ${mal.map((p) => `${p.id} (${p.estado}${(p.resultado as {error?: string})?.error ? `: ${(p.resultado as {error?: string}).error}` : ''})`).join('; ')}`
				: enCurso.length
					? `Siguen en segundo plano: ${enCurso.map((p) => p.id).join(', ')}. Vuelve a correr con --esperar.`
					: pasos.map((p) => `${p.id}: ok`).join(' · '),
		);
	});

	// ── 2. Nada de lo existente cambió (contra la línea base) ──
	const ahora = base ? await capturarLineaBase(q) : null;
	if (base && ahora) {
		await intentar('filas', 'Mismo número de filas en cada tabla', async () => {
			const msgs = TABLAS_SIN_CAMBIOS.filter(
				(t) => base.tablas[t] !== undefined && base.tablas[t] !== ahora.tablas[t],
			).map((t) => `${t}: ${base.tablas[t]} → ${ahora.tablas[t]}`);
			registrar(
				'filas',
				'Mismo número de filas en cada tabla',
				msgs.length ? 'falla' : 'ok',
				msgs.length
					? `${msgs.join(' | ')} (si se vendió algo entre la línea base y ahora, es esperable: repite la línea base sin ventas)`
					: undefined,
			);
		});
		await intentar('dinero', 'El dinero por mes no cambió', async () => {
			const {estrictas, bajas, subidas} = compararDinero(base.ventasPorMes, ahora.ventasPorMes);
			registrar(
				'dinero',
				'Facturas, facturado, cobrado y por cobrar idénticos en cada mes',
				estrictas.length ? 'falla' : 'ok',
				estrictas.length ? resumen(estrictas) : `${base.ventasPorMes.length} meses comparados`,
			);
			registrar(
				'reparto-por-medio',
				'El reparto efectivo / QR solo se completa (nunca baja)',
				bajas.length ? 'falla' : subidas.length ? 'aviso' : 'ok',
				bajas.length
					? resumen(bajas)
					: subidas.length
						? `Subió porque facturas-montos-v1 completó pagos mixtos con una sola parte conocida: ${resumen(subidas)}`
						: undefined,
			);
		});
		await intentar('gastos', 'Los egresos por mes no cambiaron', async () => {
			const msgs = diferencias(
				base.gastosPorMes as unknown as Fila[],
				ahora.gastosPorMes as unknown as Fila[],
				'mes',
			);
			registrar(
				'gastos',
				'Egresos por mes idénticos',
				msgs.length ? 'falla' : 'ok',
				msgs.length ? resumen(msgs) : undefined,
			);
		});
		await intentar('lineas', 'Las líneas de venta por mes no cambiaron', async () => {
			const msgs = diferencias(
				base.lineasPorMes as unknown as Fila[],
				ahora.lineasPorMes as unknown as Fila[],
				'mes',
			);
			registrar(
				'lineas',
				'Líneas de venta por mes idénticas (cantidad y valor)',
				msgs.length ? 'falla' : 'ok',
				msgs.length ? resumen(msgs) : undefined,
			);
		});
		await intentar('caja', 'La caja no cambió', async () => {
			const msgs = diferencias(
				base.cajaPorTipo as unknown as Fila[],
				ahora.cajaPorTipo as unknown as Fila[],
				'tipo',
			);
			registrar(
				'caja',
				'Movimientos de caja idénticos por tipo',
				msgs.length ? 'falla' : 'ok',
				msgs.length ? resumen(msgs) : undefined,
			);
		});
		await intentar('huellas', 'Las columnas intocables siguen idénticas', async () => {
			const msgs = Object.keys(base.huellas)
				.filter((t) => base.huellas[t] !== ahora.huellas[t])
				.map((t) => t);
			registrar(
				'huellas',
				'Huella (md5) de las columnas que la migración no toca',
				msgs.length ? 'falla' : 'ok',
				msgs.length ? `Cambiaron: ${msgs.join(', ')}` : `${Object.keys(base.huellas).length} tablas`,
			);
		});
		await intentar('precios-catalogo', 'Los precios del menú no cambiaron', async () => {
			const msgs = diferencias(
				base.catalogo.variantes as unknown as Fila[],
				ahora.catalogo.variantes as unknown as Fila[],
				'id',
			);
			registrar(
				'precios-catalogo',
				'Precio de cada variante del menú idéntico',
				msgs.length ? 'falla' : 'ok',
				msgs.length ? resumen(msgs) : `${base.catalogo.variantes.length} variantes`,
			);
		});
		await intentar('sabores-catalogo', 'Los sabores originales siguen', async () => {
			const despues = new Map(ahora.catalogo.sabores.map((s) => [s.id, s]));
			const msgs: string[] = [];
			for (const s of base.catalogo.sabores) {
				const d = despues.get(s.id);
				if (!d) msgs.push(`${s.nombre} (${s.tipo}): desapareció`);
				else if (s.tipo === 'especial' && JSON.stringify(s.recargos) !== JSON.stringify(d.recargos))
					msgs.push(`${s.nombre}: recargo ${s.recargos.join('/')} → ${d.recargos.join('/')}`);
				else if (s.tipo === 'configuracion' && JSON.stringify(s.recargos) !== JSON.stringify(d.recargos))
					msgs.push(`${s.nombre}: la fila de configuración cambió`);
			}
			const creados =
				(
					(await q(`SELECT resultado FROM migraciones_datos WHERE id = 'sabor-grupos-v1'`))[0]?.resultado as
						| {saboresCalzoneCreados?: string[]}
						| undefined
				)?.saboresCalzoneCreados ?? [];
			const nuevos = (ahora.tablas.pizza_sabores ?? 0) - (base.tablas.pizza_sabores ?? 0);
			if (nuevos !== creados.length)
				msgs.push(
					`pizza_sabores creció en ${nuevos} filas y el paso reporta ${creados.length} sabores de calzone creados`,
				);
			registrar(
				'sabores-catalogo',
				'Ningún sabor desapareció, los recargos de los especiales siguen y solo se agregaron los del calzone',
				msgs.length ? 'falla' : 'ok',
				msgs.length
					? resumen(msgs)
					: creados.length
						? `Sabores nuevos del Calzone: ${creados.join(', ')}`
						: undefined,
			);
		});
	} else {
		registrar(
			'linea-base',
			'Comparación contra la línea base',
			'aviso',
			'No se dio --base: se omiten las comparaciones de dinero, filas y huellas (las más importantes).',
		);
	}

	// ── 3. Lo transformado quedó bien ──
	await intentar('categorias', 'Todos los productos tienen categoría', async () => {
		if (!esq.tiene('productos', 'categoria'))
			return registrar(
				'categorias',
				'Todos los productos tienen categoría',
				'falla',
				'No existe productos.categoria',
			);
		const sin = await numero(q, `SELECT COUNT(*)::int FROM productos WHERE categoria IS NULL`);
		registrar(
			'categorias',
			'Todos los productos tienen categoría',
			sin ? 'falla' : 'ok',
			sin ? `${sin} productos sin categoría` : undefined,
		);
	});

	await intentar('grupos', 'Grupos de sabores asignados', async () => {
		if (!esq.tiene('sabor_grupos') || !esq.tiene('pizza_sabores', 'grupo_id'))
			return registrar('grupos', 'Grupos de sabores asignados', 'falla', 'No existe el esquema de grupos');
		const grupos = await q(
			`SELECT g.nombre, (SELECT COUNT(*) FROM pizza_sabores s WHERE s.grupo_id = g.id AND s.activo)::int AS sabores,
				(SELECT COUNT(*) FROM productos p WHERE p.sabor_grupo_id = g.id)::int AS productos FROM sabor_grupos g ORDER BY g.id`,
		);
		const sueltos = await numero(
			q,
			`SELECT COUNT(*)::int FROM pizza_sabores WHERE grupo_id IS NULL AND activo AND tipo IS DISTINCT FROM 'configuracion'`,
		);
		const vacios = grupos.filter((g) => !Number(g.sabores));
		const sinTamano = esq.tiene('producto_variantes', 'tamano')
			? await numero(
					q,
					`SELECT COUNT(*)::int FROM producto_variantes v JOIN productos p ON p.producto_id = v.producto_id JOIN sabor_grupos g ON g.id = p.sabor_grupo_id
					 WHERE g.usa_tamano AND v.tamano IS NULL`,
				)
			: 0;
		registrar(
			'grupos',
			'Cada grupo tiene sabores y productos; ningún sabor activo quedó sin grupo',
			!grupos.length || vacios.length || sueltos ? 'falla' : sinTamano ? 'aviso' : 'ok',
			`${grupos.map((g) => `${g.nombre}: ${g.sabores} sabores, ${g.productos} productos`).join(' · ') || 'sin grupos'}` +
				`${sueltos ? ` · ${sueltos} sabores activos sin grupo` : ''}` +
				`${vacios.length ? ` · grupos SIN sabores: ${vacios.map((g) => g.nombre).join(', ')}` : ''}` +
				`${sinTamano ? ` · ${sinTamano} variantes de pizza sin tamaño explícito (se cobran por nombre, como antes)` : ''}`,
		);
	});

	await intentar('precios-sabores', 'El precio de cada pizza es el de antes', async () => {
		const r = await compararPreciosSabores(q);
		if (r.omitido)
			return registrar('precios-sabores', 'El precio de cada pizza es el de antes', 'falla', r.omitido);
		registrar(
			'precios-sabores',
			'El precio de cada pizza es el de antes (fórmula anterior = fórmula nueva)',
			r.diferencias.length ? 'falla' : 'ok',
			r.diferencias.length
				? `${r.diferencias.length} de ${r.combinaciones} combinaciones difieren. Ej.: ${r.diferencias
						.slice(0, 3)
						.map((d) => `${d.producto} ${d.variante} [${d.sabores.join(' + ')}] ${d.antes} → ${d.ahora}`)
						.join(' | ')}`
				: `${r.combinaciones.toLocaleString('es-CO')} combinaciones de ${r.productos.join(', ') || '—'} comparadas`,
		);
	});

	await intentar('montos', 'Facturas pagadas con montos completos', async () => {
		if (!esq.tiene('facturas_ventas', 'monto_pagado')) return;
		const sin = await numero(
			q,
			`SELECT COUNT(*)::int FROM facturas_ventas WHERE estado IN ('pagado', 'pagada') AND total IS NOT NULL AND (monto_pagado IS NULL OR pago_efectivo IS NULL OR pago_transferencia IS NULL) AND metodo IN ('efectivo', 'transferencia', 'qr')`,
		);
		const mixtas = await numero(
			q,
			`SELECT COUNT(*)::int FROM facturas_ventas WHERE estado IN ('pagado', 'pagada') AND metodo = 'efectivo_transferencia' AND (pago_efectivo IS NULL OR pago_transferencia IS NULL OR ABS(pago_efectivo + pago_transferencia - total) > 1)`,
		);
		registrar(
			'montos',
			'Facturas pagadas con monto_pagado y desglose completos',
			sin ? 'falla' : mixtas ? 'aviso' : 'ok',
			sin
				? `${sin} facturas pagadas siguen con montos en NULL`
				: mixtas
					? `${mixtas} pagos mixtos sin desglose que cuadre (corregir a mano)`
					: undefined,
		);
	});

	await intentar('cuentas', 'Facturas con cuenta enlazada por id', async () => {
		if (!esq.tiene('facturas_ventas', 'cuenta_transferencia_id')) return;
		const nombres = await q(
			`SELECT btrim(cuenta_transferencia_nombre) AS nombre, COUNT(*)::int AS facturas FROM facturas_ventas
			 WHERE cuenta_transferencia_id IS NULL AND NULLIF(btrim(cuenta_transferencia_nombre), '') IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
		);
		registrar(
			'cuentas',
			'Toda factura con nombre de cuenta reconocible quedó enlazada por id',
			nombres.length ? 'aviso' : 'ok',
			nombres.length
				? `Nombres sin cuenta en la tabla: ${nombres.map((n) => `${n.nombre} (${n.facturas})`).join(', ')}`
				: undefined,
		);
	});

	await intentar('huerfanos', 'Sin domicilios con repartidor inexistente', async () => {
		if (!esq.tiene('domicilios', 'telefono_domiciliario_asignado') || !esq.tiene('domiciliarios')) return;
		const n = await numero(
			q,
			`SELECT COUNT(*)::int FROM domicilios d WHERE d.telefono_domiciliario_asignado IS NOT NULL AND NOT EXISTS (SELECT 1 FROM domiciliarios m WHERE m.telefono = d.telefono_domiciliario_asignado)`,
		);
		registrar(
			'huerfanos',
			'Ningún domicilio apunta a un repartidor que no existe',
			n ? 'falla' : 'ok',
			n ? `${n} domicilios huérfanos` : undefined,
		);
	});

	await intentar('inventario', 'El inventario anterior pasó completo', async () => {
		if (!esq.tiene('inventario_items'))
			return registrar(
				'inventario',
				'El inventario anterior pasó completo',
				'falla',
				'No existe inventario_items',
			);
		const msgs: string[] = [];
		if (base) {
			const items = await q(`SELECT origen, cantidad, tipo, activo FROM inventario_items`);
			const porOrigen = new Map(items.map((i) => [i.origen, i]));
			for (const c of base.inventario.cajas) {
				const item = porOrigen.get(`caja:${c.id}`);
				if (!item) msgs.push(`caja "${c.nombre}" no pasó`);
				else if (Number(item.cantidad) !== Math.max(0, c.cantidad))
					msgs.push(`caja "${c.nombre}": ${c.cantidad} → ${item.cantidad}`);
			}
			for (const b of base.inventario.stockBebidas) {
				const item = porOrigen.get(`variante:${b.varianteId}`);
				if (!item) msgs.push(`bebida variante ${b.varianteId} (stock ${b.stock}) no pasó`);
				else if (Number(item.cantidad) !== Math.max(0, b.stock))
					msgs.push(`bebida variante ${b.varianteId}: ${b.stock} → ${item.cantidad}`);
			}
		}
		const reglas = await numero(q, `SELECT COUNT(*)::int FROM inventario_consumos`);
		const migracion = await q(
			`SELECT estado, resultado FROM migraciones_datos WHERE id = 'inventario-unificado-v1'`,
		);
		const corte = (migracion[0]?.resultado as {fechaCorte?: string} | undefined)?.fechaCorte;
		registrar(
			'inventario',
			'Cajas y bebidas con el mismo saldo que antes, reglas de consumo creadas y fecha de corte registrada',
			msgs.length ? 'falla' : !reglas || !corte ? 'aviso' : 'ok',
			msgs.length
				? resumen(msgs)
				: `${reglas} reglas de consumo${corte ? `, fecha de corte ${corte}` : ' (SIN fecha de corte: /inventario/* responde 503)'}${base ? '' : ' (sin línea base no se compararon saldos)'}`,
		);
	});

	await intentar('detalle-ventas', 'Detalle estructurado del histórico de ventas', async () => {
		if (!esq.tiene('ordenes_productos', 'detalle_version'))
			return registrar(
				'detalle-ventas',
				'Detalle estructurado del histórico de ventas',
				'falla',
				'No existe detalle_version',
			);
		const [r] = await q(
			`SELECT COUNT(*)::int AS total,
				COUNT(*) FILTER (WHERE detalle_version IS NULL)::int AS pendientes,
				COUNT(*) FILTER (WHERE detalle_version = 'v1-error')::int AS errores,
				COUNT(*) FILTER (WHERE detalle_version IS NOT NULL AND "productoObjProductoId" IS NULL)::int AS sin_producto,
				COUNT(*) FILTER (WHERE categoria = 'pizza' AND tamano IS NULL)::int AS pizza_sin_tamano
			 FROM ordenes_productos`,
		);
		const sabores = esq.tiene('ordenes_productos_sabores')
			? (
					await q(
						`SELECT COUNT(*)::int AS filas, COUNT(*) FILTER (WHERE sabor_id IS NULL)::int AS sin_clasificar FROM ordenes_productos_sabores`,
					)
				)[0]
			: {filas: 0, sin_clasificar: 0};
		const malaFraccion = esq.tiene('ordenes_productos_sabores')
			? await numero(
					q,
					`SELECT COUNT(*)::int FROM (SELECT orden_producto_id FROM ordenes_productos_sabores GROUP BY 1 HAVING ABS(SUM(fraccion) - 1) > 0.01) x`,
				)
			: 0;
		const total = Number(r.total);
		registrar(
			'detalle-ventas',
			'Cada línea tiene su detalle estructurado (producto, tamaño, sabores)',
			malaFraccion ? 'falla' : Number(r.pendientes) ? 'aviso' : Number(r.errores) ? 'aviso' : 'ok',
			`${total.toLocaleString('es-CO')} líneas: ${r.pendientes} pendientes, ${r.errores} con error, ${r.sin_producto} sin producto reconocido, ` +
				`${r.pizza_sin_tamano} pizzas sin tamaño; ${sabores.filas} sabores asignados (${sabores.sin_clasificar} sin clasificar). ` +
				`${malaFraccion ? `${malaFraccion} líneas cuyas fracciones de sabor no suman 1. ` : ''}` +
				`${Number(r.pendientes) ? 'El proceso sigue en segundo plano: repite con --esperar.' : ''}`.trim(),
		);
	});

	// ── 5. La analítica nueva da las mismas cifras que el SQL directo ──
	await intentar('analitica', 'La analítica nueva coincide con la línea base', async () => {
		if (!base || !base.ventasPorMes.length) return;
		const servicio = new AnaliticaService({query: (sql: string, params: unknown[]) => q(sql, params)} as never);
		const msgs: string[] = [];
		const meses = base.ventasPorMes.filter((m) => m.validas > 0).slice(-3);
		for (const m of meses) {
			const [anio, mes] = m.mes.split('-').map(Number);
			const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
			const r = await servicio.resumenGeneral(`${m.mes}-01`, `${m.mes}-${String(ultimo).padStart(2, '0')}`);
			if (Math.round(r.ventas.facturado) !== m.facturado)
				msgs.push(`${m.mes} facturado ${m.facturado} vs analítica ${Math.round(r.ventas.facturado)}`);
			if (Math.round(r.ventas.cobrado) !== m.cobrado)
				msgs.push(`${m.mes} cobrado ${m.cobrado} vs analítica ${Math.round(r.ventas.cobrado)}`);
		}
		registrar(
			'analitica',
			'GET /estadisticas/resumen = SQL directo (últimos 3 meses)',
			msgs.length ? 'aviso' : 'ok',
			msgs.length ? resumen(msgs) : `${meses.length} meses`,
		);
	});

	const fallas = pruebas.filter((p) => p.estado === 'falla').length;
	return {
		generadaEn: new Date().toISOString(),
		pruebas,
		fallas,
		avisos: pruebas.filter((p) => p.estado === 'aviso').length,
		ok: fallas === 0,
	};
}

const ICONO: Record<EstadoPrueba, string> = {ok: '✅', falla: '❌', aviso: '⚠️ '};

export function formatearVerificacion(r: ResultadoVerificacion): string {
	const lineas = [
		`VERIFICACIÓN POSTERIOR A LA MIGRACIÓN — ${r.generadaEn}`,
		`${r.pruebas.length - r.fallas - r.avisos} correctas · ${r.avisos} avisos · ${r.fallas} fallas`,
		r.ok
			? 'Sin fallas: la migración conservó todo.'
			: '>>> HAY FALLAS: no reabrir el local; evaluar el plan de reversa. <<<',
		'',
	];
	for (const p of r.pruebas) {
		lineas.push(`${ICONO[p.estado]} [${p.id}] ${p.titulo}`);
		if (p.detalle) lineas.push(`      ${p.detalle}`);
	}
	return lineas.join('\n');
}
