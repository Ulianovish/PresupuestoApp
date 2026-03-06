CREATE OR REPLACE FUNCTION update_pagos_deuda_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pagos_deuda_updated_at ON pagos_deuda;
CREATE TRIGGER trigger_pagos_deuda_updated_at
  BEFORE UPDATE ON pagos_deuda
  FOR EACH ROW
  EXECUTE FUNCTION update_pagos_deuda_updated_at();
