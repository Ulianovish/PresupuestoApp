# 🪟 Solución de Problemas en Windows - Deployment

## ❌ Problema: Error EPERM en Build

### Síntomas
```
Error: EPERM: operation not permitted, open 'C:\Repos\presupuesto\.next\trace'
```

### Causas Comunes
1. **Procesos Node.js activos** bloqueando archivos
2. **Permisos de Windows** restrictivos
3. **Antivirus** escaneando archivos en tiempo real
4. **VSCode/Editor** con archivos abiertos

## 🔧 Soluciones

### Solución 1: Script Automático (Recomendado)
```bash
# Ejecutar el script de Windows
scripts/windows-build-fix.bat
```

### Solución 2: Manual - Limpiar Procesos
```bash
# 1. Cerrar VSCode y todas las ventanas del proyecto
# 2. Abrir PowerShell como administrador
# 3. Ejecutar:
cd C:\Repos\Presupuesto
taskkill /f /im node.exe
Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
npm run build
```

### Solución 3: Configurar Antivirus
1. **Agregar exclusión** en Windows Defender:
   - Ir a Windows Security
   - Virus & threat protection
   - Exclusions > Add exclusion
   - Agregar carpeta: `C:\Repos\Presupuesto\.next`

### Solución 4: WSL (Recomendado para desarrolladores)
```bash
# Instalar WSL si no lo tienes
wsl --install

# Usar el proyecto desde WSL
wsl
cd /mnt/c/Repos/Presupuesto
npm run build
```

### Solución 5: Docker (Para casos extremos)
```bash
# Crear archivo Dockerfile
# Ver sección Docker más abajo
docker build -t presupuesto-app .
```

## 🔄 Deploy Alternativo - Vercel CLI

Si el build local falla, puedes hacer deploy directo:

```bash
# Instalar Vercel CLI
npm install -g vercel

# Deploy directo (Vercel hace el build en la nube)
vercel

# Deploy a producción
vercel --prod
```

## 🐳 Dockerfile para Build en Container

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Build de la aplicación
RUN npm run build

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]
```

```bash
# Comandos Docker
docker build -t presupuesto-app .
docker run -p 3000:3000 presupuesto-app
```

## 🌐 Deploy sin Build Local

### Opción 1: GitHub + Vercel
1. **Push a GitHub** (sin build local)
2. **Conectar en Vercel** - build automático en la nube
3. **Configurar variables** de entorno

### Opción 2: GitHub + Netlify
1. **Push a GitHub**
2. **Conectar en Netlify**
3. **Build settings**: 
   - Build command: `npm run build`
   - Publish directory: `.next`

### Opción 3: GitHub Actions
```yaml
# .github/workflows/build-deploy.yml
name: Build and Deploy
on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

## 🛠️ Configuración de Desarrollo para Windows

### VSCode Settings
```json
// .vscode/settings.json
{
  "files.watcherExclude": {
    "**/.next/**": true,
    "**/node_modules/**": true
  },
  "typescript.preferences.includePackageJsonAutoImports": "off",
  "search.exclude": {
    "**/.next": true,
    "**/node_modules": true
  }
}
```

### Git Ignore Adicional
```gitignore
# Archivos problemáticos en Windows
.next/trace
.next/cache
*.log
npm-debug.log*
.npm
```

## 🔍 Debug de Problemas

### Verificar Permisos
```powershell
# PowerShell como administrador
Get-Acl "C:\Repos\Presupuesto" | Format-List
icacls "C:\Repos\Presupuesto" /grant Users:F /T
```

### Verificar Procesos
```bash
# Listar procesos Node.js
tasklist | findstr node

# Verificar puertos ocupados
netstat -ano | findstr :3000
```

### Logs Detallados
```bash
# Build con logs detallados
npm run build 2>&1 | tee build.log

# Verificar Next.js config
npx next info
```

## 📋 Checklist de Troubleshooting

- [ ] **Cerrar VSCode** y reiniciar
- [ ] **Terminar procesos** Node.js: `taskkill /f /im node.exe`
- [ ] **Limpiar .next**: `rmdir /s /q .next`
- [ ] **Ejecutar como** administrador
- [ ] **Desactivar antivirus** temporalmente
- [ ] **Usar WSL** si disponible
- [ ] **Deploy directo** a Vercel sin build local

## 🚀 Recomendación Final

**Para Windows, la forma más confiable es:**

1. **Push código a GitHub** sin hacer build local
2. **Conectar con Vercel/Netlify** para build automático
3. **Usar WSL** para desarrollo local si es posible

¡El build en la nube es más confiable que el build local en Windows! 🌐