# 🚀 CUFE a Datos con Progreso en Tiempo Real (SSE)

Este documento explica cómo usar el endpoint **Server-Sent Events (SSE)** para mostrar progreso en tiempo real durante el procesamiento de facturas DIAN.

## 📋 Tabla de Contenidos

- [¿Qué es SSE?](#qué-es-sse)
- [Endpoint SSE](#endpoint-sse)
- [Eventos que se Emiten](#eventos-que-se-emiten)
- [Cliente JavaScript](#cliente-javascript)
- [Ejemplos de Uso](#ejemplos-de-uso)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## ¿Qué es SSE?

**Server-Sent Events (SSE)** es una tecnología web que permite al servidor enviar actualizaciones en tiempo real al cliente a través de una conexión HTTP persistente. Es perfecto para mostrar progreso de tareas de larga duración como el procesamiento de facturas DIAN.

### Ventajas vs WebSocket:
- ✅ Más simple de implementar
- ✅ Reconexión automática
- ✅ Compatible con proxies/firewalls
- ✅ Ideal para comunicación unidireccional (servidor → cliente)

## Endpoint SSE

### URL
```
GET /api/cufe-to-data-stream?cufe={CUFE}&maxRetries={RETRIES}&captchaApiKey={API_KEY}
```

### Parámetros
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `cufe` | string | ✅ | Código CUFE de la factura DIAN |
| `maxRetries` | number | ❌ | Número máximo de reintentos (default: 3) |
| `captchaApiKey` | string | ❌ | API Key de 2captcha (usa variable de entorno si no se proporciona) |

### Headers de Respuesta
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
Access-Control-Allow-Origin: *
```

## Eventos que se Emiten

### 1. `connected` - Conexión Establecida
```javascript
{
  "message": "Conexión establecida"
}
```

### 2. `progress` - Actualizaciones de Progreso
```javascript
{
  "step": "download_start",
  "message": "Descargando PDF desde DIAN...",
  "details": "Resolviendo captchas y accediendo al documento",
  "progress": 10
}
```

#### Steps de Progreso:
- `init` (0%) - Iniciando procesamiento
- `download_start` (10%) - Iniciando descarga de PDF
- `connecting_dian` (20%) - Conectando con portal DIAN
- **Eventos de Captcha (15-55%):**
  - `captcha_detected` (15%, 30%) - Captcha detectado en la página
  - `captcha_submitting` (16%, 31%) - Enviando captcha a 2captcha
  - `captcha_submitted` (17%, 32%) - Captcha enviado con Task ID
  - `captcha_checking` (18-21%, 33-36%) - Verificando solución (múltiples intentos)
  - `captcha_waiting` (19-22%, 34-37%) - Esperando entre verificaciones
  - `captcha_solved` (22%, 37%) - Captcha resuelto exitosamente
  - `captcha_injected` (25%, 40%) - Captcha completado con tiempo
  - `captcha_complete` (28%, 43%) - Captcha aplicado, continuando
- `download_complete` (60%) - PDF descargado exitosamente
- `processing_start` (70%) - Iniciando procesamiento con IA
- `ai_processing` (75%) - Analizando contenido del PDF
- `processing_complete` (90%) - Datos extraídos exitosamente
- `formatting` (95%) - Organizando datos finales
- `complete` (100%) - Procesamiento completado

### 3. `progress` - Eventos de Captcha (Detallados)
```javascript
{
  "step": "captcha_checking",
  "message": "Verificando captcha 1...",
  "details": "Intento 2/6 - Consultando estado",
  "progress": 19,
  "captcha": {
    "number": 1,
    "attempt": 2,
    "maxAttempts": 6,
    "taskId": "80279259658",
    "status": "checking",
    "type": "Cloudflare Turnstile"
  }
}
```

#### Propiedades del objeto `captcha`:
- `number` - Número del captcha (1 para el primero, 2 para el segundo)
- `type` - Tipo de captcha (ej: "Cloudflare Turnstile")
- `taskId` - ID de tarea de 2captcha (cuando está disponible)
- `status` - Estado actual: `submitting`, `submitted`, `checking`, `waiting`, `solved`, `completed`, `injected`
- `attempt` - Intento actual de verificación (1-6)
- `maxAttempts` - Máximo número de intentos de verificación
- `waitTime` - Tiempo de espera en segundos (cuando está esperando)
- `solveTime` - Tiempo que tardó en resolverse en segundos (cuando se completa)

### 4. `complete` - Procesamiento Exitoso
```javascript
{
  "step": "complete",
  "message": "Procesamiento completado exitosamente",
  "details": "63 items extraídos en 69s",
  "progress": 100,
  "result": {
    "success": true,
    "invoice_details": {
      "cufe": "fe8b0ece665f...",
      "storeName": "NOMBRE DEL PROVEEDOR",
      "date": "2024-01-15",
      "currency": "COP",
      "nit": "900123456-1",
      "subtotal": 450000,
      "total_amount": 535500
    },
    "items": [...],
    "processing_info": {
      "total_time": 69000,
      "pdf_size": 90730,
      "items_found": 63,
      "timestamp": "2024-01-15T10:30:00.000Z",
      "captchas_solved": 2
    }
  }
}
```

### 5. `error` - Error en el Procesamiento
```javascript
{
  "error": "Código CUFE inválido"
}
```

## Cliente JavaScript

### Uso del Cliente Incluido

```javascript
// Importar el cliente
import CufeSSEClient from './lib/cufe-sse-client.js';

// Crear instancia
const processor = new CufeSSEClient();

// Procesar con callbacks
processor.process('fe8b0ece665f054b2949685fc3b3f0fd681888381b5169f661f60ad2d88b3710e9a1f8200d51827c58e8011265d1e0b4', {
  onProgress: (data) => {
    // Manejar eventos específicos de captcha
    if (data.captcha) {
      const captchaInfo = data.captcha;
      console.log(`🔐 ${data.progress}% - ${data.message} (Captcha ${captchaInfo.number})`);
      
      if (captchaInfo.taskId) {
        console.log(`   Task ID: ${captchaInfo.taskId}`);
      }
      
      if (captchaInfo.attempt && captchaInfo.maxAttempts) {
        console.log(`   Intento: ${captchaInfo.attempt}/${captchaInfo.maxAttempts}`);
      }
      
      if (captchaInfo.solveTime) {
        console.log(`   Resuelto en: ${captchaInfo.solveTime}s`);
      }
      
      updateCaptchaProgress(captchaInfo);
    } else {
      // Eventos normales (no de captcha)
      console.log(`📊 ${data.progress}% - ${data.message}`);
    }
    
    updateProgressBar(data.progress);
    updateStatusMessage(data.message, data.details);
  },
  
  onComplete: (result) => {
    console.log('✅ Completado:', result);
    console.log(`🔐 Captchas resueltos: ${result.processing_info.captchas_solved}`);
    showResults(result);
  },
  
  onError: (error) => {
    console.error('❌ Error:', error);
    showError(error.message);
  },
  
  onConnect: () => {
    console.log('🔗 Conectado al servidor');
  }
}, {
  maxRetries: 3,
  captchaApiKey: 'your-2captcha-api-key'
});

// Para cancelar
processor.cancel();
```

### Cliente SSE Nativo

```javascript
function processCufeWithSSE(cufe) {
  const url = `/api/cufe-to-data-stream?cufe=${encodeURIComponent(cufe)}`;
  const eventSource = new EventSource(url);
  
  eventSource.addEventListener('progress', (event) => {
    const data = JSON.parse(event.data);
    
    // Manejar eventos específicos de captcha
    if (data.captcha) {
      const captchaInfo = data.captcha;
      
      // Mostrar información detallada del captcha
      showCaptchaProgress(captchaInfo, data.message, data.progress);
      
      // Log específico para captchas
      console.log(`🔐 Captcha ${captchaInfo.number}: ${data.message}`);
      
      if (captchaInfo.taskId) {
        console.log(`   Task ID: ${captchaInfo.taskId}`);
      }
    } else {
      // Eventos normales (no de captcha)
      console.log(`📊 ${data.progress}% - ${data.message}`);
    }
    
    updateUI(data.progress, data.message, data.details);
  });
  
  eventSource.addEventListener('complete', (event) => {
    const data = JSON.parse(event.data);
    
    // Mostrar información de captchas resueltos
    if (data.result.processing_info.captchas_solved > 0) {
      showCaptchaSummary(data.result.processing_info.captchas_solved);
    }
    
    showResults(data.result);
    eventSource.close();
  });
  
  eventSource.addEventListener('error', (event) => {
    const data = JSON.parse(event.data);
    showError(data.error);
    eventSource.close();
  });
  
  return eventSource; // Para poder cancelar después
}

// Función auxiliar para mostrar progreso de captcha
function showCaptchaProgress(captchaInfo, message, progress) {
  const captchaElement = document.getElementById(`captcha-${captchaInfo.number}`) || 
                        createCaptchaElement(captchaInfo.number);
  
  captchaElement.querySelector('.status').textContent = message;
  captchaElement.querySelector('.progress').style.width = `${progress}%`;
  
  if (captchaInfo.taskId) {
    captchaElement.querySelector('.task-id').textContent = `ID: ${captchaInfo.taskId}`;
  }
  
  if (captchaInfo.attempt && captchaInfo.maxAttempts) {
    captchaElement.querySelector('.attempts').textContent = 
      `${captchaInfo.attempt}/${captchaInfo.maxAttempts}`;
  }
}
```

## Ejemplos de Uso

### React Hook
```javascript
import { useState, useRef } from 'react';

function useCufeSSE() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [details, setDetails] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [captchaInfo, setCaptchaInfo] = useState(null);
  const eventSourceRef = useRef(null);
  
  const process = (cufe) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);
    setProgress(0);
    setCaptchaInfo(null);
    
    const url = `/api/cufe-to-data-stream?cufe=${encodeURIComponent(cufe)}`;
    eventSourceRef.current = new EventSource(url);
    
    eventSourceRef.current.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress);
      setStatus(data.message);
      setDetails(data.details || '');
      
      // Manejar información específica de captcha
      if (data.captcha) {
        setCaptchaInfo(data.captcha);
      } else {
        setCaptchaInfo(null);
      }
    });
    
    eventSourceRef.current.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data);
      setResult(data.result);
      setIsProcessing(false);
      setCaptchaInfo(null);
      eventSourceRef.current.close();
    });
    
    eventSourceRef.current.addEventListener('error', (event) => {
      const data = JSON.parse(event.data);
      setError(data.error);
      setIsProcessing(false);
      setCaptchaInfo(null);
      eventSourceRef.current.close();
    });
  };
  
  const cancel = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsProcessing(false);
    }
  };
  
  return { progress, status, details, result, error, isProcessing, captchaInfo, process, cancel };
}

// Uso en componente
function CufeProcessor() {
  const { progress, status, details, result, error, isProcessing, captchaInfo, process, cancel } = useCufeSSE();
  
  return (
    <div>
      {isProcessing && (
        <div>
          <div className="progress-bar">
            <div style={{ width: `${progress}%` }} />
          </div>
          <p>{status}</p>
          {details && <small>{details}</small>}
          
          {/* Mostrar información específica de captcha */}
          {captchaInfo && (
            <div className="captcha-info">
              <span className="captcha-badge">🔐 Captcha {captchaInfo.number}</span>
              {captchaInfo.taskId && (
                <small>ID: {captchaInfo.taskId}</small>
              )}
              {captchaInfo.attempt && captchaInfo.maxAttempts && (
                <small>Intento: {captchaInfo.attempt}/{captchaInfo.maxAttempts}</small>
              )}
              {captchaInfo.solveTime && (
                <small>Resuelto en: {captchaInfo.solveTime}s</small>
              )}
            </div>
          )}
          
          <button onClick={cancel}>Cancelar</button>
        </div>
      )}
      
      {result && (
        <div>
          <h3>✅ Factura Procesada</h3>
          <p>Proveedor: {result.invoice_details.storeName}</p>
          <p>Items: {result.items.length}</p>
          
          {/* Mostrar resumen de captchas */}
          {result.processing_info.captchas_solved > 0 && (
            <p>🔐 Captchas resueltos: {result.processing_info.captchas_solved}</p>
          )}
        </div>
      )}
      
      {error && (
        <div className="error">❌ {error}</div>
      )}
    </div>
  );
}
```

### Vue.js Composable
```javascript
import { ref, onUnmounted } from 'vue';

export function useCufeSSE() {
  const progress = ref(0);
  const status = ref('');
  const details = ref('');
  const result = ref(null);
  const error = ref(null);
  const isProcessing = ref(false);
  let eventSource = null;
  
  const process = (cufe) => {
    isProcessing.value = true;
    error.value = null;
    result.value = null;
    progress.value = 0;
    
    const url = `/api/cufe-to-data-stream?cufe=${encodeURIComponent(cufe)}`;
    eventSource = new EventSource(url);
    
    eventSource.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      progress.value = data.progress;
      status.value = data.message;
      details.value = data.details || '';
    });
    
    eventSource.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data);
      result.value = data.result;
      isProcessing.value = false;
      eventSource.close();
    });
    
    eventSource.addEventListener('error', (event) => {
      const data = JSON.parse(event.data);
      error.value = data.error;
      isProcessing.value = false;
      eventSource.close();
    });
  };
  
  const cancel = () => {
    if (eventSource) {
      eventSource.close();
      isProcessing.value = false;
    }
  };
  
  onUnmounted(() => {
    cancel();
  });
  
  return { progress, status, details, result, error, isProcessing, process, cancel };
}
```

### Vanilla JavaScript con Progress Bar
```javascript
class CufeProgressUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.eventSource = null;
    this.setupUI();
  }
  
  setupUI() {
    this.container.innerHTML = `
      <div class="cufe-input">
        <input type="text" id="cufe-input" placeholder="Ingresa el CUFE...">
        <button id="process-btn">Procesar</button>
        <button id="cancel-btn" disabled>Cancelar</button>
      </div>
      
      <div class="progress-section" style="display: none;">
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
        <div class="status">
          <h3 class="message">Iniciando...</h3>
          <p class="details"></p>
          <span class="percentage">0%</span>
        </div>
      </div>
      
      <div class="results" style="display: none;"></div>
      <div class="error" style="display: none;"></div>
    `;
    
    this.bindEvents();
  }
  
  bindEvents() {
    const processBtn = this.container.querySelector('#process-btn');
    const cancelBtn = this.container.querySelector('#cancel-btn');
    const cufeInput = this.container.querySelector('#cufe-input');
    
    processBtn.addEventListener('click', () => {
      const cufe = cufeInput.value.trim();
      if (cufe) this.process(cufe);
    });
    
    cancelBtn.addEventListener('click', () => this.cancel());
  }
  
  process(cufe) {
    this.showProgress();
    
    const url = `/api/cufe-to-data-stream?cufe=${encodeURIComponent(cufe)}`;
    this.eventSource = new EventSource(url);
    
    this.eventSource.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      this.updateProgress(data);
    });
    
    this.eventSource.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data);
      this.showResults(data.result);
    });
    
    this.eventSource.addEventListener('error', (event) => {
      const data = JSON.parse(event.data);
      this.showError(data.error);
    });
  }
  
  updateProgress(data) {
    const progressFill = this.container.querySelector('.progress-fill');
    const message = this.container.querySelector('.message');
    const details = this.container.querySelector('.details');
    const percentage = this.container.querySelector('.percentage');
    
    progressFill.style.width = `${data.progress}%`;
    message.textContent = data.message;
    details.textContent = data.details || '';
    percentage.textContent = `${data.progress}%`;
  }
  
  showProgress() {
    this.container.querySelector('.progress-section').style.display = 'block';
    this.container.querySelector('.results').style.display = 'none';
    this.container.querySelector('.error').style.display = 'none';
    this.container.querySelector('#process-btn').disabled = true;
    this.container.querySelector('#cancel-btn').disabled = false;
  }
  
  showResults(result) {
    const resultsDiv = this.container.querySelector('.results');
    resultsDiv.innerHTML = `
      <h3>✅ Factura Procesada</h3>
      <p><strong>Proveedor:</strong> ${result.invoice_details.storeName}</p>
      <p><strong>Items:</strong> ${result.items.length}</p>
      <p><strong>Total:</strong> $${result.invoice_details.total_amount.toLocaleString()}</p>
    `;
    resultsDiv.style.display = 'block';
    this.resetButtons();
  }
  
  showError(error) {
    const errorDiv = this.container.querySelector('.error');
    errorDiv.textContent = `❌ Error: ${error}`;
    errorDiv.style.display = 'block';
    this.resetButtons();
  }
  
  cancel() {
    if (this.eventSource) {
      this.eventSource.close();
      this.resetButtons();
    }
  }
  
  resetButtons() {
    this.container.querySelector('#process-btn').disabled = false;
    this.container.querySelector('#cancel-btn').disabled = true;
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}

// Uso
const processor = new CufeProgressUI('cufe-processor-container');
```

## Ejemplo de Salida de Progreso

Cuando uses cualquiera de los clientes, verás una secuencia de eventos como esta:

```bash
🔗 [CONECTADO] Conexión establecida
📊 [ 0%] [0s] Iniciando procesamiento...
📊 [10%] [1s] Descargando PDF desde DIAN...
📊 [20%] [8s] Conectando con portal DIAN...

🔐 [15%] [8s] Captcha 1 detectado (Cloudflare Turnstile)
   └─ Cloudflare Turnstile encontrado en la página
🔐 [16%] [8s] Enviando captcha 1 a 2captcha...
   └─ Solicitando resolución automática del captcha
🔐 [17%] [8s] Captcha 1 enviado [ID: 80279259658]
   └─ Task ID: 80279259658 - Esperando resolución...
🔐 [18%] [9s] Verificando captcha 1... [1/6]
   └─ Intento 1/6 - Consultando estado
🔐 [19%] [9s] Captcha 1 en proceso... [Esperando 5s]
   └─ Esperando 5s antes del siguiente intento
🔐 [20%] [14s] Verificando captcha 1... [2/6]
   └─ Intento 2/6 - Consultando estado
🔐 [21%] [14s] Captcha 1 en proceso... [Esperando 5s]
   └─ Esperando 5s antes del siguiente intento
🔐 [22%] [24s] Captcha 1 resuelto!
   └─ Solución obtenida, inyectando en la página...
🔐 [25%] [24s] Captcha 1 completado [16.2s]
   └─ Resuelto en 16.2s y aplicado exitosamente
🔐 [28%] [25s] Captcha 1 aplicado
   └─ Continuando con el proceso de descarga...

🔐 [30%] [27s] Captcha 2 detectado (Cloudflare Turnstile)
   └─ Cloudflare Turnstile encontrado en la página
🔐 [31%] [28s] Enviando captcha 2 a 2captcha...
   └─ Solicitando resolución automática del captcha
🔐 [32%] [28s] Captcha 2 enviado [ID: 80279261889]
   └─ Task ID: 80279261889 - Esperando resolución...
🔐 [33%] [29s] Verificando captcha 2... [1/6]
   └─ Intento 1/6 - Consultando estado
🔐 [34%] [29s] Captcha 2 en proceso... [Esperando 5s]
   └─ Esperando 5s antes del siguiente intento
🔐 [37%] [44s] Captcha 2 resuelto!
   └─ Solución obtenida, inyectando en la página...
🔐 [40%] [44s] Captcha 2 completado [16.2s]
   └─ Resuelto en 16.2s y aplicado exitosamente
🔐 [43%] [45s] Captcha 2 aplicado
   └─ Continuando con el proceso de descarga...

📊 [60%] [46s] PDF descargado exitosamente
   └─ Archivo de 89 KB obtenido desde DIAN
📊 [70%] [47s] Procesando PDF con IA...
   └─ Extrayendo datos estructurados con pdfplumber + camelot
📊 [75%] [48s] Analizando contenido del PDF...
   └─ Identificando tablas, items y totales de la factura
📊 [90%] [54s] Datos extraídos exitosamente
   └─ 63 items encontrados en la factura
📊 [95%] [54s] Organizando datos...
   └─ Estructurando respuesta final para el frontend

✅ [100%] [55s] Procesamiento completado exitosamente
   └─ 63 items extraídos en 55s
🔐 Captchas resueltos: 2

📊 RESUMEN DE RESULTADOS:
   🏪 Proveedor: NOMBRE DEL PROVEEDOR S.A.S.
   📅 Fecha: 2024-01-15
   💰 Subtotal: $450,000
   💰 Total: $535,500
   📋 Items: 63
   🔐 Captchas resueltos: 2
```

## Testing

### 1. Usando el Script de Prueba
```bash
# Instalar dependencia
npm install eventsource

# Ejecutar con CUFE por defecto
node test-sse-endpoint.js

# Ejecutar con CUFE personalizado
node test-sse-endpoint.js fe8b0ece665f054b2949685fc3b3f0fd681888381b5169f661f60ad2d88b3710e9a1f8200d51827c58e8011265d1e0b4
```

### 2. Usando el Cliente HTML
Abre `examples/cufe-sse-client.html` en tu navegador y prueba con un CUFE válido.

### 3. Testing con cURL (simulación)
```bash
# Verificar que el endpoint responde
curl -N -H "Accept: text/event-stream" \
  "https://factura-dian.vercel.app/api/cufe-to-data-stream?cufe=fe8b0ece665f054b2949685fc3b3f0fd681888381b5169f661f60ad2d88b3710e9a1f8200d51827c58e8011265d1e0b4"
```

## Troubleshooting

### Problemas Comunes

1. **Conexión SSE se cierra inmediatamente**
   - Verificar que el CUFE sea válido
   - Revisar logs del servidor para errores específicos
   - Comprobar que el endpoint está desplegado correctamente

2. **No se reciben eventos de progreso**
   - Verificar que el navegador soporta SSE (todos los modernos lo hacen)
   - Revisar la consola del navegador para errores de red
   - Comprobar que no hay proxies/firewalls bloqueando la conexión

3. **Error 405 Method Not Allowed**
   - Asegurarse de usar GET con query parameters para SSE
   - Verificar que la URL está correctamente formateada

4. **Timeout o conexión lenta**
   - El proceso puede tomar 1-2 minutos, esto es normal
   - Verificar la conexión a internet
   - Comprobar el balance de 2captcha si se usan muchas solicitudes

5. **Captchas que tardan mucho en resolverse**
   - Verificar balance de 2captcha con suficientes fondos
   - Los captchas pueden tomar 15-30 segundos cada uno
   - Revisar que la API key de 2captcha sea válida
   - Si un captcha falla después de 6 intentos, el proceso se reiniciará

6. **No se muestran eventos de captcha**
   - Verificar que el interceptor esté funcionando correctamente
   - Comprobar logs del servidor para errores de interceptación
   - Asegurarse de que los eventos de progreso se están procesando

### Debugging

```javascript
// Habilitar logging detallado
const eventSource = new EventSource(url);

eventSource.onopen = (event) => {
  console.log('🔗 Conexión SSE abierta:', event);
};

eventSource.onerror = (event) => {
  console.error('❌ Error SSE:', event);
  console.log('Estado de conexión:', eventSource.readyState);
  // 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
};

// Verificar estado de la conexión
setInterval(() => {
  console.log('Estado SSE:', eventSource.readyState);
}, 5000);

// Debugging específico para captchas
eventSource.addEventListener('progress', (event) => {
  const data = JSON.parse(event.data);
  
  if (data.captcha) {
    console.log('🔐 Debug Captcha:', {
      number: data.captcha.number,
      status: data.captcha.status,
      taskId: data.captcha.taskId,
      attempt: data.captcha.attempt,
      solveTime: data.captcha.solveTime,
      message: data.message,
      progress: data.progress
    });
  }
});
```

## Consideraciones de Producción

1. **Límites de Conexión**: Los navegadores tienen límites de conexiones SSE simultáneas (típicamente 6 por dominio)

2. **Timeout**: Configurar timeouts apropiados tanto en cliente como servidor

3. **Manejo de Errores**: Implementar retry automático con backoff exponencial

4. **Monitoreo**: Hacer seguimiento de conexiones activas y métricas de rendimiento

5. **Seguridad**: Validar todos los parámetros de entrada y implementar rate limiting

6. **Gestión de Captchas**: 
   - Monitorear balance de 2captcha regularmente
   - Implementar alertas cuando el balance sea bajo
   - Considerar tener múltiples API keys de respaldo
   - Logging detallado de fallos de captcha para debugging

7. **Performance de Captchas**:
   - Típicamente 2 captchas por procesamiento (15-30s cada uno)
   - Considerar timeout global de 2-3 minutos para todo el proceso
   - Implementar retry logic si un captcha específico falla repetidamente

---

## 🎯 Próximos Pasos

1. Integra el cliente SSE en tu frontend
2. Personaliza la UI de progreso según tu diseño, incluyendo indicadores específicos para captchas
3. Implementa manejo de errores robusto para captchas y conexiones SSE
4. Añade analytics para monitorear el uso y éxito de resolución de captchas
5. Considera implementar notificaciones push para procesos muy largos
6. Configura alertas de monitoreo para balance de 2captcha
7. Implementa retry logic inteligente para fallos de captcha

## 🆕 Nuevas Características - Progreso de Captchas

Con esta actualización, tus usuarios ahora pueden ver:
- ✅ **Progreso granular** de cada captcha (detectar → enviar → verificar → resolver)
- ✅ **Task IDs de 2captcha** para seguimiento detallado
- ✅ **Intentos de verificación** en tiempo real (1/6, 2/6, etc.)
- ✅ **Tiempos de resolución** exactos para cada captcha
- ✅ **Estados específicos** (checking, waiting, solved, injected)
- ✅ **Contador de captchas** resueltos en el resultado final

¡Ya tienes el sistema de progreso de captchas más avanzado para procesamiento de facturas DIAN! 🚀