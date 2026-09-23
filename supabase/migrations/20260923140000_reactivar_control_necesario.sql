-- El control "Necesario" estaba marcado como inactivo, y la lista de
-- controles solo ofrece los activos (getControls filtra is_active = true).
-- Resultado: era el control mas usado del presupuesto (956 items) pero no se
-- podia seleccionar; los items que ya lo tenian lo mostraban sin poder
-- reasignarlo.
UPDATE controls
SET is_active = true
WHERE name = 'Necesario';
