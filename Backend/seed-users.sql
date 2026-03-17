-- Insertar Usuarios por Defecto (Pegar los Hashes generados con Bcrypt)
INSERT INTO users (id, username, name, "passwordHash", roles)
VALUES 
  -- 1. Rol de Administrador
  (gen_random_uuid(), 'admin', 'Administrador General', 'AQUI_TU_HASH', ARRAY['Admin']),
  
  -- 2. Rol de Cocina
  (gen_random_uuid(), 'cocina', 'Jefe de Cocina', 'AQUI_TU_HASH', ARRAY['Cocina']),
  
  -- 3. Rol de Cajero / Mesero
  (gen_random_uuid(), 'cajero', 'Caja Principal', 'AQUI_TU_HASH', ARRAY['Mesero'])
  
ON CONFLICT (username) DO NOTHING;