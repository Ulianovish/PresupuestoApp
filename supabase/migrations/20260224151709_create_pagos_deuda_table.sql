CREATE TABLE IF NOT EXISTS pagos_deuda (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  deuda_id UUID NOT NULL REFERENCES deudas(id) ON DELETE CASCADE,
  mes VARCHAR(7) NOT NULL,
  valor_cuota DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_pagado DECIMAL(12,2) DEFAULT 0,
  fecha_pago DATE,
  pagado BOOLEAN DEFAULT false,
  notas TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(deuda_id, mes)
);

CREATE INDEX IF NOT EXISTS idx_pagos_deuda_user_id ON pagos_deuda(user_id);
CREATE INDEX IF NOT EXISTS idx_pagos_deuda_deuda_id ON pagos_deuda(deuda_id);
CREATE INDEX IF NOT EXISTS idx_pagos_deuda_mes ON pagos_deuda(mes);
CREATE INDEX IF NOT EXISTS idx_pagos_deuda_pagado ON pagos_deuda(pagado);
