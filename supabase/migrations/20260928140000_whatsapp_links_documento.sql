-- Documento (cédula/NIT) del comprador por número vinculado, para buscar
-- facturas por CUFE en la DIAN: el portal exige el documento del emisor o del
-- receptor, y muchos QR traen solo el link. Casi siempre el comprador es una de
-- las personas que comparten la cuenta, así que el bot prueba el documento del
-- número que escribió y después los de los otros números de la cuenta.
--
-- Solo dígitos, 5 a 15 (el mismo formato que aceptan los scrapers). NULL = sin
-- documento cargado.
ALTER TABLE public.whatsapp_links
  ADD COLUMN IF NOT EXISTS documento text;

ALTER TABLE public.whatsapp_links
  DROP CONSTRAINT IF EXISTS whatsapp_links_documento_formato;
ALTER TABLE public.whatsapp_links
  ADD CONSTRAINT whatsapp_links_documento_formato
  CHECK (documento ~ '^\d{5,15}$');

-- El dueño lo edita desde Ajustes con su sesión (hasta ahora solo podía ver y
-- borrar sus números; INSERT/UPDATE los hacía el webhook con service-role).
-- El GRANT por columna evita que esta política de UPDATE le deje reescribir
-- `phone_e164` o `user_id` por la API: solo `documento` es editable.
REVOKE UPDATE ON public.whatsapp_links FROM anon, authenticated;
GRANT UPDATE (documento) ON public.whatsapp_links TO authenticated;

DROP POLICY IF EXISTS "Dueño edita el documento de sus números"
  ON public.whatsapp_links;
CREATE POLICY "Dueño edita el documento de sus números"
  ON public.whatsapp_links FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
