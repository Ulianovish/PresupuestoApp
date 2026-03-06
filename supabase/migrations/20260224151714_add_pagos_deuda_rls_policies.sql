ALTER TABLE pagos_deuda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagos_deuda_select" ON pagos_deuda
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "pagos_deuda_insert" ON pagos_deuda
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pagos_deuda_update" ON pagos_deuda
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "pagos_deuda_delete" ON pagos_deuda
  FOR DELETE USING (auth.uid() = user_id);
