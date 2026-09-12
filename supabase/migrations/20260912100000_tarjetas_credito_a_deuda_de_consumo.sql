-- Las tarjetas de crédito que estaban guardadas como deuda bancaria pasan al
-- grupo de consumo, para que los indicadores de endeudamiento separen bien
-- "deuda de consumo" de "deuda de activos".
--
-- Idempotente: solo toca las filas que siguen clasificadas como 'deuda' y cuya
-- descripción las identifica como tarjeta de crédito.
UPDATE deudas
SET tipo = 'tarjeta_credito',
    updated_at = now()
WHERE tipo = 'deuda'
  AND descripcion ILIKE '%tarjeta%';
