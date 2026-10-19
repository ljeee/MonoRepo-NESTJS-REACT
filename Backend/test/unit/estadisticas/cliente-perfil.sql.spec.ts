import * as fs from 'fs';
import * as path from 'path';
import {PGlite} from '@electric-sql/pglite';
import {perfilCliente, telefonoLocal} from '../../../src/estadisticas/analitica/cliente-perfil';

/**
 * Perfil de cliente contra PostgreSQL real (PGlite): se enlaza SOLO por teléfono (nunca por nombre), respeta las
 * definiciones de venta válida / cobrado / por cobrar y las cifras no se truncan aunque se listen pocas órdenes.
 */
describe('Perfil de cliente contra PostgreSQL (PGlite)', () => {
	let pg: PGlite;
	const consultar = async <T>(sql: string, params: unknown[]) => (await pg.query(sql, params as any[])).rows as T[];
	const TEL = '3001234567';

	beforeAll(async () => {
		pg = new PGlite();
		await pg.exec(`SET TIME ZONE 'America/Bogota';`);
		await pg.exec(fs.readFileSync(path.join(__dirname, 'fixtures/schema.sql'), 'utf8'));
		await pg.exec(`
			INSERT INTO productos (producto_nombre, categoria) VALUES ('Pizza', 'pizza'), ('Gaseosa', 'bebida');
			INSERT INTO pizza_sabores (nombre) VALUES ('Paisa'), ('Carnes');

			-- 1: pagada en efectivo, teléfono con +57 y espacios (mismo cliente)
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_efectivo, cliente_nombre, telefono_cliente)
			VALUES ('2026-05-01 12:00:00-05', 'pagado', 'efectivo', 50000, 50000, 50000, 'Juan', '+57 300 123 4567');
			INSERT INTO ordenes (factura_id, tipo_pedido, estado_orden, fecha_orden, canal) VALUES (1, 'domicilio', 'completada', '2026-05-01 12:00:00-05', 'pos');
			INSERT INTO ordenes_productos (orden_id, producto, cantidad, precio_unitario, producto_base, variante_nombre, tamano, categoria) VALUES
				(1, 'Pizza - Grande (Paisa + Carnes)', 1, 45000, 'Pizza', 'Grande', 'grande', 'pizza'),
				(1, 'Gaseosa - Personal', 1, 5000, 'Gaseosa', 'Personal', NULL, 'bebida');
			INSERT INTO ordenes_productos_sabores (orden_producto_id, sabor_id, sabor_nombre, posicion, fraccion) VALUES (1, 1, 'Paisa', 1, 0.5), (1, 2, 'Carnes', 2, 0.5);

			-- 2: parcial (20k de 60k), encontrada por el teléfono del DOMICILIO (la factura no trae teléfono)
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_efectivo, cliente_nombre)
			VALUES ('2026-05-11 12:00:00-05', 'parcial', NULL, 60000, 20000, 20000, 'Juan');
			INSERT INTO ordenes (factura_id, tipo_pedido, estado_orden, fecha_orden, canal) VALUES (2, 'domicilio', 'pendiente', '2026-05-11 12:00:00-05', 'whatsapp');
			INSERT INTO ordenes_productos (orden_id, producto, cantidad, precio_unitario, producto_base, variante_nombre, tamano, categoria) VALUES
				(2, 'Pizza - Grande (Paisa)', 1, 60000, 'Pizza', 'Grande', 'grande', 'pizza');
			INSERT INTO ordenes_productos_sabores (orden_producto_id, sabor_id, sabor_nombre, posicion, fraccion) VALUES (3, 1, 'Paisa', 1, 1);
			INSERT INTO domicilios (factura_id, orden_id, telefono) VALUES (2, 2, '3001234567');

			-- 3: cancelada (no es venta válida)
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, cliente_nombre, telefono_cliente)
			VALUES ('2026-05-15 12:00:00-05', 'cancelado', 'efectivo', 99000, 'Juan', '3001234567');

			-- 4: pendiente cuya ORDEN está cancelada (tampoco es venta válida)
			INSERT INTO facturas_ventas ("fechaFactura", estado, total, cliente_nombre, telefono_cliente)
			VALUES ('2026-05-16 12:00:00-05', 'pendiente', 77000, 'Juan', '3001234567');
			INSERT INTO ordenes (factura_id, tipo_pedido, estado_orden, fecha_orden) VALUES (4, 'mesa', 'cancelado', '2026-05-16 12:00:00-05');

			-- 5: OTRO Juan (otro teléfono): jamás debe aparecer en el perfil
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, cliente_nombre, telefono_cliente)
			VALUES ('2026-05-02 12:00:00-05', 'pagado', 'efectivo', 888000, 888000, 'Juan', '3119999999');
			-- 6: factura a nombre "Juan" sin teléfono: tampoco
			INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, cliente_nombre)
			VALUES ('2026-05-03 12:00:00-05', 'pagado', 'efectivo', 444000, 444000, 'Juan');
		`);
	});

	afterAll(() => pg.close());

	it('telefonoLocal deja los 10 dígitos locales', () => {
		expect(telefonoLocal('+57 300 123 4567')).toBe('3001234567');
		expect(telefonoLocal('3001234567')).toBe('3001234567');
		expect(telefonoLocal(null)).toBe('');
	});

	it('suma solo ventas válidas del cliente: cobrado, por cobrar y ticket con las definiciones compartidas', async () => {
		const p = await perfilCliente(consultar, '+573001234567');

		expect(p.totalOrdenes).toBe(4); // 1, 2, 3 (cancelada) y 4 (orden cancelada)
		expect(p.completadas).toBe(2);
		expect(p.canceladas).toBe(2);
		expect(p.gastoTotal).toBe(110000); // 50.000 + 60.000
		expect(p.cobrado).toBe(70000); // 50.000 + abono de 20.000
		expect(p.porCobrar).toBe(40000);
		expect(p.ticketPromedio).toBe(55000);
		expect(p.pedidoMaximo).toBe(60000);
	});

	it('no mezcla a otro cliente con el mismo nombre ni facturas sin teléfono', async () => {
		const p = await perfilCliente(consultar, TEL);

		expect(p.ordenes.map((o) => o.facturaId).sort()).toEqual([1, 2, 3, 4]);
		expect(p.gastoTotal).toBeLessThan(200000);
	});

	it('hábitos y favoritos salen de los datos estructurados', async () => {
		const p = await perfilCliente(consultar, TEL);

		expect(p.tipoPedidoFavorito).toBe('domicilio');
		expect(p.tamanoHabitual).toBe('grande');
		expect(p.productosTop[0]).toMatchObject({nombre: 'Pizza - Grande', cantidad: 2, gastoTotal: 105000});
		expect(p.saboresTop[0]).toEqual({nombre: 'Paisa', pizzas: 2});
		expect(p.diasEntrePedidos).toBe(10); // 1 de mayo → 11 de mayo, 2 pedidos válidos
	});

	it('lista las órdenes recientes con su saldo y líneas; las cifras no dependen del límite', async () => {
		const p = await perfilCliente(consultar, TEL, 2);

		expect(p.ordenes).toHaveLength(2);
		expect(p.hayMasOrdenes).toBe(true);
		expect(p.gastoTotal).toBe(110000);
		const abonada = (await perfilCliente(consultar, TEL)).ordenes.find((o) => o.facturaId === 2)!;
		expect(abonada).toMatchObject({estadoFactura: 'parcial', cobrado: 20000, porCobrar: 40000, canal: 'whatsapp'});
		expect(abonada.productos).toHaveLength(1);
	});

	it('un teléfono sin compras devuelve ceros, no error', async () => {
		const p = await perfilCliente(consultar, '3000000000');

		expect(p).toMatchObject({totalOrdenes: 0, gastoTotal: 0, ticketPromedio: 0, diasEntrePedidos: null, ordenes: []});
	});
});
