-- Las tablas de respaldo que dejaron algunas migraciones de datos quedaron sin RLS
-- y con SELECT para anon: cualquiera con la clave pública podía leer gastos,
-- ítems de presupuesto y cuentas. Se activa RLS sin políticas (nadie salvo
-- service_role/postgres las lee) y se quitan los privilegios de los roles de
-- cliente. No se borra nada: siguen sirviendo para revertir a mano.
ALTER TABLE public.backup_consolidacion_cuentas_20260817 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items_backup_20260604 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items_clasif_backup_202601 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions_text_backup_20260819 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.backup_consolidacion_cuentas_20260817 FROM anon, authenticated;
REVOKE ALL ON public.budget_items_backup_20260604 FROM anon, authenticated;
REVOKE ALL ON public.budget_items_clasif_backup_202601 FROM anon, authenticated;
REVOKE ALL ON public.transactions_text_backup_20260819 FROM anon, authenticated;
