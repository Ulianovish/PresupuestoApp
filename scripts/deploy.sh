#!/bin/bash

# 🚀 Script de Deployment Manual - Presupuesto 2025
# Este script ayuda a hacer deployment de la aplicación manualmente

echo "🚀 Iniciando proceso de deployment..."

# Colores para el output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar mensajes con color
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que estamos en la rama main
current_branch=$(git branch --show-current)
if [ "$current_branch" != "main" ]; then
    print_warning "No estás en la rama main. Rama actual: $current_branch"
    echo "¿Quieres continuar? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_error "Deployment cancelado."
        exit 1
    fi
fi

# Verificar que no hay cambios sin commitear
if [ -n "$(git status --porcelain)" ]; then
    print_error "Hay cambios sin commitear. Commitea todos los cambios antes del deployment."
    git status --short
    exit 1
fi

# Pre-deployment checks
print_status "Ejecutando pre-deployment checks..."

# 1. Linting
print_status "🔍 Ejecutando ESLint..."
if npm run lint; then
    print_success "ESLint pasó sin errores"
else
    print_error "ESLint falló. Arregla los errores antes de continuar."
    exit 1
fi

# 2. Type checking
print_status "🔧 Verificando tipos TypeScript..."
if npm run type-check; then
    print_success "Type check pasó sin errores"
else
    print_error "Type check falló. Arregla los errores de tipos antes de continuar."
    exit 1
fi

# 3. Build test
print_status "🏗️ Probando build..."
if npm run build; then
    print_success "Build exitoso"
    # Limpiar después del test
    rm -rf .next
else
    print_error "Build falló. Revisa los errores antes de continuar."
    exit 1
fi

# 4. Security audit
print_status "🔒 Ejecutando audit de seguridad..."
if npm audit --audit-level high; then
    print_success "No se encontraron vulnerabilidades críticas"
else
    print_warning "Se encontraron vulnerabilidades. Revisa el output anterior."
    echo "¿Quieres continuar con el deployment? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_error "Deployment cancelado por vulnerabilidades."
        exit 1
    fi
fi

print_success "Todos los pre-deployment checks pasaron!"

# Deployment options
echo ""
print_status "Selecciona la plataforma de deployment:"
echo "1) Vercel"
echo "2) Netlify"
echo "3) Railway" 
echo "4) Manual build para servidor propio"
echo "5) Cancelar"
echo ""
echo -n "Opción (1-5): "
read -r option

case $option in
    1)
        print_status "🚀 Deploying a Vercel..."
        
        # Verificar si Vercel CLI está instalado
        if ! command -v vercel &> /dev/null; then
            print_status "Instalando Vercel CLI..."
            npm install -g vercel
        fi
        
        # Deploy a producción
        vercel --prod
        print_success "Deployment a Vercel completado!"
        ;;
        
    2)
        print_status "🚀 Deploying a Netlify..."
        
        # Verificar si Netlify CLI está instalado
        if ! command -v netlify &> /dev/null; then
            print_status "Instalando Netlify CLI..."
            npm install -g netlify-cli
        fi
        
        # Build y deploy
        npm run build
        netlify deploy --prod --dir=.next
        print_success "Deployment a Netlify completado!"
        ;;
        
    3)
        print_status "🚀 Deploying a Railway..."
        
        # Verificar si Railway CLI está instalado
        if ! command -v railway &> /dev/null; then
            print_error "Railway CLI no está instalado. Instálalo desde: https://railway.app/cli"
            exit 1
        fi
        
        railway up
        print_success "Deployment a Railway completado!"
        ;;
        
    4)
        print_status "🏗️ Generando build para servidor propio..."
        
        # Crear build optimizado
        npm run build
        
        print_success "Build completado en .next/"
        print_status "Para subir a tu servidor:"
        echo "1. Sube la carpeta .next/ a tu servidor"
        echo "2. Instala las dependencias: npm ci --production"
        echo "3. Ejecuta: npm start"
        ;;
        
    5)
        print_warning "Deployment cancelado por el usuario."
        exit 0
        ;;
        
    *)
        print_error "Opción inválida. Deployment cancelado."
        exit 1
        ;;
esac

# Post-deployment checks
echo ""
print_status "🧪 ¿Quieres ejecutar tests post-deployment? (y/N)"
read -r test_response

if [[ "$test_response" =~ ^[Yy]$ ]]; then
    echo -n "Ingresa la URL de tu aplicación desplegada: "
    read -r app_url
    
    print_status "Probando URL: $app_url"
    
    # Test básico de conectividad
    if curl -s --head "$app_url" | head -n 1 | grep -q "200 OK"; then
        print_success "✅ Aplicación responde correctamente"
    else
        print_warning "⚠️ La aplicación no responde o hay un error"
    fi
    
    # Test de autenticación (opcional)
    print_status "Prueba manualmente:"
    echo "1. ✅ La página principal carga correctamente"
    echo "2. ✅ El login/registro funciona"
    echo "3. ✅ Las rutas protegidas redirigen correctamente"
    echo "4. ✅ Las operaciones CRUD funcionan"
    echo "5. ✅ El diseño responsive se ve bien en móvil"
fi

echo ""
print_success "🎉 ¡Deployment completado exitosamente!"
print_status "📊 Próximos pasos recomendados:"
echo "1. Configura monitoreo de errores (Sentry)"
echo "2. Configura analytics (Google Analytics)"
echo "3. Configura dominio personalizado si es necesario"
echo "4. Configura backups automáticos de Supabase"

exit 0