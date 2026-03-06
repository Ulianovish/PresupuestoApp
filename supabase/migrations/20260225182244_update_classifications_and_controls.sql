
-- Desactivar clasificaciones antiguas
UPDATE classifications SET is_active = false
WHERE name IN ('Fijo', 'Variable', 'Discrecional');

-- Insertar nuevas clasificaciones
INSERT INTO classifications (name, is_active)
VALUES
  ('Basico',          true),
  ('Calidad de Vida', true),
  ('Estilo de Vida',  true),
  ('Caprichos',       true),
  ('Impuestos',       true)
ON CONFLICT (name) DO UPDATE SET is_active = true;

-- Desactivar controles antiguos
UPDATE controls SET is_active = false
WHERE name IN ('Necesario', 'Discrecional');

-- Insertar nuevos controles
INSERT INTO controls (name, is_active)
VALUES
  ('Eliminar',    true),
  ('Reducir',     true),
  ('Simplificar', true)
ON CONFLICT (name) DO UPDATE SET is_active = true;
