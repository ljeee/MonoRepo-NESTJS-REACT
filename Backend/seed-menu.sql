-- =============================================================================
-- SEED: Carta de Menú Completa (MENU 2026 - Actualizado)
-- Montar en Docker: ./Backend/seed-menu.sql:/docker-entrypoint-initdb.d/02-seed-menu.sql:ro
-- O ejecutar manualmente: psql -U appuser -d appdb -f seed-menu.sql
-- Modo dev: borra y recrea todos los productos y variantes
-- =============================================================================

DELETE FROM variantes_ingredientes;
DELETE FROM producto_variantes;
DELETE FROM productos;

DO $$
DECLARE pid INT;
BEGIN

  -- =====================================================================
  -- ADICIÓNES (Categoría/Producto base sin variante directa)
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo)
  VALUES ('ADICIÓNES', '', true)
  RETURNING producto_id INTO pid;

  -- =====================================================================
  -- ADICIÓN DE QUESO
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo)
  VALUES ('Adición de Queso', 'Queso extra para pizza', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'Grande',  12000, true),
    (pid, 'Mediana',  8000, true),
    (pid, 'Pequeña',  5000, true);

  -- =====================================================================
  -- BEBIDAS
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo)
  VALUES ('BEBIDAS', '', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'MILO', 9000, true);

  -- =====================================================================
  -- CALZONE DE DOS SABORES
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo, personalizacion)
  VALUES ('CALZONE DE DOS SABORES', '', true, 'calzone')
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'CALZONE DOS SABORES', 25000, true);

  -- =====================================================================
  -- CALZONES
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo, personalizacion)
  VALUES ('Calzone', 'Pizza cerrada estilo calzone', true, 'calzone')
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'Carnes',                 25000, true),
    (pid, 'De Casa',                25000, true),
    (pid, 'Hawaiana',               25000, true),
    (pid, 'Mexicana',               25000, true),
    (pid, 'Napolitana',             25000, true),
    (pid, 'Pollo Champiñones',      25000, true),
    (pid, 'Pollo Maicitos',         25000, true),
    (pid, 'Pollo Tocineta',         25000, true),
    (pid, 'Ranchera',               25000, true),
    (pid, 'UNIDAD',                 25000, true),
    (pid, 'calzone de dos sabores', 25000, true);

  -- =====================================================================
  -- CHUZOS
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo)
  VALUES ('Chuzo', 'Incluye: Papitas a la francesa, Arepa con queso, Ensalada', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'Mixto Jamon, Cerdo, Pollo', 28000, true),
    (pid, 'Pollo Y tocineta', 28000, true);

  -- =====================================================================
  -- GASEOSAS
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo)
  VALUES ('GASEOSA', '', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, '1,5L',                 8000, true),
    (pid, '2,25L',               10000, true),
    (pid, 'AGUA',                 4000, true),
    (pid, 'AGUA GAS',             4000, true),
    (pid, 'AGUA LIMON',           4000, true),
    (pid, 'COLA Y POLA',          4000, true),
    (pid, 'Coca Cola 1.5L',       8000, true),
    (pid, 'Coca Cola Personal',   4000, true),
    (pid, 'Coca cola 2.25L',     10000, true),
    (pid, 'Ginger Personal',      4000, true),
    (pid, 'LITRO DEL VALLE',      7000, true),
    (pid, 'MEGA',                14000, true),
    (pid, 'PERSONAL',             4000, true),
    (pid, 'PREMIO 1.5L',          8000, true),
    (pid, 'PREMIO PERSONAL',      4000, true),
    (pid, 'QUATRO 1.5L',          8000, true),
    (pid, 'QUATRO PERSONAL',      4000, true),
    (pid, 'SODA 1.5L',           10000, true),
    (pid, 'SODA PERSONAL',        4000, true),
    (pid, 'SPRITE 1.5L',          8000, true),
    (pid, 'Sprite Personal',      4000, true),
    (pid, 'Té Durazno',           4000, true),
    (pid, 'Té limón',             4000, true);

  -- =====================================================================
  -- HAMBURGUESAS
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo)
  VALUES ('Hamburguesa', 'Hamburguesa clásica con carne de res', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'Doble Carne', 22000, true),
    (pid, 'Picosita',    20000, true),
    (pid, 'Sencilla',    17000, true);

  -- =====================================================================
  -- JUGOS
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo, personalizacion)
  VALUES ('Jugo', '', true, 'jugo')
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'AGUA',                       7000, true),
    (pid, 'AGUA',                       6000, true),
    (pid, 'LECHE',                      8000, true),
    (pid, 'LECHE MARACUYA O GUANABANA', 9000, true);

  -- =====================================================================
  -- KEBAB
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo)
  VALUES ('KEBAB', '', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'KEBAB', 17000, true);

  -- =====================================================================
  -- LASAGÑA
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo)
  VALUES ('LASAGÑA', '', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'LASAGÑA  CARNE',   28000, true),
    (pid, 'LASAGÑA DE POLLO', 28000, true),
    (pid, 'LASAGÑA MIXTA',    28000, true);

  -- =====================================================================
  -- LIMONADAS
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo)
  VALUES ('LIMONADAS', '', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'LIMONADA CEREZA',  10000, true),
    (pid, 'LIMONADA DE COCO', 10000, true);

  -- =====================================================================
  -- PAPAS ENCAJADAS
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo)
  VALUES ('PAPAS ENCAJADAS', '', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'ENCAJADAS MEXICANAS', 28000, true),
    (pid, 'ENCAJADAS PAISA',     28000, true),
    (pid, 'ENCAJADAS RANCHERA',  28000, true);

  -- =====================================================================
  -- PORCION DE PAPAS
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo)
  VALUES ('PORCION DE PAPAS', '', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'Unidad', 5000, true);

  -- =====================================================================
  -- PIZZA
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo, personalizacion)
  VALUES ('Pizza', 'Elige 1-3 sabores. Tradicionales y Especiales disponibles.', true, 'pizza')
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'Grande',  45000, true),
    (pid, 'Mediana', 32000, true),
    (pid, 'Pequeña', 17000, true);

  -- =====================================================================
  -- PIZZA BURGUER
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo)
  VALUES ('Pizza Burguer', 'Pizza en formato hamburguesa', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'D''Firu',   20000, true),
    (pid, 'Mexicana',  20000, true),
    (pid, 'Original',  20000, true),
    (pid, 'Paisa',     20000, true),
    (pid, 'Ranchera',  20000, true);

  -- =====================================================================
  -- SALCHIPAPAS
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo)
  VALUES ('SALCHIPAPAS', '', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'SALCHIPAPAS', 7000, true);

  -- =====================================================================
  -- TORTI BURGER
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo)
  VALUES ('Torti Burger', 'Tortilla con hamburguesa', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'Unidad', 18000, true);

  -- =====================================================================
  -- PASTELES
  -- =====================================================================
  INSERT INTO productos (producto_nombre, descripcion, activo)
  VALUES ('pasteles', '', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'PASTELES POR MAYOR', 2500, true),
    (pid, 'PASTELES POR MAYOR', 2800, true),
    (pid, 'PASTELES POR MAYOR', 3000, true),
    (pid, 'pasteles dulces',     4000, true);

  RAISE NOTICE '✅ Seed de menú completado: % productos insertados',
    (SELECT COUNT(*) FROM productos);

END $$;

-- =============================================================================
-- SEED: pizza_sabores
-- Recargos por sabor y por tamaño (Pequeña / Mediana / Grande).
-- Quesuda tiene recargo mayor al resto de especiales.
-- =============================================================================

DELETE FROM pizza_sabores;

INSERT INTO pizza_sabores (nombre, tipo, recargo_pequena, recargo_mediana, recargo_grande, activo) VALUES
  -- Tradicionales (sin recargo)
  ('De la Casa',        'tradicional', 0,    0,    0,    true),
  ('Napolitana',        'tradicional', 0,    0,    0,    true),
  ('Ranchera',          'tradicional', 0,    0,    0,    true),
  ('Hawaiana',          'tradicional', 0,    0,    0,    true),
  ('Vegetales',         'tradicional', 0,    0,    0,    true),
  ('Mexicana',          'tradicional', 0,    0,    0,    true),
  ('Carnes',            'tradicional', 0,    0,    0,    true),
  ('Pollo Tocineta',    'tradicional', 0,    0,    0,    true),
  ('Pollo Champiñones', 'tradicional', 0,    0,    0,    true),
  ('Pollo Maicitos',    'tradicional', 0,    0,    0,    true),
  ('Jamón y Queso',     'tradicional', 0,    0,    0,    true),
  -- Especiales (Quesuda es más cara que el resto)
  ('Quesuda',           'especial',    2000, 3000, 3000, true),
  ('Boloñesa',          'especial',    1000, 2000, 2000, true),
  ('Pollo BBQ',         'especial',    1000, 2000, 2000, true),
  ('Aborrajada',        'especial',    1000, 2000, 2000, true),
  ('Firu',              'especial',    1000, 2000, 2000, true),
  ('Paisa',             'especial',    1000, 2000, 2000, true),
  -- Configuración Dfiru POS
  ('RECARGO_3_SABORES', 'configuracion', 0, 0, 3000, true);

SELECT COUNT(*) AS sabores_insertados FROM pizza_sabores;
