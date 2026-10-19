-- DATOS CON LA ESTRUCTURA ANTERIOR (Backend/init.sql). Generado por un script; revisar a mano al editar.
-- Anomalías sembradas a propósito (las que debe detectar la auditoría):
--   · domicilio con repartidor que no existe, con '' y con el repartidor solo en "domiciliarioTelefono"
--   · sabores repetidos (Paisa tradicional/especial) y calzone sin sabores en pizza_sabores
--   · pagos mixtos sin desglose, pagadas sin método, método desconocido, pagadas con montos NULL
--   · datos de prueba del seeder viejo, teléfonos mal formados, usuario sin rol, stock negativo


INSERT INTO productos (producto_id, producto_nombre, descripcion, activo) VALUES
 (1,'Pizza','Elige 1-3 sabores',true),(2,'Calzone','',true),(3,'GASEOSA','',true),(4,'Hamburguesa','',true),
 (5,'Pizza Burguer','',true),(6,'CALZONE DE DOS SABORES','',true),(7,'Jugo','',true),(8,'Adición de Queso','',true);

INSERT INTO producto_variantes (variante_id, producto_id, nombre, precio, activo, stock_bebida) VALUES
 (1,1,'Grande',45000,true,0),(2,1,'Mediana',32000,true,0),(3,1,'Pequeña',17000,true,0),(4,1,'Familiar',60000,true,0),
 (5,2,'Carnes',25000,true,0),(6,2,'De Casa',25000,true,0),(7,2,'Hawaiana',25000,true,0),(8,2,'Mexicana',25000,true,0),
 (9,2,'UNIDAD',25000,true,0),(10,2,'calzone de dos sabores',25000,true,0),
 (11,3,'Coca Cola Personal',4000,true,12),(12,3,'Sprite 1.5L',8000,true,3),(13,3,'AGUA',4000,true,-2),
 (14,4,'Sencilla',17000,true,0),(15,5,'Paisa',20000,true,0),(16,6,'CALZONE DOS SABORES',25000,true,0),
 (17,7,'AGUA',7000,true,0),(18,7,'LECHE',8000,true,0),(19,8,'Grande',12000,true,0);

ALTER TABLE pizza_sabores DROP CONSTRAINT pizza_sabores_nombre_key;
CREATE UNIQUE INDEX "IDX_anterior_tipo_nombre" ON pizza_sabores (tipo, nombre);

INSERT INTO pizza_sabores (nombre, tipo, recargo_pequena, recargo_mediana, recargo_grande, activo) VALUES
 ('Paisa','especial',1000,2000,2500,true),('Paisa','tradicional',0,0,0,true),('Carnes','tradicional',500,500,500,true),
 ('Hawaiana','especial',1500,2500,3000,true),('Mexicana','tradicional',0,0,0,true),('De Casa','tradicional',0,0,0,true),
 ('Jamón y Queso','tradicional',0,0,0,true),('Quesuda','especial',2000,3000,3000,true),('Vegetales','tradicional',0,0,0,false),
 ('RECARGO_3_SABORES','configuracion',3500,0,5000,true);

INSERT INTO clientes (telefono, cliente_nombre) VALUES
 ('3100001111','Carlos Morales'),
 ('3100002222','Luisa Fernández'),
 ('3201112233','Ana Gómez'),
 ('3001112233','Pedro Ruiz'),
 ('+573001112233','Pedro Ruiz (con +57)'),
 ('300 555 6677','Marta Díaz'),
 ('3157778899','Jorge Peña');

INSERT INTO cliente_direcciones (telefono_cliente, direccion) VALUES ('3201112233','Cra 5 # 12-34'),('3157778899','Calle 8 # 3-10');

INSERT INTO users (id, roles, "passwordHash", username, name) VALUES
 ('00000000-0000-0000-0000-000000000001','{admin}','x','admin','Admin'),
 ('00000000-0000-0000-0000-000000000002','{cajero}','x','cajero01','Cajero'),
 ('00000000-0000-0000-0000-000000000003','{domiciliario}','x','3117462406','CARACHO'),
 ('00000000-0000-0000-0000-000000000004','{domiciliario}','x','3999999999','SIN FILA'),
 ('00000000-0000-0000-0000-000000000005','{}','x','sinrol','Sin rol'),
 ('00000000-0000-0000-0000-000000000006','{jefe}','x','jefe01','Rol raro');

INSERT INTO domiciliarios (telefono, domiciliario_nombre) VALUES ('3117462406','CARACHO'),('3058545970','GORDITO');

INSERT INTO empresa_config (id, nit, razon_social, nombre_comercial) VALUES (1,'900000000-1','Dfiru S.A.S','Dfiru Pizzería');

INSERT INTO facturas_ventas (factura_id, cliente_nombre, telefono_cliente, descripcion, estado, metodo, total, "fechaFactura", pago_efectivo, pago_transferencia) VALUES
 (1,'Mesa 3',NULL,'1 Pizza - Grande (Paisa + Carnes), 1 GASEOSA - Coca Cola Personal','pagado','efectivo',51500,'2026-07-04 13:10:00-05',49500,0),
 (2,'Ana Gómez','3201112233','1 Pizza - Mediana (Hawaiana), 1 GASEOSA - Coca Cola Personal','pagado','transferencia',43500,'2026-07-05 19:30:00-05',NULL,38000),
 (3,'Mesa 1',NULL,'1 Pizza - Pequeña (Mexicana)','pagada','efectivo',17000,'2026-07-06 12:00:00-05',NULL,NULL),
 (4,'Jorge Peña','3157778899','1 Pizza - Familiar (Paisa + Hawaiana + Carnes)','pagada','transferencia',72000,'2026-07-12 20:15:00-05',NULL,NULL),
 (5,'Mesa 5',NULL,'1 Pizza - Grande (Quesuda), 1 GASEOSA - Coca Cola Personal','pagado','efectivo_transferencia',52000,'2026-07-18 14:20:00-05',20000,32000),
 (6,'Mesa 2',NULL,'1 Pizza - Mediana (Paisa), 1 GASEOSA - Coca Cola Personal','pagado','efectivo_transferencia',38000,'2026-07-19 14:20:00-05',NULL,20000),
 (7,'Mesa 4',NULL,'1 Pizza - Mediana (De Casa)','pagado','efectivo_transferencia',32000,'2026-07-20 15:00:00-05',NULL,NULL),
 (8,'Mesa 6',NULL,'1 Pizza - Pequeña (De Casa)','pagado',NULL,17000,'2026-07-21 13:00:00-05',NULL,NULL),
 (9,'Mesa 7',NULL,'1 Pizza - Pequeña (Paisa)','pagado','nequi',18000,'2026-07-22 13:00:00-05',NULL,21000),
 (10,'Mesa 2',NULL,'1 Calzone (De Casa + Carnes)','pagado','efectivo',25000,'2026-08-02 18:00:00-05',25000,0),
 (11,'Mesa 2',NULL,'1 Calzone - Hawaiana (Hawaiana)','pagado','efectivo',25000,'2026-08-03 18:30:00-05',25000,0),
 (12,'Mesa 8',NULL,'1 pizza grande paisa y carnes, 1 Combo familiar','pagado','efectivo',49500,'2026-08-04 12:30:00-05',49500,0),
 (13,'Mesa 8',NULL,'1 Pizza Burguer - Paisa, 1 Jugo - AGUA (Leche)','pagado','efectivo',28000,'2026-08-05 12:30:00-05',22000,0),
 (14,'Mesa 9',NULL,'2 Hamburguesa - Sencilla, 1 Adición de Queso - Grande','pagado','efectivo',46000,'2026-08-10 13:00:00-05',NULL,NULL),
 (15,'Pedro Ruiz','3001112233','1 Pizza - Grande (Paisa)','pendiente',NULL,51500,'2026-08-14 20:00:00-05',NULL,NULL),
 (16,'Mesa 3',NULL,'1 Pizza - Grande (Carnes)','pagado','efectivo',45000,'2026-08-15 20:00:00-05',45000,0),
 (17,'Mesa 3',NULL,'1 Pizza - Grande (Carnes)','cancelado','efectivo',45000,'2026-08-16 20:00:00-05',NULL,NULL),
 (18,'Importada',NULL,'Venta importada','pagado','transferencia',50000,'2026-08-20 11:00:00-05',NULL,50000),
 (19,'Jorge Peña','3157778899','1 Pizza - Mediana (Jamón y Queso), 1 GASEOSA - Coca Cola Personal','pagado','transferencia',40000,'2026-09-01 19:00:00-05',NULL,30000),
 (20,'Ana Gómez','3201112233','1 Calzone (Mexicana)','pagado','efectivo',29000,'2026-09-02 19:00:00-05',25000,NULL),
 (21,'Ana Gómez','3201112233','1 Pizza - Mediana (Paisa + Carnes + Hawaiana)','pagado','efectivo',41500,'2026-09-03 19:00:00-05',38000,NULL),
 (22,'Mesa 1',NULL,'1 Pizza - Pequeña (Paisa)','pagado','efectivo',18000,'2026-09-08 12:00:00-05',17000,0),
 (23,'Carlos Morales','3100001111','Domicilio #3','pagada','nequi',24000,'2026-09-09 12:00:00-05',NULL,NULL),
 (24,'Mesa 2',NULL,'Consumo en local','pagada','daviplata',18000,'2026-09-09 13:00:00-05',NULL,NULL);

INSERT INTO ordenes (orden_id, factura_id, tipo_pedido, estado_orden, fecha_orden) VALUES
 (1,1,'mesa','completada','2026-07-04 13:10:00-05'),
 (2,2,'domicilio','completada','2026-07-05 19:30:00-05'),
 (3,3,'mesa','completada','2026-07-06 12:00:00-05'),
 (4,4,'domicilio','completada','2026-07-12 20:15:00-05'),
 (5,5,'mesa','completada','2026-07-18 14:20:00-05'),
 (6,6,'mesa','completada','2026-07-19 14:20:00-05'),
 (7,7,'mesa','completada','2026-07-20 15:00:00-05'),
 (8,8,'mesa','completada','2026-07-21 13:00:00-05'),
 (9,9,'mesa','completada','2026-07-22 13:00:00-05'),
 (10,10,'mesa','completada','2026-08-02 18:00:00-05'),
 (11,11,'mesa','completada','2026-08-03 18:30:00-05'),
 (12,12,'mesa','completada','2026-08-04 12:30:00-05'),
 (13,13,'mesa','completada','2026-08-05 12:30:00-05'),
 (14,14,'mesa','completada','2026-08-10 13:00:00-05'),
 (15,15,'domicilio','completada','2026-08-14 20:00:00-05'),
 (16,16,'mesa','cancelado','2026-08-15 20:00:00-05'),
 (17,17,'mesa','cancelado','2026-08-16 20:00:00-05'),
 (18,19,'domicilio','completada','2026-09-01 19:00:00-05'),
 (19,20,'domicilio','completada','2026-09-02 19:00:00-05'),
 (20,21,'domicilio','completada','2026-09-03 19:00:00-05'),
 (21,22,'mesa','completada','2026-09-08 12:00:00-05');

INSERT INTO ordenes_productos (orden_id, producto, cantidad, precio_unitario, variante_id, base) VALUES
 (1,'Pizza - Grande (Paisa + Carnes)',1,47500,1,NULL),
 (1,'GASEOSA - Coca Cola Personal',1,4000,11,NULL),
 (2,'Pizza - Mediana (Hawaiana)',1,34500,2,NULL),
 (2,'GASEOSA - Coca Cola Personal',1,4000,11,NULL),
 (3,'Pizza - Pequeña (Mexicana)',1,17000,3,NULL),
 (4,'Pizza - Familiar (Paisa + Hawaiana + Carnes)',1,68000,4,NULL),
 (5,'Pizza - Grande (Quesuda)',1,48000,1,NULL),
 (5,'GASEOSA - Coca Cola Personal',1,4000,11,NULL),
 (6,'Pizza - Mediana (Paisa)',1,34000,2,NULL),
 (6,'GASEOSA - Coca Cola Personal',1,4000,11,NULL),
 (7,'Pizza - Mediana (De Casa)',1,32000,2,NULL),
 (8,'Pizza - Pequeña (De Casa)',1,17000,3,NULL),
 (9,'Pizza - Pequeña (Paisa)',1,18000,3,NULL),
 (10,'Calzone (De Casa + Carnes)',1,25000,6,NULL),
 (11,'Calzone - Hawaiana (Hawaiana)',1,25000,7,NULL),
 (12,'pizza grande paisa y carnes',1,47500,NULL,NULL),
 (12,'Combo familiar',1,2000,NULL,NULL),
 (13,'Pizza Burguer - Paisa',1,20000,15,NULL),
 (13,'Jugo - AGUA (Leche)',1,8000,17,'leche'),
 (14,'Hamburguesa - Sencilla',2,17000,14,NULL),
 (14,'Adición de Queso - Grande',1,12000,19,NULL),
 (15,'Pizza - Grande (Paisa)',1,47500,1,NULL),
 (16,'Pizza - Grande (Carnes)',1,45000,1,NULL),
 (17,'Pizza - Grande (Carnes)',1,45000,1,NULL),
 (18,'Pizza - Mediana (Jamón y Queso)',1,32000,2,NULL),
 (18,'GASEOSA - Coca Cola Personal',1,4000,11,NULL),
 (19,'Calzone (Mexicana)',1,25000,8,NULL),
 (20,'Pizza - Mediana (Paisa + Carnes + Hawaiana)',1,37500,2,NULL),
 (21,'Pizza - Pequeña (Paisa)',1,18000,3,NULL);

INSERT INTO domicilios (fecha_creado, factura_id, orden_id, telefono, telefono_domiciliario_asignado, direccion_entrega, costo_domicilio, estado_domicilio, "domiciliarioTelefono") VALUES
 ('2026-07-05 19:30:00-05',2,2,'3201112233','3117462406','Cra 1 # 2-3',5000,'entregado',NULL),
 ('2026-07-12 20:15:00-05',4,4,'3157778899','3058545970','Cra 1 # 2-3',4000,'entregado',NULL),
 ('2026-08-14 20:00:00-05',15,15,'3001112233','3117462406','Cra 1 # 2-3',4000,'pendiente',NULL),
 ('2026-09-01 19:00:00-05',19,18,'3157778899','3000000000','Cra 1 # 2-3',4000,'entregado',NULL),
 ('2026-09-02 19:00:00-05',20,19,'3201112233','','Cra 1 # 2-3',4000,'entregado',NULL),
 ('2026-09-03 19:00:00-05',21,20,'3201112233',NULL,'Cra 1 # 2-3',4000,'entregado','3058545970');

INSERT INTO facturas_pagos (total, nombre_gasto, descripcion, estado, fecha_factura, metodo, categoria) VALUES
 (300000,'Queso y harina','','pagado','2026-07-07','efectivo','general'),
 (380000,'Nómina cocina','','pagado','2026-07-13','qr','nomina'),
 (80000,'Luz','','pagado','2026-08-07','qr','general'),
 (1200000,'Arriendo','','pendiente','2026-09-01','transferencia','arriendo'),
 (45000,'Empaques','','pagado','2026-09-05','efectivo','categoria-rara');

INSERT INTO caja_movimientos (fecha, tipo, denominaciones, total, factura_venta_id, descripcion, metodo, caja_origen) VALUES
 ('2026-07-04','apertura','{"50000":2}',100000,NULL,'Apertura',NULL,'principal'),
 ('2026-07-04','entrada','{"coins":49500}',49500,1,'Cobro factura #1','efectivo','principal'),
 ('2026-08-15','entrada','{"coins":45000}',45000,16,'Cobro factura #16','efectivo','principal'),
 ('2026-08-16','entrada','{"coins":45000}',45000,17,'Cobro factura #17 (luego cancelada)','efectivo','principal');

INSERT INTO cierres_caja (fecha, "totalVentas", "totalEgresos", "balanceNeto", "totalOrdenes", "totalFacturas", "ticketPromedio") VALUES
 ('2026-09-08',100000,0,100000,3,3,33333);

INSERT INTO inventario_cajas (id, nombre, cantidad, "alertaMinimo") VALUES (1,'Caja Pizza Grande',40,15),(2,'Cajas Medianas',12,10),(3,'caja personal',-3,5),(4,'Caja Calzone',30,10);

INSERT INTO inventario_cajas_movimientos ("cajaId", delta, "cantidadResultante", tipo, nota) VALUES (1,-1,39,'venta','Orden #1'),(2,5,12,'entrada','Compra');

INSERT INTO ingredientes_bebidas (nombre, categoria, unidad, "stockActual") VALUES ('Pulpa Mora','pulpa','kg',5),('Pulpa Maracuyá','pulpa','kg',2);
