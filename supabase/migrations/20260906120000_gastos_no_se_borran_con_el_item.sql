-- Borrar un ítem del presupuesto NO debe borrar los gastos asignados a él.
-- Un gasto es el registro de dinero realmente movido; el ítem es solo la
-- etiqueta con la que se agrupa. Con ON DELETE CASCADE, eliminar un ítem
-- destruía sus gastos. Con SET NULL el gasto sobrevive y aparece en el panel
-- "Gastos sin clasificar" para reasignarlo.
ALTER TABLE transactions
  DROP CONSTRAINT transactions_budget_item_id_fkey;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_budget_item_id_fkey
  FOREIGN KEY (budget_item_id) REFERENCES budget_items(id) ON DELETE SET NULL;
