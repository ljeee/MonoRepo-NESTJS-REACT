import {getBogotaDateString} from '../../utils/date.utils';
import type {DatasetDemo, FacturaDemo} from './tipos';

/** Ejecuta SQL parametrizado y devuelve las filas (TypeORM `queryRunner.query` en la app; PGlite en las pruebas). */
export type Ejecutar = (sql: string, params?: unknown[]) => Promise<any[]>;

export interface ResumenEscritura {
	cuentas: number;
	clientes: number;
	facturas: number;
	ordenes: number;
	lineas: number;
	domicilios: number;
	gastos: number;
	movimientosCaja: number;
	itemsInventario: number;
}

export interface OpcionesEscritura {
	/** Hash bcrypt de la contraseña de demostración de los clientes que entran a ClientWeb (null = sin contraseña). */
	passwordHash?: string | null;
	ahora?: Date;
}

/** Marca de las filas de egresos y movimientos de demostración. */
export const MARCA_DEMO = 'DEMO';
/** Las facturas de demostración llevan `idempotency_key = 'demo-N'` (columna única): así se reconocen sin tocar las reales. */
export const PREFIJO_CLAVE_DEMO = 'demo-';

/** ¿Hay datos de demostración cargados? */
export async function hayDatosDemo(q: Ejecutar): Promise<boolean> {
	const filas = await q('SELECT 1 FROM facturas_ventas WHERE idempotency_key LIKE $1 LIMIT 1', [`${PREFIJO_CLAVE_DEMO}%`]);
	return filas.length > 0;
}

/** Borra SOLO lo que creó el seeder de demostración (nunca ventas, clientes ni inventario reales). */
export async function borrarDatosDemo(q: Ejecutar): Promise<void> {
	const facturasDemo = `SELECT factura_id FROM facturas_ventas WHERE idempotency_key LIKE '${PREFIJO_CLAVE_DEMO}%'`;
	const ordenesDemo = `SELECT orden_id FROM ordenes WHERE factura_id IN (${facturasDemo})`;
	const itemsDemo = `SELECT id FROM inventario_items WHERE origen LIKE 'demo:%'`;
	const pasos = [
		`DELETE FROM caja_movimientos WHERE factura_venta_id IN (${facturasDemo}) OR descripcion LIKE '${MARCA_DEMO}%'`,
		`DELETE FROM ordenes_productos_sabores WHERE orden_producto_id IN (SELECT id FROM ordenes_productos WHERE orden_id IN (${ordenesDemo}))`,
		`DELETE FROM ordenes_productos WHERE orden_id IN (${ordenesDemo})`,
		`DELETE FROM domicilios WHERE factura_id IN (${facturasDemo})`,
		`DELETE FROM ordenes WHERE factura_id IN (${facturasDemo})`,
		`DELETE FROM facturas_ventas WHERE idempotency_key LIKE '${PREFIJO_CLAVE_DEMO}%'`,
		`DELETE FROM facturas_pagos WHERE descripcion = '${MARCA_DEMO}'`,
		`DELETE FROM cliente_direcciones WHERE telefono_cliente LIKE '3102%'`,
		`DELETE FROM clientes WHERE telefono LIKE '3102%'`,
		`DELETE FROM inventario_movimientos WHERE item_id IN (${itemsDemo}) OR nota LIKE '${MARCA_DEMO}%'`,
		`DELETE FROM inventario_consumos WHERE item_id IN (${itemsDemo})`,
		`DELETE FROM inventario_items WHERE origen LIKE 'demo:%'`,
	];
	for (const sql of pasos) await q(sql);
}

const json = (v: unknown) => (v == null ? null : JSON.stringify(v));

async function escribirFactura(
	q: Ejecutar,
	f: FacturaDemo,
	cuentaId: (nombre: string | null) => number | null,
	resumen: ResumenEscritura,
): Promise<void> {
	const desglose = f.desglose?.map((d) => ({cuentaId: cuentaId(d.cuenta), cuenta: d.cuenta, monto: d.monto})) ?? null;
	const [factura] = await q(
		`INSERT INTO facturas_ventas
			(cliente_nombre, telefono_cliente, descripcion, "fechaFactura", estado, metodo, pago_efectivo, pago_transferencia,
			 total, usuario_cobro_id, fecha_cobro, ip_dispositivo, idempotency_key, monto_pagado,
			 cuenta_transferencia_id, cuenta_transferencia_nombre, desglose_transferencia)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
		 RETURNING factura_id`,
		[
			f.clienteNombre,
			f.telefonoCliente,
			f.descripcion,
			f.fecha,
			f.estado,
			f.metodo,
			f.pagoEfectivo,
			f.pagoTransferencia,
			f.total,
			f.fechaCobro || f.entradasCaja.length ? 'demo-cajero' : null,
			f.fechaCobro,
			f.fechaCobro ? '127.0.0.1' : null,
			f.clave,
			f.montoPagado,
			cuentaId(f.cuenta),
			f.cuenta,
			json(desglose),
		],
	);
	const facturaId = Number(factura.factura_id);
	resumen.facturas++;

	const o = f.orden;
	const cancelada = o.estadoOrden === 'cancelado';
	const [orden] = await q(
		`INSERT INTO ordenes (factura_id, tipo_pedido, estado_orden, fecha_orden, observaciones, canal, usuario_creacion_id,
			usuario_cancelacion_id, fecha_cancelacion)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING orden_id`,
		[
			facturaId,
			o.tipoPedido,
			o.estadoOrden,
			o.fecha,
			o.observaciones,
			o.canal,
			o.usuarioCreacionId,
			cancelada ? 'demo-cajero' : null,
			cancelada ? new Date(o.fecha.getTime() + 10 * 60_000) : null,
		],
	);
	const ordenId = Number(orden.orden_id);
	resumen.ordenes++;

	for (const l of o.lineas) {
		const [linea] = await q(
			`INSERT INTO ordenes_productos
				(orden_id, producto, cantidad, precio_unitario, variante_id, base, "productoObjProductoId", producto_base,
				 variante_nombre, tamano, categoria, precio_lista, precio_manual, detalle_version)
			 VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,$8,$9,$10,$11,$12,'v1') RETURNING id`,
			[ordenId, l.producto, l.cantidad, l.precioUnitario, l.varianteId, l.productoId, l.productoBase, l.varianteNombre, l.tamano, l.categoria, l.precioLista, l.precioManual],
		);
		resumen.lineas++;
		for (const s of l.sabores) {
			await q(
				`INSERT INTO ordenes_productos_sabores (orden_producto_id, sabor_id, sabor_nombre, posicion, fraccion) VALUES ($1,$2,$3,$4,$5)`,
				[String(linea.id), s.saborId, s.nombre, s.posicion, s.fraccion],
			);
		}
	}

	if (f.domicilio) {
		await q(
			`INSERT INTO domicilios (fecha_creado, factura_id, orden_id, telefono, telefono_domiciliario_asignado, direccion_entrega,
				referencia_domicilio, costo_domicilio, estado_domicilio)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			[f.fecha, facturaId, ordenId, f.domicilio.telefono, f.domicilio.telefonoDomiciliario, f.domicilio.direccion, f.domicilio.referencia, f.domicilio.costo, f.domicilio.estado],
		);
		resumen.domicilios++;
	}

	for (const e of f.entradasCaja) {
		await q(
			`INSERT INTO caja_movimientos (fecha, tipo, caja_origen, denominaciones, total, factura_venta_id, descripcion, metodo, pago_transferencia, created_at)
			 VALUES ($1,'entrada','principal',$2,$3,$4,$5,$6,$7,$8)`,
			[getBogotaDateString(e.fecha), json({coins: e.monto}), e.monto, facturaId, `${MARCA_DEMO} cobro factura #${facturaId}`, e.metodo, e.pagoTransferencia, e.fecha],
		);
		resumen.movimientosCaja++;
	}
}

/**
 * Inserta el dataset. Idempotente a medias: cuentas, clientes, ítems y reglas se reutilizan si ya existen; las
 * ventas y egresos se agregan (el comando principal impide cargarlos dos veces sin `--reset`).
 */
export async function escribirDatosDemo(q: Ejecutar, d: DatasetDemo, opciones: OpcionesEscritura = {}): Promise<ResumenEscritura> {
	const ahora = opciones.ahora ?? new Date();
	const resumen: ResumenEscritura = {
		cuentas: 0, clientes: 0, facturas: 0, ordenes: 0, lineas: 0, domicilios: 0, gastos: 0, movimientosCaja: 0, itemsInventario: 0,
	};

	// Datos del negocio (solo si la tabla está vacía; si el backend ya creó la fila no se toca).
	await q(
		`INSERT INTO empresa_config (nit, razon_social, nombre_comercial, regimen, direccion, telefono, municipio, departamento)
		 SELECT '900000000-1', 'Dfiru Pizzería (demo)', 'Dfiru Pizzería', 'Régimen Simple', 'Calle 1 # 2-3', '3000000000', 'Medellín', 'Antioquia'
		 WHERE NOT EXISTS (SELECT 1 FROM empresa_config)`,
	);

	// Cuentas de transferencia
	const cuentas = new Map<string, number>();
	for (const nombre of d.cuentas) {
		await q(
			`INSERT INTO cuentas_transferencia (nombre) SELECT $1::text WHERE NOT EXISTS (SELECT 1 FROM cuentas_transferencia WHERE lower(nombre) = lower($1::text))`,
			[nombre],
		);
		const [fila] = await q('SELECT id FROM cuentas_transferencia WHERE lower(nombre) = lower($1) ORDER BY id LIMIT 1', [nombre]);
		cuentas.set(nombre, Number(fila.id));
		resumen.cuentas++;
	}
	const cuentaId = (nombre: string | null) => (nombre ? (cuentas.get(nombre) ?? null) : null);

	// Clientes y direcciones
	for (const c of d.clientes) {
		const nuevo = await q(
			`INSERT INTO clientes (telefono, cliente_nombre, correo, password) VALUES ($1,$2,$3,$4) ON CONFLICT (telefono) DO NOTHING RETURNING telefono`,
			[c.telefono, c.nombre, c.correo, c.conPassword ? (opciones.passwordHash ?? null) : null],
		);
		if (!nuevo.length) continue;
		resumen.clientes++;
		for (const dir of c.direcciones) {
			await q(`INSERT INTO cliente_direcciones (telefono_cliente, direccion, referencia, costo_domicilio) VALUES ($1,$2,$3,$4)`, [
				c.telefono, dir.direccion, dir.referencia, dir.costoDomicilio,
			]);
		}
	}

	// Ventas (con sus órdenes, líneas, sabores, domicilios y cobros en efectivo)
	for (const f of d.facturas) await escribirFactura(q, f, cuentaId, resumen);

	// Aperturas de caja
	for (const a of d.aperturas) {
		await q(
			`INSERT INTO caja_movimientos (fecha, tipo, caja_origen, denominaciones, total, descripcion, created_at) VALUES ($1,'apertura','principal',$2,$3,$4,$5)`,
			[a.fecha, json(a.denominaciones), a.total, `${MARCA_DEMO} apertura`, a.instante],
		);
		resumen.movimientosCaja++;
	}

	// Egresos
	for (const g of d.gastos) {
		await q(
			`INSERT INTO facturas_pagos (total, nombre_gasto, descripcion, estado, fecha_factura, metodo, categoria, tipo_gasto, cuenta_origen_id)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			[g.total, g.nombre, MARCA_DEMO, g.estado, g.fecha, g.metodo, g.categoria, g.tipoGasto, cuentaId(g.cuentaOrigen)],
		);
		resumen.gastos++;
	}

	// Inventario: ítems, reglas de consumo y el movimiento de stock inicial
	for (const item of d.stock) {
		const [existente] = await q('SELECT id, cantidad FROM inventario_items WHERE origen = $1', [item.origen]);
		let itemId: number;
		if (existente) {
			itemId = Number(existente.id);
			const delta = item.cantidad - Number(existente.cantidad);
			await q('UPDATE inventario_items SET cantidad = $1, activo = true WHERE id = $2', [item.cantidad, itemId]);
			if (delta !== 0) {
				await q(
					`INSERT INTO inventario_movimientos (item_id, tipo, delta, aplicado, cantidad_resultante, nota) VALUES ($1,'conteo',$2,$2,$3,$4)`,
					[itemId, delta, item.cantidad, `${MARCA_DEMO} conteo inicial`],
				);
			}
		} else {
			const [nuevo] = await q(
				`INSERT INTO inventario_items (tipo, nombre, categoria, cantidad, alerta_minimo, nivel_objetivo, activo, origen)
				 VALUES ($1,$2,$3,$4,$5,$6,true,$7) RETURNING id`,
				[item.tipo, item.nombre, item.categoria, item.cantidad, item.alertaMinimo, item.nivelObjetivo, item.origen],
			);
			itemId = Number(nuevo.id);
			await q(
				`INSERT INTO inventario_movimientos (item_id, tipo, delta, aplicado, cantidad_resultante, nota) VALUES ($1,'entrada',$2,$2,$2,$3)`,
				[itemId, item.cantidad, `${MARCA_DEMO} stock inicial`],
			);
		}
		resumen.itemsInventario++;
		for (const v of item.variantes) {
			await q(
				`INSERT INTO inventario_consumos (item_id, variante_id, cantidad, solo_para_llevar, origen) VALUES ($1,$2,1,$3,'manual')
				 ON CONFLICT (variante_id, item_id) DO NOTHING`,
				[itemId, v.varianteId, v.soloParaLlevar],
			);
		}
	}

	// Ubicación de los domiciliarios (se ven "hace Xm" en Asignar domiciliarios)
	for (const u of d.ubicaciones) {
		await q(
			`UPDATE domiciliarios SET ultima_latitud = $1, ultima_longitud = $2, ultima_ubicacion_fecha = $3 WHERE telefono = $4`,
			[u.latitud, u.longitud, new Date(ahora.getTime() - u.haceMinutos * 60_000), u.telefono],
		);
	}

	return resumen;
}
