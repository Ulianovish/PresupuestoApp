# 🔧 Variables de Entorno para Facturas Electrónicas DIAN

## 📋 Variables Requeridas

### **1. Base de Datos Supabase**
```bash
# URL de tu proyecto Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co

# Clave pública (anon key) de Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

### **2. APIs de Facturas Electrónicas**
```bash
# URL de tu función Vercel para procesar códigos CUFE
NEXT_PUBLIC_CUFE_API_URL=https://tu-cufe-api.vercel.app/api/cufe-hybrid-captcha-headless

# URL de tu función Vercel para procesar PDFs (opcional si está en el mismo proyecto)
NEXT_PUBLIC_PROCESS_PDF_API_URL=https://tu-pdf-processor.vercel.app/api/process-invoice-pdf
```

### **3. Configuración de Captcha**
```bash
# Clave API de 2captcha (requerida para resolver captchas de la DIAN)
CAPTCHA_API_KEY=tu_clave_2captcha_aqui
```

### **4. Configuración de Entorno (Opcional)**
```bash
# Entorno de Vercel
VERCEL_ENV=development

# Región de Vercel
VERCEL_REGION=iad1
```

---

## 🔑 Cómo Obtener las Claves

### **Supabase**
1. Ve a [supabase.com](https://supabase.com)
2. Crear o acceder a tu proyecto
3. Ve a **Settings** → **API**
4. Copia la **URL** y la **anon public key**

### **2captcha**
1. Regístrate en [2captcha.com](https://2captcha.com)
2. Ve a tu dashboard
3. Copia tu **API Key**
4. Asegúrate de tener saldo suficiente (cada captcha cuesta ~$0.001)

### **URLs de Funciones Vercel**
1. Deploy tu proyecto FacturaDian en Vercel
2. La URL será: `https://tu-proyecto.vercel.app`
3. Los endpoints serán automáticamente:
   - `/api/cufe-hybrid-captcha-headless`
   - `/api/process-invoice-pdf`

---

## 📂 Archivos de Configuración

### **Para Desarrollo Local**
Crea un archivo `.env.local` en la raíz del proyecto:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
NEXT_PUBLIC_CUFE_API_URL=https://tu-cufe-api.vercel.app/api/cufe-hybrid-captcha-headless
CAPTCHA_API_KEY=tu_clave_2captcha_aqui
```

### **Para Producción en Vercel**
1. Ve a tu proyecto en Vercel Dashboard
2. Ve a **Settings** → **Environment Variables**  
3. Agrega cada variable con su valor correspondiente
4. Asegúrate de marcar las variables `NEXT_PUBLIC_*` como **Production**, **Preview** y **Development**

---

## 🧪 Verificación de Configuración

### **Test de Conexión a Supabase**
```javascript
// En la consola del navegador
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Debe retornar información del proyecto
supabase.auth.getUser()
```

### **Test de API CUFE**
```bash
# Comando curl para probar
curl -X POST https://tu-cufe-api.vercel.app/api/health \
  -H "Content-Type: application/json"

# Debe retornar:
{
  "status": "ok",
  "availableEndpoints": ["/api/cufe-hybrid-captcha-headless", ...]
}
```

### **Test de 2captcha**
```bash
# Verificar balance
curl "http://2captcha.com/res.php?key=TU_API_KEY&action=getbalance"

# Debe retornar un número (tu balance en USD)
```

---

## ⚠️ Consideraciones de Seguridad

### **Variables Públicas vs Privadas**
- ✅ **NEXT_PUBLIC_*** - Se exponen al cliente (navegador)
- ❌ **CAPTCHA_API_KEY** - Solo servidor (funciones Vercel)

### **Mejores Prácticas**
1. **Nunca** commites archivos `.env*` al repositorio
2. Usa **claves diferentes** para desarrollo y producción
3. **Rota las claves** regularmente
4. **Limita el acceso** a las variables de entorno en tu equipo

### **Rate Limiting**
- Las APIs de DIAN tienen límites de requests
- 2captcha tiene límites por minuto
- Implementa **retry logic** con backoff exponencial

---

## 🔄 Variables Opcionales Avanzadas

### **Para Debugging**
```bash
# Habilitar logs detallados
DEBUG=electronic-invoices:*

# Timeout personalizado para requests
REQUEST_TIMEOUT=30000

# Número máximo de reintentos
MAX_RETRIES=3
```

### **Para Desarrollo**
```bash
# Usar mocks en lugar de APIs reales
USE_MOCK_APIS=true

# Saltarse validación de captcha en desarrollo
SKIP_CAPTCHA_IN_DEV=true
```

### **Para Producción**
```bash
# URL de webhook para notificaciones
WEBHOOK_URL=https://tu-app.com/webhooks/invoice-processed

# Clave para firmar webhooks
WEBHOOK_SECRET=tu_clave_secreta_webhook
```

---

## 🆘 Troubleshooting

### **Error: "Invalid API key"**
- Verifica que la clave de Supabase sea correcta
- Asegúrate de usar la **anon key**, no la **service role key**

### **Error: "CORS policy"**
- Las funciones Vercel deben configurar headers CORS apropiados
- Agrega tu dominio a la lista de dominios permitidos en Supabase

### **Error: "Insufficient balance"**
- Recarga saldo en 2captcha
- Cada captcha cuesta aproximadamente $0.001 USD

### **Error: "Function timeout"**
- Las funciones Vercel tienen timeout de 10s (plan gratuito) o 60s (pro)
- Considera usar múltiples funciones más pequeñas
- Implementa polling para operaciones largas

---

## 📞 Soporte

Si tienes problemas con la configuración:

1. **Revisa los logs** en Vercel Dashboard → Functions
2. **Verifica las variables** en Settings → Environment Variables  
3. **Testa cada componente** por separado (Supabase, CUFE API, 2captcha)
4. **Consulta la documentación** específica de cada servicio

¿Variables configuradas correctamente? ¡Ahora estás listo para usar las facturas electrónicas! 🎉 