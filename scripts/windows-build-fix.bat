@echo off
echo 🚀 Build script para Windows - Presupuesto 2025
echo.

REM Terminar procesos de Node.js que puedan estar bloqueando archivos
echo 🔄 Terminando procesos Node.js...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Limpiar carpeta .next con permisos elevados
echo 🗑️ Limpiando carpeta .next...
if exist .next (
    rmdir /s /q .next 2>nul
    if exist .next (
        echo ⚠️ No se pudo eliminar .next, intentando con permisos...
        powershell -Command "Remove-Item -Path '.next' -Recurse -Force -ErrorAction SilentlyContinue"
    )
)

REM Crear nueva carpeta .next con permisos correctos
echo 📁 Creando nueva carpeta .next...
mkdir .next >nul 2>&1

REM Ejecutar build
echo 🏗️ Ejecutando build...
npm run build

if %ERRORLEVEL% equ 0 (
    echo.
    echo ✅ Build completado exitosamente!
    echo 📦 Los archivos están en .next/
    echo.
    echo 🚀 Para hacer deploy:
    echo 1. Sube el proyecto a GitHub
    echo 2. Conecta con Vercel/Netlify
    echo 3. Configura las variables de entorno
) else (
    echo.
    echo ❌ Build falló. Posibles soluciones:
    echo 1. Ejecutar como administrador
    echo 2. Verificar que no hay errores TypeScript
    echo 3. Verificar variables de entorno
    echo 4. Reiniciar VSCode/editor
)

pause