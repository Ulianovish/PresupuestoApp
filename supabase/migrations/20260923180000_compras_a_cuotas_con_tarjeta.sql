-- Compras a cuotas con tarjeta de crédito.
--
-- El gasto del mes guarda la CUOTA (es lo que suma en el presupuesto) y aparte
-- se registra el valor total de la compra y en cuántas cuotas va, para que la
-- deuda de la tarjeta refleje lo que realmente se debe.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS purchase_total numeric,
  ADD COLUMN IF NOT EXISTS installments integer;

COMMENT ON COLUMN transactions.purchase_total IS
  'Valor total de la compra cuando se difirió a cuotas. El importe del mes va en amount.';
COMMENT ON COLUMN transactions.installments IS
  'Número de cuotas en que se difirió la compra.';

ALTER TABLE deudas
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

UPDATE deudas d
SET account_id = a.id
FROM accounts a
WHERE d.tipo = 'tarjeta_credito'
  AND a.user_id = d.user_id
  AND lower(a.name) = lower('TC ' || regexp_replace(d.acreedor, '^(tarjeta de cr[ée]dito|tarjeta|tc)\s+', '', 'i'))
  AND d.account_id IS DISTINCT FROM a.id;

-- La deuda se mantiene sola: sumar al crear, ajustar la diferencia al editar y
-- devolver al borrar. En un trigger y no en la app para que ningún camino
-- (app, WhatsApp, factura) pueda saltárselo y dejar el saldo desfasado.
CREATE OR REPLACE FUNCTION public.sincronizar_deuda_tarjeta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_deuda_old uuid;
  v_deuda_new uuid;
  v_total_old numeric := 0;
  v_total_new numeric := 0;
  v_delta numeric;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_total_old := COALESCE(OLD.purchase_total, 0);
    IF v_total_old <> 0 THEN
      SELECT d.id INTO v_deuda_old FROM deudas d
      WHERE d.account_id = OLD.account_id AND d.user_id = OLD.user_id
        AND COALESCE(d.es_activo, true) LIMIT 1;
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_total_new := COALESCE(NEW.purchase_total, 0);
    IF v_total_new <> 0 THEN
      SELECT d.id INTO v_deuda_new FROM deudas d
      WHERE d.account_id = NEW.account_id AND d.user_id = NEW.user_id
        AND COALESCE(d.es_activo, true) LIMIT 1;
    END IF;
  END IF;

  IF v_deuda_old IS NOT NULL AND v_deuda_old = v_deuda_new THEN
    v_delta := v_total_new - v_total_old;
    IF v_delta <> 0 THEN
      UPDATE deudas
      SET saldo_pendiente = saldo_pendiente + v_delta,
          valor_total = valor_total + v_delta,
          updated_at = now()
      WHERE id = v_deuda_new;
    END IF;
  ELSE
    IF v_deuda_old IS NOT NULL THEN
      UPDATE deudas
      SET saldo_pendiente = saldo_pendiente - v_total_old,
          valor_total = valor_total - v_total_old,
          updated_at = now()
      WHERE id = v_deuda_old;
    END IF;
    IF v_deuda_new IS NOT NULL THEN
      UPDATE deudas
      SET saldo_pendiente = saldo_pendiente + v_total_new,
          valor_total = valor_total + v_total_new,
          updated_at = now()
      WHERE id = v_deuda_new;
    END IF;
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sincronizar_deuda_tarjeta ON transactions;
CREATE TRIGGER trg_sincronizar_deuda_tarjeta
AFTER INSERT OR DELETE OR UPDATE OF purchase_total, account_id ON transactions
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_deuda_tarjeta();
