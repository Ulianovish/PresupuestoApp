-- 20260923181000_rpcs_con_cuotas.sql agregó p_purchase_total y p_installments con
-- CREATE OR REPLACE, que al cambiar la firma crea una sobrecarga nueva en vez de
-- reemplazar la vieja. Como los dos parámetros nuevos tienen DEFAULT, toda llamada
-- sin ellos (WhatsApp, facturas CUFE y por foto) coincide con las dos versiones y
-- Postgres responde "Could not choose the best candidate function".
--
-- La versión de 10 parámetros es un superconjunto exacto: con los dos nuevos en NULL
-- se comporta igual que la vieja. Borramos la de 8.
DROP FUNCTION IF EXISTS public.upsert_monthly_expense(
  uuid, text, numeric, date,
  character varying, character varying, character varying, character varying
);
