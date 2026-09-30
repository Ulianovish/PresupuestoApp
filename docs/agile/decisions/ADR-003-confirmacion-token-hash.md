# ADR-003 — Confirmación y recuperación con token_hash + /auth/confirm

Estado: aceptada (2026-09-30, orquestador).

## Contexto
`/auth/callback` es un Server Component: `exchangeCodeForSession` no puede escribir cookies y la sesión se pierde. El flujo PKCE con `code` además falla si el correo se abre en otro dispositivo.

## Decisión
Patrón oficial de Supabase para SSR: plantillas de correo con `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<tipo>&next=<ruta>` y un route handler `GET /auth/confirm` que llama `verifyOtp`. `/auth/callback` pasa a route handler (compatibilidad con enlaces viejos). Toda redirección pasa por `safeRedirectPath`.

## Consecuencias
Tarea humana H4: pegar las plantillas en el dashboard. Funciona entre dispositivos.
