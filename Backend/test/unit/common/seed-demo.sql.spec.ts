import * as fs from 'fs';
import * as path from 'path';
import {PGlite} from '@electric-sql/pglite';
import {AnaliticaService} from '../../../src/estadisticas/analitica/analitica.service';
import {perfilCliente} from '../../../src/estadisticas/analitica/cliente-perfil';
import {sqlCobrado, sqlFacturaValida} from '../../../src/common/domain/ventas';
import {cargarCatalogo} from '../../../src/common/seeders/demo/catalogo';
import {borrarDatosDemo, escribirDatosDemo, hayDatosDemo, type Ejecutar} from '../../../src/common/seeders/demo/escritor';
import {generarDatosDemo} from '../../../src/common/seeders/demo/generador';

/**
 * El seeder de demostración contra PostgreSQL real (PGlite): lo que genera debe ser coherente con las definiciones
 * de dinero del sistema (cobrado, por cobrar, desglose por cuenta, caja) y con la analítica y el perfil de cliente,
 * ser reproducible con la misma semilla y poder borrarse sin dejar rastro.
 */
describe('Seeder de demostración contra PostgreSQL (PGlite)', () => {
	let pg: PGlite;
	const q: Ejecutar = async (sql, params) => (await pg.query(sql, (params ?? []) as any[])).rows as any[];
	const AHORA = new Date('2026-06-15T15:00:00-05:00'); // lunes 3 pm en Bogotá
	const DIAS = 20;

	beforeAll(async () => {
		pg = new PGlite();
		await pg.exec(`SET TIME ZONE 'America/Bogota';`);
		await pg.exec(fs.readFileSync(path.join(__dirname, '../estadisticas/fixtures/schema.sql'), 'utf8'));
		// Lo que el fixture de la analítica no trae y el seeder sí usa.
		await pg.exec(`
			ALTER TABLE producto_variantes ADD COLUMN IF NOT EXISTS tamano varchar(20);
			ALTER TABLE sabor_grupos ADD COLUMN IF NOT EXISTS max_sabores int DEFAULT 3, ADD COLUMN IF NOT EXISTS variante_es_sabor boolean DEFAULT false,
				ADD COLUMN IF NOT EXISTS usa_tamano boolean DEFAULT false, ADD COLUMN IF NOT EXISTS recargo_extra_desde int,
				ADD COLUMN IF NOT EXISTS recargo_extra_pequena numeric DEFAULT 0, ADD COLUMN IF NOT EXISTS recargo_extra_mediana numeric DEFAULT 0,
				ADD COLUMN IF NOT EXISTS recargo_extra_grande numeric DEFAULT 0, ADD COLUMN IF NOT EXISTS activo boolean DEFAULT true;
			ALTER TABLE domiciliarios ADD COLUMN IF NOT EXISTS ultima_latitud float, ADD COLUMN IF NOT EXISTS ultima_longitud float,
				ADD COLUMN IF NOT EXISTS ultima_ubicacion_fecha timestamptz;
			ALTER TABLE domicilios ADD COLUMN IF NOT EXISTS referencia_domicilio text;
			ALTER TABLE facturas_ventas ADD COLUMN IF NOT EXISTS ip_dispositivo text, ADD COLUMN IF NOT EXISTS idempotency_key text UNIQUE;
			ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS usuario_cancelacion_id text, ADD COLUMN IF NOT EXISTS fecha_cancelacion timestamptz,
				ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
			CREATE TABLE empresa_config (id serial PRIMARY KEY, nit text, razon_social text, nombre_comercial text, regimen text, direccion text,
				telefono text, municipio text, departamento text, arqueo_caja boolean DEFAULT true);
			CREATE TABLE clientes (telefono text PRIMARY KEY, cliente_nombre text, tipo_documento text, documento text, correo text, password text);
			CREATE TABLE cliente_direcciones (id serial PRIMARY KEY, telefono_cliente text, direccion text, referencia text, costo_domicilio numeric,
				latitud float, longitud float);
			CREATE TABLE caja_movimientos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fecha date, tipo varchar(20), caja_origen varchar(20) DEFAULT 'principal',
				denominaciones jsonb, total numeric, factura_venta_id bigint, factura_pago_id bigint, descripcion text, metodo text,
				pago_transferencia numeric, created_at timestamptz DEFAULT now());
			CREATE TABLE inventario_items (id serial PRIMARY KEY, tipo varchar(20), nombre varchar(150), categoria varchar(30), cantidad int DEFAULT 0,
				alerta_minimo int, nivel_objetivo int, activo boolean DEFAULT true, origen varchar(50) UNIQUE, creado_en timestamptz DEFAULT now(),
				actualizado_en timestamptz DEFAULT now());
			CREATE TABLE inventario_consumos (id serial PRIMARY KEY, item_id int, variante_id int, cantidad int DEFAULT 1, solo_para_llevar boolean DEFAULT false,
				origen varchar(10) DEFAULT 'manual', creado_en timestamptz DEFAULT now(), UNIQUE (variante_id, item_id));
			CREATE TABLE inventario_movimientos (id serial PRIMARY KEY, item_id int, tipo varchar(20), delta int, aplicado int, cantidad_resultante int,
				orden_id int, usuario_id varchar(64), nota varchar(255), creado_en timestamptz DEFAULT now());

			-- Catálogo mínimo, como el que deja el menú real
			INSERT INTO sabor_grupos (nombre, orden, max_sabores, usa_tamano, variante_es_sabor, recargo_extra_desde, recargo_extra_pequena, recargo_extra_mediana, recargo_extra_grande)
				VALUES ('Pizza', 1, 3, true, false, 3, 3000, 3000, 3000), ('Calzone', 2, 2, false, true, NULL, 0, 0, 0);
			INSERT INTO pizza_sabores (nombre, grupo_id, recargo_pequena, recargo_mediana, recargo_grande) VALUES
				('Paisa', 1, 0, 0, 0), ('Carnes', 1, 0, 0, 0), ('Hawaiana', 1, 0, 0, 0), ('Mexicana', 1, 0, 0, 0),
				('Camarón', 1, 4000, 5000, 6000), ('Pollo Champiñones', 1, 0, 0, 0),
				('De Casa', 2, 0, 0, 0), ('Carnes ', 2, 0, 0, 0), ('Napolitana', 2, 0, 0, 0);
			INSERT INTO productos (producto_nombre, categoria, sabor_grupo_id) VALUES
				('Pizza', 'pizza', 1), ('Calzone', 'calzone', 2), ('Hamburguesa', 'comida', NULL), ('GASEOSA', 'bebida', NULL);
			INSERT INTO producto_variantes (producto_id, nombre, precio) VALUES
				(1, 'Grande', 45000), (1, 'Mediana', 32000), (1, 'Pequeña', 17000),
				(2, 'UNIDAD', 25000), (2, 'De Casa', 25000),
				(3, 'Sencilla', 17000), (3, 'Doble Carne', 22000),
				(4, 'Coca Cola Personal', 4000), (4, 'Sprite Personal', 4000), (4, 'AGUA', 4000);
			INSERT INTO domiciliarios (telefono, domiciliario_nombre) VALUES ('3117462406','CARACHO'),('3058545970','GORDITO'),('3194225123','JUANCHO'),('3015324651','FELIPE');
		`);
	}, 60_000);

	afterAll(() => pg.close());

	it('es reproducible: la misma semilla genera exactamente lo mismo', async () => {
		const catalogo = await cargarCatalogo(q);

		const a = generarDatosDemo(catalogo, {ahora: AHORA, dias: DIAS});
		const b = generarDatosDemo(catalogo, {ahora: AHORA, dias: DIAS});
		const otra = generarDatosDemo(catalogo, {ahora: AHORA, dias: DIAS, semilla: 7});

		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
		expect(JSON.stringify(a)).not.toBe(JSON.stringify(otra));
		expect(a.facturas.length).toBeGreaterThan(100);
		expect(a.facturas.every((f) => f.fecha <= AHORA)).toBe(true); // nada en el futuro
	});

	describe('una vez cargado', () => {
		let datos: ReturnType<typeof generarDatosDemo>;
		const R = {from: '2026-05-01', to: '2026-06-15'};

		beforeAll(async () => {
			datos = generarDatosDemo(await cargarCatalogo(q), {ahora: AHORA, dias: DIAS});
			await q('BEGIN');
			await escribirDatosDemo(q, datos, {passwordHash: 'hash-de-prueba', ahora: AHORA});
			await q('COMMIT');
		}, 120_000);

		it('carga cuentas, clientes (uno con contraseña), egresos, caja, inventario y ubicaciones', async () => {
			expect((await q('SELECT nombre FROM cuentas_transferencia ORDER BY id')).map((c) => c.nombre)).toEqual(['Nequi', 'Bancolombia', 'Daviplata']);
			expect(await q("SELECT 1 FROM clientes WHERE telefono LIKE '3102%'")).toHaveLength(14);
			expect(await q("SELECT 1 FROM clientes WHERE password IS NOT NULL")).toHaveLength(1);
			expect((await q('SELECT COUNT(*)::int AS n FROM facturas_pagos'))[0].n).toBe(datos.gastos.length);
			expect(await q("SELECT 1 FROM facturas_pagos WHERE categoria = 'general' AND tipo_gasto IS NULL")).toHaveLength(1); // "sin clasificar"
			expect(await q("SELECT 1 FROM facturas_pagos WHERE metodo = 'qr' AND cuenta_origen_id IS NULL")).toHaveLength(0); // todo QR dice de qué cuenta salió
			expect(await q("SELECT 1 FROM caja_movimientos WHERE tipo = 'apertura'")).not.toHaveLength(0);
			const cajas = await q("SELECT nombre, cantidad FROM inventario_items WHERE tipo = 'caja' ORDER BY id");
			expect(cajas.map((c) => c.cantidad)).toEqual([40, 12, 4, 30]); // ok · bajo · crítico · ok
			expect((await q('SELECT COUNT(*)::int AS n FROM inventario_consumos'))[0].n).toBeGreaterThan(0);
			const gps = await q('SELECT telefono, ultima_ubicacion_fecha FROM domiciliarios WHERE ultima_latitud IS NOT NULL ORDER BY ultima_ubicacion_fecha DESC');
			expect(gps).toHaveLength(3);
			expect(AHORA.getTime() - new Date(gps[0].ultima_ubicacion_fecha).getTime()).toBe(2 * 60_000);
		});

		it('cada factura vale la suma de sus líneas (+ domicilio) y cada orden tiene su factura', async () => {
			const malas = await q(
				`SELECT f.factura_id FROM facturas_ventas f
				 JOIN ordenes o ON o.factura_id = f.factura_id
				 WHERE f.total <> (SELECT COALESCE(SUM(op.precio_unitario * op.cantidad), 0) FROM ordenes_productos op WHERE op.orden_id = o.orden_id)
					+ COALESCE((SELECT SUM(d.costo_domicilio) FROM domicilios d WHERE d.factura_id = f.factura_id), 0)`,
			);
			expect(malas).toEqual([]);
			expect((await q('SELECT COUNT(*)::int AS n FROM ordenes'))[0].n).toBe(datos.facturas.length);
		});

		it('los cobros respetan las definiciones: pagado = total, parcial deja saldo y desglose por cuenta, QR siempre con cuenta', async () => {
			expect(await q(`SELECT 1 FROM facturas_ventas WHERE estado = 'pagado' AND (monto_pagado <> total OR COALESCE(pago_efectivo,0) + COALESCE(pago_transferencia,0) <> total)`)).toEqual([]);
			expect(await q(`SELECT 1 FROM facturas_ventas WHERE estado = 'parcial' AND (monto_pagado >= total OR monto_pagado <> COALESCE(pago_efectivo,0) + COALESCE(pago_transferencia,0))`)).toEqual([]);
			expect(await q(`SELECT 1 FROM facturas_ventas WHERE COALESCE(pago_transferencia,0) > 0 AND cuenta_transferencia_id IS NULL`)).toEqual([]);
			// El reparto por cuenta suma exactamente lo cobrado por QR.
			expect(
				await q(`SELECT 1 FROM facturas_ventas f WHERE desglose_transferencia IS NOT NULL
					AND (SELECT SUM((e->>'monto')::numeric) FROM jsonb_array_elements(f.desglose_transferencia) e) <> f.pago_transferencia`),
			).toEqual([]);
			// Hay de todo para probar: cancelaciones, saldos, abonos y abonos a varias cuentas.
			const estados = (await q('SELECT DISTINCT estado FROM facturas_ventas')).map((r) => r.estado).sort();
			expect(estados).toEqual(['cancelado', 'pagado', 'parcial', 'pendiente']);
			expect(await q(`SELECT 1 FROM facturas_ventas WHERE jsonb_array_length(COALESCE(desglose_transferencia, '[]'::jsonb)) > 1`)).not.toHaveLength(0); // abonos a varias cuentas
			expect(await q(`SELECT 1 FROM facturas_ventas WHERE estado = 'cancelado' AND factura_id NOT IN (SELECT factura_id FROM ordenes WHERE estado_orden = 'cancelado')`)).toEqual([]);
		});

		it('el efectivo cobrado coincide con lo que entró a la caja', async () => {
			const [{dif}] = await q(
				`SELECT COALESCE(SUM(f.pago_efectivo), 0) - (SELECT COALESCE(SUM(total), 0) FROM caja_movimientos WHERE tipo = 'entrada') AS dif
				 FROM facturas_ventas f WHERE f.estado IN ('pagado', 'parcial')`,
			);
			expect(Number(dif)).toBe(0);
		});

		it('las líneas traen el detalle estructurado: pizza con tamaño y sabores que suman una pizza', async () => {
			expect(await q(`SELECT 1 FROM ordenes_productos WHERE producto LIKE 'Pizza%' AND (tamano IS NULL OR categoria <> 'pizza')`)).toEqual([]);
			expect(await q(`SELECT 1 FROM ordenes_productos WHERE producto LIKE 'Calzone%' AND (tamano IS NOT NULL OR categoria <> 'calzone')`)).toEqual([]);
			const sumas = await q(`SELECT orden_producto_id, SUM(fraccion)::float8 AS s FROM ordenes_productos_sabores GROUP BY 1 HAVING ABS(SUM(fraccion) - 1) > 0.001`);
			expect(sumas).toEqual([]);
			// El texto no repite la variante cuando la variante ES el sabor (calzone).
			expect(await q(`SELECT 1 FROM ordenes_productos WHERE producto LIKE 'Calzone - %'`)).toEqual([]);
			// Hay ajustes manuales de precio con su precio de lista.
			expect(await q(`SELECT 1 FROM ordenes_productos WHERE precio_manual AND precio_lista IS NOT NULL AND precio_unitario <> precio_lista`)).not.toHaveLength(0);
		});

		it('hay trabajo en curso para la cocina y domicilios con y sin repartidor', async () => {
			const enMarcha = await q(`SELECT estado_orden FROM ordenes WHERE estado_orden IN ('pendiente','en preparación') AND fecha_orden >= $1`, [new Date(AHORA.getTime() - 3 * 3600_000)]);
			expect(enMarcha.length).toBeGreaterThanOrEqual(5);
			expect(await q(`SELECT 1 FROM domicilios WHERE telefono_domiciliario_asignado IS NULL AND estado_domicilio = 'pendiente'`)).not.toHaveLength(0); // "sin asignar"
			expect(await q(`SELECT 1 FROM domicilios WHERE telefono_domiciliario_asignado IS NOT NULL AND estado_domicilio = 'entregado'`)).not.toHaveLength(0);
			expect(await q(`SELECT 1 FROM domicilios d JOIN ordenes o ON o.orden_id = d.orden_id WHERE o.tipo_pedido <> 'domicilio'`)).toEqual([]);
		});

		it('la analítica y el perfil de cliente dan las mismas cifras que el SQL directo', async () => {
			const svc = new AnaliticaService({query: (sql: string, params: unknown[]) => q(sql, params)} as any);
			const resumen = await svc.resumenGeneral(R.from, R.to);
			const [{facturado, cobrado}] = await q(
				`SELECT COALESCE(SUM(f.total), 0)::float8 AS facturado, COALESCE(SUM(${sqlCobrado('f')}), 0)::float8 AS cobrado
				 FROM facturas_ventas f WHERE ${sqlFacturaValida('f')}`,
			);
			expect(resumen.ventas.facturado).toBeCloseTo(facturado, 0);
			expect(resumen.ventas.cobrado).toBeCloseTo(cobrado, 0);
			expect(resumen.ventas.porCobrar).toBeCloseTo(facturado - cobrado, 0);
			expect(resumen.gastos.total).toBe(datos.gastos.reduce((s, g) => s + g.total, 0));
			
			const primero = datos.clientes[0].telefono;
			const perfil = await perfilCliente(q, primero);
			const [{gasto, debe}] = await q(
				`SELECT COALESCE(SUM(f.total), 0)::float8 AS gasto,
					COALESCE(SUM(CASE WHEN f.estado = 'cancelado' THEN 0 ELSE GREATEST(f.total - ${sqlCobrado('f')}, 0) END), 0)::float8 AS debe
				 FROM facturas_ventas f WHERE f.telefono_cliente = $1 AND ${sqlFacturaValida('f')}`,
				[primero],
			);
			expect(perfil.completadas).toBeGreaterThan(0);
			expect(perfil.gastoTotal).toBeCloseTo(gasto, 0);
			expect(perfil.porCobrar).toBeCloseTo(debe, 0);
			expect(perfil.productosTop.length).toBeGreaterThan(0);
		});

		it('hayDatosDemo detecta la carga y borrarDatosDemo la quita toda, sin tocar lo ajeno', async () => {
			await q("INSERT INTO clientes (telefono, cliente_nombre) VALUES ('3009999999', 'Cliente real')");
			await q("INSERT INTO facturas_ventas (cliente_nombre, total, estado) VALUES ('Venta real', 1000, 'pendiente')");
			expect(await hayDatosDemo(q)).toBe(true);

			await borrarDatosDemo(q);

			expect(await hayDatosDemo(q)).toBe(false);
			expect((await q('SELECT COUNT(*)::int AS n FROM facturas_ventas'))[0].n).toBe(1); // solo la venta "real"
			expect((await q('SELECT COUNT(*)::int AS n FROM ordenes'))[0].n).toBe(0);
			expect((await q('SELECT COUNT(*)::int AS n FROM ordenes_productos'))[0].n).toBe(0);
			expect((await q('SELECT COUNT(*)::int AS n FROM ordenes_productos_sabores'))[0].n).toBe(0);
			expect((await q('SELECT COUNT(*)::int AS n FROM domicilios'))[0].n).toBe(0);
			expect((await q('SELECT COUNT(*)::int AS n FROM caja_movimientos'))[0].n).toBe(0);
			expect((await q('SELECT COUNT(*)::int AS n FROM facturas_pagos'))[0].n).toBe(0);
			expect((await q("SELECT COUNT(*)::int AS n FROM clientes"))[0].n).toBe(1); // el cliente real sigue
			expect((await q("SELECT COUNT(*)::int AS n FROM inventario_items WHERE origen LIKE 'demo:%'"))[0].n).toBe(0);
		});

		it('se puede recargar después de borrar (reset)', async () => {
			await escribirDatosDemo(q, datos, {passwordHash: null, ahora: AHORA});

			expect(await hayDatosDemo(q)).toBe(true);
			expect((await q('SELECT COUNT(*)::int AS n FROM cuentas_transferencia'))[0].n).toBe(3); // las cuentas no se duplican
			expect((await q("SELECT COUNT(*)::int AS n FROM inventario_items WHERE tipo = 'caja'"))[0].n).toBe(4);
		});
	});
});
