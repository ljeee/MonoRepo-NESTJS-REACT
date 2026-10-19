INSERT INTO sabor_grupos (nombre, orden) VALUES ('Pizza',1),('Calzone',2);
INSERT INTO productos (producto_nombre, personalizacion, categoria, sabor_grupo_id) VALUES
 ('Pizza','pizza','pizza',1), ('Calzone','calzone','calzone',2), ('GASEOSA',NULL,NULL,NULL), ('Pizza Burguer',NULL,'comida',NULL);
INSERT INTO producto_variantes (producto_id, nombre, precio) VALUES
 (1,'Grande',45000),(1,'Mediana',32000),(1,'Pequeña',17000),(2,'De Casa',25000),(3,'Coca Cola Personal',4000),(4,'Paisa',20000);
INSERT INTO pizza_sabores (nombre, tipo, grupo_id) VALUES ('Paisa','especial',1),('Carnes','tradicional',1),('Hawaiana','tradicional',1),('De la Casa','tradicional',1),('RECARGO_3_SABORES','configuracion',NULL);
INSERT INTO users (id, username, name) VALUES ('11111111-1111-1111-1111-111111111111','caja1','Caja Uno');
INSERT INTO domiciliarios VALUES ('3110000000','Pedro');
INSERT INTO cuentas_transferencia (nombre) VALUES ('Nequi'),('Bancolombia');
-- Factura 1: pagada efectivo, mesa, 2 pizzas grandes mitad paisa/carnes + gaseosa (detalle v1)
INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, cliente_nombre, telefono_cliente) VALUES ('2026-05-10 13:30:00-05','pagado','efectivo',94000,94000,'Ana','3001112222');
INSERT INTO ordenes (factura_id, tipo_pedido, estado_orden, canal, usuario_creacion_id) VALUES (1,'mesa','completada','pos','11111111-1111-1111-1111-111111111111');
INSERT INTO ordenes_productos (orden_id, producto, cantidad, precio_unitario, variante_id, "productoObjProductoId", producto_base, variante_nombre, tamano, categoria, precio_lista, precio_manual, detalle_version) VALUES
 (1,'Pizza - Grande (Paisa + Carnes)',2,45000,1,1,'Pizza','Grande','grande','pizza',45000,false,'v1'),
 (1,'GASEOSA - Coca Cola Personal',1,4000,5,3,'GASEOSA','Coca Cola Personal',NULL,'bebida',4000,false,'v1');
INSERT INTO ordenes_productos_sabores (orden_producto_id, sabor_id, sabor_nombre, posicion, fraccion) VALUES (1,1,'Paisa',1,0.5),(1,2,'Carnes',2,0.5);
-- Factura 2: mixta, domicilio entregado, pizza mediana hawaiana con precio manual
INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_efectivo, pago_transferencia, cuenta_transferencia_nombre, telefono_cliente) VALUES ('2026-05-11 20:10:00-05','pagado','efectivo_transferencia',33000,33000,13000,20000,'Nequi','3001112222');
INSERT INTO ordenes (factura_id, tipo_pedido, estado_orden, canal) VALUES (2,'domicilio','completada','web');
INSERT INTO ordenes_productos (orden_id, producto, cantidad, precio_unitario, variante_id, "productoObjProductoId", producto_base, variante_nombre, tamano, categoria, precio_lista, precio_manual, detalle_version) VALUES
 (2,'Pizza - Mediana (Hawaiana)',1,28000,2,1,'Pizza','Mediana','mediana','pizza',32000,true,'v1');
INSERT INTO ordenes_productos_sabores (orden_producto_id, sabor_id, sabor_nombre, posicion, fraccion) VALUES (3,3,'Hawaiana',1,1);
INSERT INTO domicilios (factura_id, orden_id, telefono, telefono_domiciliario_asignado, costo_domicilio, estado_domicilio) VALUES (2,2,'3001112222','3110000000',5000,'entregado');
-- Factura 3: parcial (abono 10k QR de 25k), calzone
INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado, pago_transferencia) VALUES ('2026-05-12 12:00:00-05','parcial',NULL,25000,10000,10000);
INSERT INTO ordenes (factura_id, tipo_pedido, estado_orden) VALUES (3,'llevar','pendiente');
INSERT INTO ordenes_productos (orden_id, producto, cantidad, precio_unitario, variante_id, "productoObjProductoId", producto_base, variante_nombre, categoria, detalle_version) VALUES
 (3,'Calzone',1,25000,4,2,'Calzone','De Casa','calzone','v1');
INSERT INTO ordenes_productos_sabores (orden_producto_id, sabor_id, sabor_nombre, posicion, fraccion) VALUES (4,4,'De la Casa',1,1);
-- Factura 4: orden cancelada (no debe contar)
INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total) VALUES ('2026-05-12 18:00:00-05','cancelado','efectivo',45000);
INSERT INTO ordenes (factura_id, tipo_pedido, estado_orden) VALUES (4,'mesa','cancelado');
INSERT INTO ordenes_productos (orden_id, producto, cantidad, precio_unitario, variante_id, categoria, detalle_version) VALUES (4,'Pizza - Grande (Paisa)',1,45000,1,'pizza','v1');
-- Factura 5: importada CSV (sin orden), pagada, monto_pagado NULL
INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado) VALUES ('2026-05-13 10:00:00-05','pagado','qr',50000,NULL);
-- Factura 6: histórico sin detalle (backfill pendiente), legado sin variante
INSERT INTO facturas_ventas ("fechaFactura", estado, metodo, total, monto_pagado) VALUES ('2026-05-14 19:00:00-05','pagado','efectivo',90000,90000);
INSERT INTO ordenes (factura_id, tipo_pedido, estado_orden) VALUES (6,'mesa','completada');
INSERT INTO ordenes_productos (orden_id, producto, cantidad, precio_unitario, variante_id) VALUES
 (5,'pizza grande paisa y carnes',1,45000,NULL),
 (5,'Pizza - Grande (Hawaiana + Marciana)',1,45000,1),
 (5,'Pizza Burguer - Paisa',1,20000,6),
 (5,'Calzone',1,25000,4);
-- Gastos
INSERT INTO facturas_pagos (total, nombre_gasto, estado, fecha_factura, metodo, categoria, tipo_gasto) VALUES (20000,'Queso','pagado','2026-05-10','efectivo','insumos','costo'),(15000,'Gas','pendiente','2026-05-12','qr','servicios','gasto');
