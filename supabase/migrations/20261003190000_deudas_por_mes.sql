-- Las deudas cambian cada mes: el saldo baja, la cuota puede variar, las
-- cuotas pagadas suben. Hasta ahora cada deuda era un solo registro, así que
-- corregir octubre cambiaba también noviembre y todo el historial.
--
-- La deuda sigue siendo una (nombre, acreedor, tasa, tipo); lo que pasa a
-- guardarse por mes es su ESTADO.
CREATE TABLE IF NOT EXISTS public.deudas_mensuales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deuda_id uuid NOT NULL REFERENCES public.deudas(id) ON DELETE CASCADE,
  month_year character varying(7) NOT NULL,
  saldo_pendiente numeric NOT NULL DEFAULT 0,
  valor_cuota numeric NOT NULL DEFAULT 0,
  cuotas_pagas integer NOT NULL DEFAULT 0,
  cuotas_faltantes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deuda_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_deudas_mensuales_mes
  ON public.deudas_mensuales(user_id, month_year);

ALTER TABLE public.deudas_mensuales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver mis deudas mensuales" ON public.deudas_mensuales;
CREATE POLICY "Ver mis deudas mensuales"
  ON public.deudas_mensuales FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Crear mis deudas mensuales" ON public.deudas_mensuales;
CREATE POLICY "Crear mis deudas mensuales"
  ON public.deudas_mensuales FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Actualizar mis deudas mensuales" ON public.deudas_mensuales;
CREATE POLICY "Actualizar mis deudas mensuales"
  ON public.deudas_mensuales FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Eliminar mis deudas mensuales" ON public.deudas_mensuales;
CREATE POLICY "Eliminar mis deudas mensuales"
  ON public.deudas_mensuales FOR DELETE USING (auth.uid() = user_id);

-- Estado de cada deuda en un mes.
--
-- Si el mes no tiene foto todavía, se hereda la del mes anterior más cercano;
-- y si no hay ninguna, los valores base de la deuda. Así un mes nuevo arranca
-- con lo último conocido en vez de en ceros, y editarlo no toca los demás.
CREATE OR REPLACE FUNCTION public.get_deudas_mes(
  p_user_id uuid,
  p_month_year character varying
)
RETURNS TABLE(
  deuda_id uuid,
  descripcion character varying,
  acreedor character varying,
  tipo character varying,
  tasa_interes numeric,
  fecha_vencimiento date,
  saldo_pendiente numeric,
  valor_cuota numeric,
  cuotas_pagas integer,
  cuotas_faltantes integer,
  tiene_foto boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.descripcion,
    d.acreedor,
    d.tipo,
    d.tasa_interes,
    d.fecha_vencimiento,
    COALESCE(dm.saldo_pendiente, previa.saldo_pendiente, d.saldo_pendiente),
    COALESCE(dm.valor_cuota, previa.valor_cuota, d.valor_cuota),
    COALESCE(dm.cuotas_pagas, previa.cuotas_pagas, d.cuotas_pagas),
    COALESCE(dm.cuotas_faltantes, previa.cuotas_faltantes, d.cuotas_faltantes),
    (dm.id IS NOT NULL)
  FROM deudas d
  LEFT JOIN deudas_mensuales dm
    ON dm.deuda_id = d.id AND dm.month_year = p_month_year
  LEFT JOIN LATERAL (
    SELECT m.saldo_pendiente, m.valor_cuota, m.cuotas_pagas, m.cuotas_faltantes
    FROM deudas_mensuales m
    WHERE m.deuda_id = d.id AND m.month_year < p_month_year
    ORDER BY m.month_year DESC
    LIMIT 1
  ) previa ON true
  WHERE d.user_id = p_user_id
    AND COALESCE(d.es_activo, true)
  ORDER BY d.tipo, d.descripcion, d.acreedor;
END;
$function$;

-- Guarda (o actualiza) la foto de una deuda en un mes concreto.
CREATE OR REPLACE FUNCTION public.upsert_deuda_mes(
  p_user_id uuid,
  p_deuda_id uuid,
  p_month_year character varying,
  p_saldo_pendiente numeric,
  p_valor_cuota numeric,
  p_cuotas_pagas integer,
  p_cuotas_faltantes integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO deudas_mensuales (
    user_id, deuda_id, month_year,
    saldo_pendiente, valor_cuota, cuotas_pagas, cuotas_faltantes
  )
  VALUES (
    p_user_id, p_deuda_id, p_month_year,
    p_saldo_pendiente, p_valor_cuota, p_cuotas_pagas, p_cuotas_faltantes
  )
  ON CONFLICT (deuda_id, month_year) DO UPDATE
  SET saldo_pendiente = EXCLUDED.saldo_pendiente,
      valor_cuota = EXCLUDED.valor_cuota,
      cuotas_pagas = EXCLUDED.cuotas_pagas,
      cuotas_faltantes = EXCLUDED.cuotas_faltantes,
      updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
