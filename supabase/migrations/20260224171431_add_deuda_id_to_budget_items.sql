ALTER TABLE budget_items
  ADD COLUMN IF NOT EXISTS deuda_id UUID REFERENCES deudas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_budget_items_deuda_id ON budget_items(deuda_id);
