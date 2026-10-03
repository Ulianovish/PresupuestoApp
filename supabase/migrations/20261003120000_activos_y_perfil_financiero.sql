-- Datos que faltaban para los 12 índices del test de realidad financiera:
-- los activos de la persona, cómo se han valorizado, y un puñado de datos
-- personales que no se pueden deducir de los movimientos.

-- ============================================================
-- ACTIVOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre character varying NOT NULL,
  -- Texto libre: el usuario escribe el tipo que quiera (Inmueble, Vehículo,
  -- Criptomonedas, Cesantías...). Se normaliza por trigger para que
  -- "inversion" e "Inversión" no terminen siendo dos tipos distintos.
  tipo character varying NOT NULL DEFAULT 'Otro',
  valor numeric NOT NULL DEFAULT 0,
  -- Se puede convertir en dinero rápido. Separa el patrimonio líquido del
  -- total: una casa vale, pero no paga el mercado de mañana.
  es_liquido boolean NOT NULL DEFAULT false,
  fecha_valoracion date,
  nota text,
  -- Deuda que financia este activo, si la hay: permite ver cuánto del bien es
  -- realmente propio (apartamento 300M con leasing de 236M = 64M propios).
  deuda_id uuid REFERENCES public.deudas(id) ON DELETE SET NULL,
  es_activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activos_user ON public.activos(user_id) WHERE es_activo;
CREATE INDEX IF NOT EXISTS idx_activos_deuda ON public.activos(deuda_id);

ALTER TABLE public.activos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Los usuarios pueden ver sus propios activos" ON public.activos;
CREATE POLICY "Los usuarios pueden ver sus propios activos"
  ON public.activos FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Los usuarios pueden crear sus propios activos" ON public.activos;
CREATE POLICY "Los usuarios pueden crear sus propios activos"
  ON public.activos FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Los usuarios pueden actualizar sus propios activos" ON public.activos;
CREATE POLICY "Los usuarios pueden actualizar sus propios activos"
  ON public.activos FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Los usuarios pueden eliminar sus propios activos" ON public.activos;
CREATE POLICY "Los usuarios pueden eliminar sus propios activos"
  ON public.activos FOR DELETE USING (auth.uid() = user_id);

-- Nombre y tipo con mayúscula inicial y sin espacios de sobra, con la misma
-- función que ya normaliza descripciones de gastos.
CREATE OR REPLACE FUNCTION public.normalizar_texto_activo()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.nombre := title_case(trim(NEW.nombre));
  NEW.tipo := title_case(trim(coalesce(NULLIF(trim(NEW.tipo), ''), 'Otro')));
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_normalizar_texto_activo ON public.activos;
CREATE TRIGGER trg_normalizar_texto_activo
BEFORE INSERT OR UPDATE ON public.activos
FOR EACH ROW EXECUTE FUNCTION public.normalizar_texto_activo();

-- ============================================================
-- HISTÓRICO DE VALORACIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activo_valoraciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activo_id uuid NOT NULL REFERENCES public.activos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor numeric NOT NULL,
  fecha_valoracion date,
  registrado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activo_valoraciones_activo
  ON public.activo_valoraciones(activo_id, registrado_en DESC);

ALTER TABLE public.activo_valoraciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Los usuarios pueden ver sus propias valoraciones" ON public.activo_valoraciones;
CREATE POLICY "Los usuarios pueden ver sus propias valoraciones"
  ON public.activo_valoraciones FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Los usuarios pueden crear sus propias valoraciones" ON public.activo_valoraciones;
CREATE POLICY "Los usuarios pueden crear sus propias valoraciones"
  ON public.activo_valoraciones FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Los usuarios pueden eliminar sus propias valoraciones" ON public.activo_valoraciones;
CREATE POLICY "Los usuarios pueden eliminar sus propias valoraciones"
  ON public.activo_valoraciones FOR DELETE USING (auth.uid() = user_id);

-- La serie la lleva la base, no la app: al crear el activo se guarda su primera
-- valoración, y cada vez que cambia el valor se agrega la nueva. Así el
-- histórico no depende de qué pantalla hizo el cambio.
CREATE OR REPLACE FUNCTION public.registrar_valoracion_activo()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.valor IS DISTINCT FROM OLD.valor THEN
    INSERT INTO public.activo_valoraciones (activo_id, user_id, valor, fecha_valoracion)
    VALUES (NEW.id, NEW.user_id, NEW.valor, NEW.fecha_valoracion);
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_registrar_valoracion_activo ON public.activos;
CREATE TRIGGER trg_registrar_valoracion_activo
AFTER INSERT OR UPDATE OF valor ON public.activos
FOR EACH ROW EXECUTE FUNCTION public.registrar_valoracion_activo();

-- ============================================================
-- PERFIL FINANCIERO (una fila por usuario)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.perfil_financiero (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Índice de Riqueza: con la fecha, la edad se recalcula sola cada año.
  fecha_nacimiento date,
  horas_trabajadas_mes numeric,
  score_crediticio integer,
  -- Índice de Riqueza: promedio de ingresos ANUALES de los últimos 10 años.
  ingreso_anual_promedio_10a numeric,
  -- Termostato financiero: el monto que "cabe en la mente" sin incomodidad.
  termostato_financiero numeric,
  -- Trabajo vs Vida: horas al día dedicadas a lo que se ama, con quien se ama.
  horas_vida_dia numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.perfil_financiero ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Los usuarios pueden ver su propio perfil" ON public.perfil_financiero;
CREATE POLICY "Los usuarios pueden ver su propio perfil"
  ON public.perfil_financiero FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Los usuarios pueden crear su propio perfil" ON public.perfil_financiero;
CREATE POLICY "Los usuarios pueden crear su propio perfil"
  ON public.perfil_financiero FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Los usuarios pueden actualizar su propio perfil" ON public.perfil_financiero;
CREATE POLICY "Los usuarios pueden actualizar su propio perfil"
  ON public.perfil_financiero FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- INGRESO RESIDUAL
-- ============================================================
-- Sin esta marca no se pueden calcular el índice de dependencia ni el progreso
-- financiero, que es justamente lo que separa a un hámster de un águila.
ALTER TABLE public.ingresos
  ADD COLUMN IF NOT EXISTS es_residual boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ingresos.es_residual IS
  'true si el ingreso llega sin trabajarlo (arriendos, dividendos, regalías).';
