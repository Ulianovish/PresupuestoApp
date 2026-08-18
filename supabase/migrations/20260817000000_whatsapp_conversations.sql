-- Estado de conversación del bot de WhatsApp.
-- Existe porque entre "[foto]" y la respuesta "Davivienda" hay DOS invocaciones
-- distintas de la función serverless: no hay memoria compartida. Sin esto,
-- preguntarle algo al usuario y usar su respuesta es imposible.
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    phone_e164   TEXT PRIMARY KEY,
    user_id      UUID NOT NULL,
    turns        JSONB NOT NULL DEFAULT '[]'::jsonb,
    pending      JSONB,
    last_entity  JSONB,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Solo el webhook (service-role) toca esta tabla; el navegador nunca.
-- RLS activo SIN políticas = nadie más entra.
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
