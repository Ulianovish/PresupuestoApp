# ADR-004 — ¿Next.js ejecuta el `middleware.ts` de la raíz?

Estado: aceptada (2026-09-30, por árbitro tras deliberación). Surgió implementando S06.

## Contexto
El proyecto usa `src/app/` y `next` ^15.5.12. El único middleware es `middleware.ts` en la raíz; no existe `src/middleware.ts`. Con carpeta `src/`, Next.js busca el middleware en `src/`, así que el de la raíz muy probablemente se ignora sin ningún error. `/gastos` no tiene guardia propia.

El archivo no es nuevo: existe desde `8c8197d` y `e749c71`, y S04 lo tocó en `e044bdf`. Si nunca corrió, producción siempre funcionó sin sus reglas de redirección (`getRouteAccess`, `redirectsSignedInUser`), y las garantías de S04 (`/auth/confirm`, `/bienvenida`, correos fuera de los logs) no existen hoy en producción.

## Opciones
1. Verificar a mano en un preview de Vercel antes de tocar nada: abrir `/gastos` y `/bienvenida` en ventana privada sin sesión y ver si redirigen al login; buscar la entrada "ƒ Middleware" en la salida del build de Vercel.
2. Mover ya el archivo a `src/middleware.ts` (historia de bug de S04).
3. Dejarlo como está.

## Votos
- **Pragmático:** opción 2 (moverlo ya; los hechos apuntan a que se ignora).
- **Guardián:** opción 1 primero. Moverlo a ciegas activaría por primera vez, para el usuario real, reglas que nunca corrieron en un despliegue: riesgo de bucle de redirección o de dejarlo fuera de una app en uso. La verificación cuesta minutos.
- Ambos coinciden en los hechos y en descartar la 3 (sin guardia en `/gastos` y sin las garantías de S04).

## Decisión (árbitro)
Opción 1 ahora (tarea humana **H10**, contratos §5.4):
- Si **no** redirige, o el build no muestra "ƒ Middleware": abrir la historia de bug de S04 que mueve el archivo a `src/middleware.ts` (opción 2). Antes de mezclar a `main`, esa historia debe pasar en el preview: iniciar sesión, cerrar sesión, `/auth/confirm`, y `/gastos` redirigiendo al login sin sesión.
- Si **sí** redirige: anotarlo en esta ADR para que nadie mueva el archivo después.

Mientras no se resuelva, ninguna historia (S06 incluida) declara protección por middleware en sus criterios de aceptación. En S06 queda como riesgo que depende de S04 y no la bloquea.

## Consecuencias
- Nueva tarea humana H10. Ningún agente despliega ni mueve el archivo por su cuenta.
- `src/middleware.test.ts` prueba la función `middleware` de forma aislada: pasa aunque Next.js no la cargue, así que no sirve como evidencia de que corre en producción.
- Resultado de H10: _pendiente_.
