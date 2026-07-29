# Problema con el scraper de la página de la DIAN

> ## ⚠️ ACTUALIZACIÓN 2026-07-27 — este veredicto quedó SUPERADO
>
> **El scraping por CUFE NO está muerto.** Todo lo de abajo (fechado junio 2026) es historia;
> lo mantengo por contexto, pero el estado real hoy es:
>
> - **`factura-dian.vercel.app` funciona ~75%** (intermitente). El captcha que bloquea es
>   **Cloudflare Turnstile ESTÁNDAR**, que **2captcha SÍ resuelve**. El "captcha de Microsoft /
>   Azure WAF" **no aparece como muro** en las pruebas de julio; el diagnóstico "muerto por Azure
>   WAF irresoluble" era **erróneo** — el muro real era la instrumentación de Playwright (CDP) que
>   Cloudflare detecta. Cuando falla, es por **escalada** de la DIAN (2→3→4 captchas) → lentitud
>   que roza el timeout de Vercel.
> - **Plan B en producción:** hay un **scraper en el VPS** (Oracle `193.122.203.60:8099`,
>   Playwright **headful** + 2captcha + pdfplumber, bajo systemd) que devuelve el **mismo shape**
>   que Vercel y es **más estable** (headful → menos detectado → menos captchas: ~2 vs ~4).
> - **Ya integrado como fallback automático:** `src/lib/dian/process-invoice.ts`
>   (`fetchFromVpsFallback`) cae al VPS si Vercel falla. Env en Vercel prod:
>   `DIAN_VPS_URL` + `DIAN_VPS_TOKEN`. Endpoint protegido por header `x-auth-token`.
> - Pendiente opcional: poner el endpoint del VPS tras HTTPS (hoy es HTTP plano + token).
>
> Detalle completo en la memoria del repo `factura-dian` (`scraper-dian-estado-2026-06`).

---

**Fecha del diagnóstico:** junio 2026
**Veredicto (SUPERADO, ver banner arriba):** el scraping automático "solo con el CUFE" está **MUERTO**. No es viable hoy sin intervención humana o una rearquitectura grande.

---

## TL;DR

Para registrar un gasto a partir de un CUFE, `PresupuestoApp` depende de un servicio externo (`factura-dian.vercel.app`) que abre un navegador headless, entra al portal de la DIAN, resuelve el captcha y descarga el PDF de la factura. **La DIAN bloqueó ese flujo con un captcha que ningún solver comercial sabe resolver.** El camino recomendado es pivotar a que el usuario comparta el PDF/foto directamente.

---

## Arquitectura (cómo funcionaba)

`PresupuestoApp` **no** descarga las facturas por sí mismo. Su ruta `/api/invoices/process` hace de proxy hacia un servicio separado:

```
PresupuestoApp  →  factura-dian.vercel.app
                     ├─ cufe-to-data-stream.js      (orquestador SSE)
                     ├─ cufe-playwright-captcha.js   (Playwright + @sparticuz/chromium + 2captcha)
                     └─ extract-invoice-python-vercel.py  (pdfplumber + camelot → ítems)
```

- **Repo:** `Ulianovish/factura-dian`, deploy en `factura-dian.vercel.app`.
- **Flujo:** abre el portal DIAN → resuelve Cloudflare Turnstile con 2captcha → llega a la página de detalles → descarga el PDF → extrae ítems en Python.
- ~60–75 s por factura, normalmente resolviendo ~2 captchas.

---

## Los dos problemas (en orden)

### 1. Saturación serverless (resuelto)

Síntoma temprano: `ERR_INSUFFICIENT_RESOURCES` / `FILE_ERROR_NO_SPACE`, el Chromium no arrancaba.

- Plan **Vercel Hobby** → memoria topada en **2048 MB**. Chromium + captcha + PDF es muy justo.
- **Causa real:** dos Chromium **concurrentes** en la misma instancia Fluid (comparten 2048 MB → OOM). Más una **fuga de `/tmp`**: al crashear, no se borraban los perfiles `playwright_*` y se acumulaban.
- **Fix que funcionó (probado 5/5):** mutex en proceso (un browser a la vez) + `cleanupStaleTmp()` + `browser.close()` en `finally`.
- ⚠️ **No** desactivar Fluid Compute (en Hobby es lo único que da 300 s; sin él el cap es 60 s y el proceso tarda 56–75 s).
- ⚠️ **No** usar `process.exit()` para reciclar la instancia: Vercel lo trata como crash y envenena la siguiente request.

### 2. Anti-bot de la DIAN (NO resuelto — bloqueante)

A partir del **15 de junio de 2026**, el scraper se rompió en general, y **no por memoria**:

- En un **navegador real humano** todo funciona: sale Cloudflare Turnstile una vez, el documento es válido y aparece el link "Descargar PDF".
- El **Chromium headless del bot** recibe **escalada de challenges**: resuelve **3 captchas** (lo normal son 2) y nunca llega a la página de detalles → `"No PDF download link found"` o `#DocumentKey timeout`.
- La descarga del PDF está **gateada por captcha por diseño**: el botón hace `POST /Document/DownloadPDF` con campos `trackId, token, captcha` + `__RequestVerificationToken`, y exige cookie `cf_clearance` + token de captcha.

#### El captcha es Azure WAF CAPTCHA (el "captcha de Microsoft")

Lo que de verdad bloquea al bot **no es Cloudflare ni Arkose estándar**, es el **CAPTCHA de Azure WAF (Azure Front Door)** — la "verificación de seguridad de Microsoft" que vio el usuario. Confirmado por la config de la página:

- iframe: `catalogo-vpfe.dian.gov.co/.azwaf/captcha/proxied/v2/...`
- script: `/.azwaf/captcha/proxied/v2/<PUBLICKEY>/api.js`
- Es Arkose **proxeado por Azure**; el token válido es la cookie `afd_azwaf_captcha`, validada server-side por Azure.

**Ningún solver comercial lo soporta** (junio 2026): 2captcha, CapSolver, Anti-Captcha y CapMonster resuelven Arkose estándar y AWS WAF, pero **NO Azure WAF**. No hay API ni reportes de resolución.

---

## Intentos que fallaron (no insistir sin enfoque nuevo)

| Intento | Resultado |
|---|---|
| **Stealth** (`--disable-blink-features=AutomationControlled`, UA Chrome/131, `addInitScript` para webdriver/plugins/webgl) | No bastó: sigue 3 captchas + "No PDF download link". |
| **Proxy residencial DataImpulse** ($5, código quedó listo y correcto con `proxy-chain`) | **DataImpulse bloquea DIAN**: `403 SITE_PERMANENTLY_BLOCKED`. Bloquean "todos los sitios gubernamentales" desde dic-2023. |
| **Reusar cookie del captcha** | La cookie `afd_azwaf_captcha` dura ~30 min pero está atada a la IP, y no hay proxy que llegue a `.gov.co`. Inutilizable para serverless. |
| **`process.exit()` para reciclar instancia** | Vercel lo trata como crash, envenena la siguiente request. Revertido. |

> Nota técnica: `--single-process` es **obligatorio** en `@sparticuz/chromium` sobre Vercel (sin él Chromium se cuelga al arrancar), pero hace el headless **más detectable** → tensión con el anti-bot.

---

## Caminos restantes

1. **✅ Recomendado — pivotar a que el usuario aporte el insumo:**
   - **Foto de la factura → visión (MiniMax-VL)**: ya funciona en el bot de WhatsApp.
   - **PDF compartido directamente**: el usuario lo descarga (su navegador pasa el captcha) y lo manda al bot / sube a la app; nosotros lo procesamos con la pipeline Python existente (`extract-invoice-python-vercel`) **sin guardarlo**. ← feature en diseño.
   - **XML UBL**: la factura DIAN *es* un XML; el PDF es solo la representación gráfica. La DIAN obliga al emisor a enviarlo al email del receptor. Parsearlo da datos estructurados sin captcha. Camino más robusto.

2. **❌ Inviables hoy:** otro proxy residencial que permita `.gov.co` + sticky IP (no se encontró), o sacar el scraper de serverless a un worker persistente (costo/fricción alta).

---

## Conclusión

El CUFE-only automático resolviendo el captcha **no es viable hoy** sin human-in-the-loop o una rearquitectura grande. La decisión es dejar el scraper en pausa y construir el flujo donde **el usuario aporta el PDF/foto/XML** y nosotros lo procesamos reusando la pipeline de extracción + categorización + bandeja de aprobación que ya existe.
