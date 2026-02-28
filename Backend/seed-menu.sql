-- =============================================================================
-- SEED: Carta de Menú Completa (MENU 2026)
-- Montar en Docker: ./Backend/seed-menu.sql:/docker-entrypoint-initdb.d/02-seed-menu.sql:ro
-- O ejecutar manualmente: psql -U appuser -d appdb -f seed-menu.sql
-- Modo dev: borra y recrea todos los productos y variantes
-- =============================================================================

DELETE FROM producto_variantes;
DELETE FROM productos;

DO $$
DECLARE pid INT;
BEGIN

  -- =====================================================================
  -- PIZZA
  -- Producto único. Los sabores se eligen en el frontend (1-3).
  -- Precio base = tradicional. El recargo por especiales/3 sabores
  -- se calcula en el frontend y se guarda como precioUnitario.
  --
  -- Sabores Tradicionales: De Casa, Napolitana, Ranchera, Hawaiana,
  --   Vegetales, Mexicana, Carnes, Pollo Tocineta, Pollo Champiñones,
  --   Pollo Maicitos, Jamón y Queso
  --
  -- Sabores Especiales (+$1k peq / +$2k med-gde):
  --   Quesuda, Boloñesa, Pollo BBQ, Aborrajada, Firu, Paisa
  --
  -- 3 sabores: +$3.000
  -- =====================================================================

  INSERT INTO productos (producto_nombre, categoria, descripcion, activo)
  VALUES ('Pizza', 'Pizzas', 'Elige 1-3 sabores. Tradicionales y Especiales disponibles.', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'Pequeña', 16000, true),
    (pid, 'Mediana', 30000, true),
    (pid, 'Grande',  43000, true);

  -- =====================================================================
  -- HAMBURGUESAS
  -- =====================================================================

  INSERT INTO productos (producto_nombre, categoria, descripcion, activo)
  VALUES ('Hamburguesa', 'Hamburguesas', 'Hamburguesa clásica con carne de res', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'Sencilla',    17000, true),
    (pid, 'Picosita',    20000, true),
    (pid, 'Doble Carne', 22000, true);

  -- =====================================================================
  -- CHUZOS
  -- Incluye: Papitas a la francesa, Arepa con queso, Ensalada
  -- =====================================================================

  INSERT INTO productos (producto_nombre, categoria, descripcion, activo)
  VALUES ('Chuzo', 'Chuzos', 'Incluye: Papitas a la francesa, Arepa con queso, Ensalada', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'Mixto Jamon, Cerdo, Pollo', 27000, true),
    (pid, 'Pollo Y tocineta', 27000, true);

  -- =====================================================================
  -- PIZZA BURGUER
  -- TODO: Verificar precios exactos de la carta
  -- =====================================================================

  INSERT INTO productos (producto_nombre, categoria, descripcion, activo)
  VALUES ('Pizza Burguer', 'Pizza Burguer', 'Pizza en formato hamburguesa', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'Original',  20000, true),
    (pid, 'D''Firu',   20000, true),
    (pid, 'Ranchera',  20000, true),
    (pid, 'Mexicana',  20000, true),
    (pid, 'Paisa',     20000, true);

  -- =====================================================================
  -- TORTI BURGER
  -- =====================================================================

  INSERT INTO productos (producto_nombre, categoria, descripcion, activo)
  VALUES ('Torti Burger', 'Tortiburger', 'Tortilla con hamburguesa', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'Unidad', 18000, true);

  -- =====================================================================
  -- CALZONES
  -- TODO: Verificar precios exactos de la carta (página 3)
  -- =====================================================================

  INSERT INTO productos (producto_nombre, categoria, descripcion, activo)
  VALUES ('Calzone', 'Calzones', 'Pizza cerrada estilo calzone', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'De Casa',            16000, true),
    (pid, 'Napolitana',         16000, true),
    (pid, 'Hawaiana',           16000, true),
    (pid, 'Mexicana',           16000, true),
    (pid, 'Carnes',             16000, true),
    (pid, 'Pollo Tocineta',     16000, true),
    (pid, 'Pollo Champiñones',  16000, true),
    (pid, 'Pollo Maicitos',     16000, true),
    (pid, 'Ranchera',           16000, true);

  -- =====================================================================
  -- ADICIONES / EXTRAS
  -- =====================================================================

  INSERT INTO productos (producto_nombre, categoria, descripcion, activo)
  VALUES ('Adición de Queso', 'Adiciones', 'Queso extra para pizza', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'Pequeña',  5000, true),
    (pid, 'Mediana',  8000, true),
    (pid, 'Grande',  12000, true);

  INSERT INTO productos (producto_nombre, categoria, descripcion, activo)
  VALUES ('Combo Papas Hamburguesa', 'Adiciones', 'Papas a la francesa para combo con hamburguesa', true)
  RETURNING producto_id INTO pid;
  INSERT INTO producto_variantes (producto_id, nombre, precio, activo) VALUES
    (pid, 'Unidad', 5000, true);

  RAISE NOTICE '✅ Seed de menú completado: % productos insertados',
    (SELECT COUNT(*) FROM productos);

END $$;

-- =============================================================================
-- SEED: pizza_sabores
-- Recargos por sabor y por tamaño (Pequeña / Mediana / Grande).
-- Quesuda tiene recargo mayor al resto de especiales.
-- Ajusta los valores de recargo_* según la carta actual.
-- =============================================================================

DELETE FROM pizza_sabores;

INSERT INTO pizza_sabores (nombre, tipo, recargo_pequena, recargo_mediana, recargo_grande, activo) VALUES
  -- Tradicionales (sin recargo)
  ('De la Casa',           'tradicional', 0,    0,    0,    true),
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
  ('Paisa',             'especial',    1000, 2000, 2000, true);

SELECT COUNT(*) AS sabores_insertados FROM pizza_sabores;
