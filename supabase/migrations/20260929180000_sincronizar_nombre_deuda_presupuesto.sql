-- El nombre de un ítem de presupuesto enlazado a una deuda sigue al de la
-- deuda: "Descripción · Acreedor", el mismo formato que se ve en Deudas.
--
-- Va en un trigger y no en la app porque las deudas se editan desde varios
-- lugares; así el nombre no puede quedar desfasado según el camino que se use.
CREATE OR REPLACE FUNCTION public.sincronizar_nombre_item_deuda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_nombre character varying;
BEGIN
  v_nombre := trim(NEW.descripcion) ||
    CASE
      WHEN coalesce(trim(NEW.acreedor), '') = '' THEN ''
      ELSE ' · ' || trim(NEW.acreedor)
    END;

  UPDATE budget_items
  SET name = v_nombre,
      updated_at = now()
  WHERE deuda_id = NEW.id
    AND name IS DISTINCT FROM v_nombre;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sincronizar_nombre_item_deuda ON deudas;
CREATE TRIGGER trg_sincronizar_nombre_item_deuda
AFTER UPDATE OF descripcion, acreedor ON deudas
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_nombre_item_deuda();
