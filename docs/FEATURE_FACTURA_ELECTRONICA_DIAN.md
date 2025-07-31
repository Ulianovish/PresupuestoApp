# 📱 Feature: Lectura de Facturas Electrónicas DIAN

## 🎯 Objetivo
Implementar funcionalidad para escanear códigos QR de facturas electrónicas DIAN, extraer automáticamente los datos del PDF y convertirlos en gastos, evitando duplicados.

## 📊 Estado del Proyecto
- **Inicio**: [Fecha de inicio]
- **Estimación**: 4 semanas
- **Prioridad**: Alta
- **Estado**: 🚀 Planificación

---

## 📋 Fase 1: Base de Datos y Esquema

### 1.1 Crear Tabla de Facturas Electrónicas
- [ ] **Crear script SQL para tabla `electronic_invoices`**
  - [ ] Campos básicos (id, user_id, cufe_code)
  - [ ] Datos del proveedor (supplier_name, supplier_nit)
  - [ ] Información de factura (invoice_date, total_amount)
  - [ ] Datos procesados (extracted_data JSONB, pdf_url)
  - [ ] Timestamps (processed_at, created_at, updated_at)
  - [ ] Índices para optimización
  - [ ] Políticas de RLS (Row Level Security)

- [ ] **Ejecutar migración en Supabase**
  - [ ] Aplicar script en entorno de desarrollo
  - [ ] Verificar creación correcta de tabla
  - [ ] Probar políticas de seguridad

### 1.2 Modificar Tabla de Gastos Existente
- [ ] **Agregar relación con facturas electrónicas**
  - [ ] Añadir campo `electronic_invoice_id` a `monthly_expenses`
  - [ ] Crear índice para la nueva relación
  - [ ] Actualizar tipos de TypeScript

- [ ] **Actualizar tipos de base de datos**
  - [ ] Modificar `src/types/database.ts`
  - [ ] Agregar interfaces para nueva tabla
  - [ ] Actualizar tipos de gastos mensuales

---

## ⚡ Fase 2: Funciones Vercel (Backend)

### 2.1 Función para Procesar PDF
- [ ] **Crear `/api/process-invoice-pdf.ts`**
  - [ ] Configurar dependencias (pdf-parse, axios)
  - [ ] Implementar descarga de PDF desde URL
  - [ ] Extraer texto del PDF usando pdf-parse
  - [ ] Parsear datos específicos de facturas DIAN
  - [ ] Estructurar respuesta en formato JSON
  - [ ] Manejo de errores y validaciones

- [ ] **Implementar extracción de datos específicos**
  - [ ] Extraer nombre y NIT del proveedor
  - [ ] Obtener fecha de factura
  - [ ] Calcular monto total
  - [ ] Extraer lista de items/productos
  - [ ] Obtener información de impuestos (IVA)

### 2.2 Validación y Seguridad
- [ ] **Implementar validaciones de entrada**
  - [ ] Validar formato de URL del PDF
  - [ ] Verificar tamaño máximo del archivo
  - [ ] Validar estructura del PDF
  - [ ] Rate limiting para prevenir abuso

- [ ] **Manejo de errores robusto**
  - [ ] Códigos de error específicos
  - [ ] Logging detallado para debugging
  - [ ] Fallbacks para PDFs con formato no estándar

---

## 🔧 Fase 3: Servicios del Frontend

### 3.1 Servicio de Facturas Electrónicas
- [ ] **Crear `src/lib/services/electronic-invoices.ts`**
  - [ ] Interfaces TypeScript para facturas electrónicas
  - [ ] Función para verificar CUFE duplicado
  - [ ] Servicio para procesar factura desde QR
  - [ ] Función para guardar factura en BD
  - [ ] Crear gastos desde datos de factura

- [ ] **Implementar funciones CRUD**
  - [ ] `checkCufeExists(cufeCode: string): Promise<boolean>`
  - [ ] `processInvoiceFromQR(cufeCode: string): Promise<InvoiceProcessingResult>`
  - [ ] `saveElectronicInvoice(invoiceData: any): Promise<string>`
  - [ ] `createExpensesFromInvoice(invoiceId: string, expenses: any[]): Promise<void>`

### 3.2 Validaciones y Utilidades
- [ ] **Crear `src/lib/validations/cufe-validator.ts`**
  - [ ] Validar formato de código CUFE
  - [ ] Extraer CUFE del contenido del QR
  - [ ] Validar estructura de datos de factura

- [ ] **Crear manejo de errores específicos**
  - [ ] Clase `InvoiceProcessingError`
  - [ ] Códigos de error específicos
  - [ ] Mensajes user-friendly

---

## 📱 Fase 4: Componentes del Frontend

### 4.1 Componente Escáner QR
- [ ] **Crear `src/components/organisms/QRInvoiceScanner/`**
  - [ ] Investigar y elegir biblioteca de QR (react-qr-scanner vs qr-scanner)
  - [ ] Implementar activación de cámara
  - [ ] Detectar códigos QR automáticamente
  - [ ] Extraer y validar código CUFE
  - [ ] Estados de carga y error
  - [ ] Diseño responsive y accesible

- [ ] **Implementar características avanzadas**
  - [ ] Switch entre cámara frontal/trasera
  - [ ] Zoom para mejorar lectura
  - [ ] Indicador visual de detección exitosa
  - [ ] Manejo de permisos de cámara

### 4.2 Modal de Procesamiento de Factura
- [ ] **Crear `src/components/organisms/InvoiceProcessingModal/`**
  - [ ] Estados del modal (verificando, procesando, revisando)
  - [ ] Barra de progreso para procesamiento
  - [ ] Integración con servicio de facturas
  - [ ] Manejo de errores visual

- [ ] **Implementar flujo de estados**
  - [ ] Estado inicial: Verificando duplicados
  - [ ] Estado de procesamiento: Descargando y extrayendo
  - [ ] Estado de revisión: Mostrando datos extraídos
  - [ ] Estado final: Confirmación y guardado

### 4.3 Componente de Revisión de Datos
- [ ] **Crear `src/components/organisms/InvoiceDataReview/`**
  - [ ] Tabla editable con datos extraídos
  - [ ] Validación en tiempo real
  - [ ] Sugerencias de categorías automáticas
  - [ ] Preview del gasto final
  - [ ] Botones de aprobación/rechazo

- [ ] **Características de edición**
  - [ ] Campos editables con validación
  - [ ] Mapeo automático de categorías por proveedor
  - [ ] Opción de dividir factura en múltiples gastos
  - [ ] Preservar datos originales para auditoría

### 4.4 Componentes Moleculares
- [ ] **Crear componentes de apoyo**
  - [ ] `InvoiceDataRow` - Fila editable de datos
  - [ ] `QRScannerControls` - Controles del escáner
  - [ ] `ProcessingProgress` - Indicador de progreso
  - [ ] `InvoicePreview` - Vista previa de factura

---

## 🔗 Fase 5: Integración en Página de Gastos

### 5.1 Modificar Página Principal
- [ ] **Actualizar `src/app/gastos/page.tsx`**
  - [ ] Agregar nuevos estados para flujo de QR
  - [ ] Implementar `handleSelectQR()`
  - [ ] Función para procesar factura escaneada
  - [ ] Manejo de resultados de procesamiento

- [ ] **Integrar nuevos modales**
  - [ ] Agregar QRInvoiceScanner al template
  - [ ] Integrar InvoiceProcessingModal
  - [ ] Conectar con lógica existente de gastos

### 5.2 Actualizar Modal de Selección
- [ ] **Modificar `ExpenseTypeSelectionModal`**
  - [ ] Actualizar texto de opción QR
  - [ ] Mejorar iconografía y descripción
  - [ ] Conectar con nueva funcionalidad

### 5.3 Hooks y Estado Global
- [ ] **Crear hook personalizado `useInvoiceProcessing`**
  - [ ] Manejo centralizado del estado
  - [ ] Lógica de procesamiento reutilizable
  - [ ] Integración con hooks existentes

---

## 🛡️ Fase 6: Validaciones y Seguridad

### 6.1 Validaciones del Cliente
- [ ] **Implementar validaciones robustas**
  - [ ] Formato de código CUFE
  - [ ] Estructura de datos de factura
  - [ ] Rangos de fechas válidos
  - [ ] Montos positivos y realistas

- [ ] **Esquemas de validación con Zod**
  - [ ] Esquema para código CUFE
  - [ ] Esquema para datos de factura
  - [ ] Esquema para gastos derivados

### 6.2 Seguridad y Permisos
- [ ] **Implementar controles de acceso**
  - [ ] Verificar autenticación de usuario
  - [ ] Validar permisos de cámara
  - [ ] Rate limiting en el cliente
  - [ ] Sanitización de datos de entrada

- [ ] **Auditoría y logging**
  - [ ] Log de facturas procesadas
  - [ ] Tracking de errores de procesamiento
  - [ ] Métricas de uso de la funcionalidad

---

## 🧪 Fase 7: Testing y Calidad

### 7.1 Tests Unitarios
- [ ] **Tests para servicios**
  - [ ] `electronic-invoices.service.test.ts`
  - [ ] `cufe-validator.test.ts`
  - [ ] Mocks para llamadas a API

- [ ] **Tests para componentes**
  - [ ] `QRInvoiceScanner.test.tsx`
  - [ ] `InvoiceProcessingModal.test.tsx`
  - [ ] `InvoiceDataReview.test.tsx`

### 7.2 Tests de Integración
- [ ] **Flujo completo end-to-end**
  - [ ] Escaneo de QR → Procesamiento → Guardado
  - [ ] Manejo de errores en cada paso
  - [ ] Validación de datos persistidos

- [ ] **Tests de la API**
  - [ ] Función de procesamiento de PDF
  - [ ] Manejo de diferentes formatos de factura
  - [ ] Rate limiting y seguridad

### 7.3 Tests de Usuario
- [ ] **Casos de uso reales**
  - [ ] Facturas de diferentes proveedores
  - [ ] Códigos QR con diferentes formatos
  - [ ] Escenarios de error comunes

---

## 📈 Fase 8: Optimizaciones y Mejoras

### 8.1 Performance
- [ ] **Optimizaciones de carga**
  - [ ] Lazy loading del escáner QR
  - [ ] Compresión de imágenes y PDFs
  - [ ] Cache de facturas procesadas
  - [ ] Paginación en historial

- [ ] **Optimizaciones de UX**
  - [ ] Loading states mejorados
  - [ ] Animaciones de transición
  - [ ] Feedback visual instantáneo

### 8.2 Funcionalidades Adicionales
- [ ] **Historial y gestión**
  - [ ] Página de historial de facturas
  - [ ] Búsqueda por proveedor/fecha
  - [ ] Filtros avanzados
  - [ ] Exportación de datos

- [ ] **Análisis y reportes**
  - [ ] Estadísticas de gastos por proveedor
  - [ ] Tendencias de consumo
  - [ ] Alertas de gastos duplicados

### 8.3 Mejoras de UX/UI
- [ ] **Diseño y usabilidad**
  - [ ] Tooltips explicativos
  - [ ] Tour guiado para nuevos usuarios
  - [ ] Modo offline para revisión
  - [ ] Tema oscuro/claro para escáner

---

## 📋 Checklist de Implementación

### Pre-requisitos
- [ ] Verificar que la función Vercel existente para descargar PDF funciona correctamente
- [ ] Instalar dependencias necesarias (biblioteca QR, pdf-parse)
- [ ] Configurar permisos de cámara en la aplicación

### Orden de Implementación Sugerido
1. [ ] **Semana 1**: Fase 1 (Base de datos) + Fase 2 (Función Vercel)
2. [ ] **Semana 2**: Fase 3 (Servicios) + Fase 4.1-4.2 (Componentes básicos)
3. [ ] **Semana 3**: Fase 4.3-4.4 (Componentes avanzados) + Fase 5 (Integración)
4. [ ] **Semana 4**: Fase 6 (Validaciones) + Fase 7 (Testing) + Fase 8 (Optimizaciones)

### Criterios de Aceptación
- [ ] Usuario puede escanear QR de factura DIAN exitosamente
- [ ] Sistema previene duplicados de facturas
- [ ] Datos se extraen correctamente del PDF
- [ ] Usuario puede revisar y editar datos antes de guardar
- [ ] Gastos se crean correctamente en la base de datos
- [ ] Manejo de errores es claro y útil
- [ ] Performance es aceptable (< 10s para procesar factura)

---

## 🔧 Dependencias y Herramientas

### Nuevas Dependencias
```json
{
  "qr-scanner": "^1.4.2",
  "pdf-parse": "^1.1.1",
  "react-webcam": "^7.1.1",
  "zod": "^3.22.4"
}
```

### Configuración Adicional
- [ ] Configurar permisos de cámara en Next.js
- [ ] Configurar CORS para funciones Vercel
- [ ] Actualizar políticas de CSP para webcam

---

## 📚 Documentación Adicional

### Para Desarrolladores
- [ ] Documentar formato esperado de facturas DIAN
- [ ] Guía de troubleshooting para problemas de QR
- [ ] API documentation para funciones Vercel

### Para Usuarios
- [ ] Tutorial de uso de escáner QR
- [ ] FAQ sobre facturas electrónicas
- [ ] Guía de resolución de problemas comunes

---

## 🎯 Notas y Consideraciones

### Limitaciones Conocidas
- Dependiente de formato estándar de facturas DIAN
- Requiere acceso a cámara del dispositivo
- Performance limitada por tamaño del PDF

### Mejoras Futuras
- Soporte para facturas de otros países
- OCR para facturas físicas escaneadas
- Integración con sistemas contables externos
- Machine learning para mejor categorización

### Riesgos y Mitigaciones
- **Riesgo**: Cambios en formato de facturas DIAN → **Mitigación**: Parser flexible y actualizaciones regulares
- **Riesgo**: Problemas de acceso a cámara → **Mitigación**: Fallback a subida manual de imagen
- **Riesgo**: PDFs con formato no estándar → **Mitigación**: Validación robusta y manejo de errores

---

*Documento creado: [Fecha]*  
*Última actualización: [Fecha]*  
*Responsable: [Nombre del desarrollador]* 