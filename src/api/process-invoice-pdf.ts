/**
 * Función Vercel para procesar PDFs de facturas electrónicas DIAN
 * Extrae datos estructurados: proveedor, items, totales, fechas, etc.
 */

import { NextRequest, NextResponse } from 'next/server';

// Interfaces para los datos extraídos
interface ProcessedInvoiceData {
  supplier: {
    name: string;
    nit: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  customer?: {
    name: string;
    nit?: string;
    address?: string;
  };
  invoice_details: {
    number: string;
    date: string;
    due_date?: string;
    currency: string;
  };
  items: InvoiceItem[];
  totals: {
    subtotal: number;
    tax_amount: number;
    discount_amount?: number;
    total_amount: number;
  };
  taxes: InvoiceTax[];
  additional_info?: {
    notes?: string;
    observations?: string;
    qr_code?: string;
  };
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  tax_rate?: number;
  tax_amount?: number;
  unit?: string;
  product_code?: string;
}

interface InvoiceTax {
  type: string;
  rate: number;
  base_amount: number;
  tax_amount: number;
}

interface ProcessPDFRequest {
  cufeCode?: string;
  pdfUrl?: string;
  pdfBase64?: string;
}

interface ProcessPDFResponse {
  success: boolean;
  data?: ProcessedInvoiceData;
  error?: string;
  processing_info?: {
    method: string;
    pages_processed: number;
    text_length: number;
    extraction_time: number;
  };
}

/**
 * Descargar PDF desde URL
 */
async function downloadPdfFromUrl(url: string): Promise<Buffer> {
  console.warn(`📥 Descargando PDF desde: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/pdf,*/*',
    },
    // Timeout de 30 segundos
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(
      `Error descargando PDF: HTTP ${response.status} - ${response.statusText}`,
    );
  }

  const contentType = response.headers.get('content-type');
  if (contentType && !contentType.includes('pdf')) {
    console.warn(`⚠️ Content-Type inesperado: ${contentType}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.warn(`✅ PDF descargado exitosamente: ${buffer.length} bytes`);
  return buffer;
}

/**
 * Obtener URL del PDF usando la función CUFE existente
 */
async function getPdfUrlFromCufe(cufeCode: string): Promise<string> {
  console.warn(`🔍 Obteniendo URL del PDF para CUFE: ${cufeCode}`);

  // URL de tu función Vercel existente
  const cufeApiUrl =
    process.env.CUFE_API_URL ||
    'https://your-cufe-api.vercel.app/api/cufe-hybrid-captcha-headless';

  const response = await fetch(cufeApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cufe: cufeCode,
      returnUrl: true, // Solo queremos la URL, no descargar el PDF aún
      maxRetries: 3,
      captchaApiKey: process.env.CAPTCHA_API_KEY,
    }),
    // Timeout de 60 segundos para permitir resolución de captcha
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`Error obteniendo URL del PDF: HTTP ${response.status}`);
  }

  const result = await response.json();

  if (!result.success || !result.downloadUrl) {
    throw new Error(
      `No se pudo obtener URL del PDF: ${result.error || 'Respuesta inválida'}`,
    );
  }

  console.warn(`✅ URL del PDF obtenida: ${result.downloadUrl}`);
  return result.downloadUrl;
}

/**
 * Extraer texto del PDF usando pdf-parse
 */
async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  console.warn(`📖 Extrayendo texto del PDF (${pdfBuffer.length} bytes)...`);

  // Usar require para pdf-parse (CommonJS module)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(pdfBuffer);

  console.warn(
    `✅ Texto extraído: ${data.text.length} caracteres, ${data.numpages} páginas`,
  );
  return data.text;
}

/**
 * Parser específico para facturas DIAN
 * Extrae información estructurada del texto del PDF
 */
function parseDianInvoiceText(text: string): ProcessedInvoiceData {
  console.warn(
    `🔍 Parseando texto de factura DIAN (${text.length} caracteres)...`,
  );

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // Inicializar estructura de datos
  const invoiceData: ProcessedInvoiceData = {
    supplier: {
      name: '',
      nit: '',
    },
    invoice_details: {
      number: '',
      date: '',
      currency: 'COP',
    },
    items: [],
    totals: {
      subtotal: 0,
      tax_amount: 0,
      total_amount: 0,
    },
    taxes: [],
  };

  // Patrones regex para extraer información
  const patterns = {
    // Información del proveedor
    supplierName:
      /(?:RAZÓN SOCIAL|NOMBRE|EMPRESA)[:\s]*(.+?)(?:\n|NIT|DIRECCIÓN)/i,
    supplierNit: /NIT[:\s]*(\d+[-]?\d*)/i,
    supplierAddress: /(?:DIRECCIÓN|DIRECCIÓN)[:\s]*(.+?)(?:\n|TELÉFONO|EMAIL)/i,
    supplierPhone: /(?:TELÉFONO|TEL)[:\s]*(.+?)(?:\n|EMAIL|FAX)/i,
    supplierEmail: /(?:EMAIL|E-MAIL|CORREO)[:\s]*(.+?)(?:\n|$)/i,

    // Detalles de la factura
    invoiceNumber: /(?:FACTURA|NÚMERO|No\.)[:\s#]*(\d+)/i,
    invoiceDate: /(?:FECHA|DATE)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
    dueDate: /(?:VENCIMIENTO|VENCE)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,

    // Montos
    subtotal: /(?:SUBTOTAL|SUB-TOTAL)[:\s]*[\$]?\s*([\d,]+\.?\d*)/i,
    iva: /(?:IVA|I\.V\.A)[:\s]*[\$]?\s*([\d,]+\.?\d*)/i,
    total: /(?:TOTAL|TOTAL A PAGAR)[:\s]*[\$]?\s*([\d,]+\.?\d*)/i,

    // Items - patrón más general para productos
    itemLine:
      /^(.+?)\s+(\d+(?:\.\d+)?)\s+[\$]?\s*([\d,]+\.?\d*)\s+[\$]?\s*([\d,]+\.?\d*)$/,
  };

  // Extraer información del proveedor
  const supplierNameMatch = text.match(patterns.supplierName);
  if (supplierNameMatch) {
    invoiceData.supplier.name = supplierNameMatch[1].trim();
  }

  const supplierNitMatch = text.match(patterns.supplierNit);
  if (supplierNitMatch) {
    invoiceData.supplier.nit = supplierNitMatch[1].replace('-', '');
  }

  const supplierAddressMatch = text.match(patterns.supplierAddress);
  if (supplierAddressMatch) {
    invoiceData.supplier.address = supplierAddressMatch[1].trim();
  }

  const supplierPhoneMatch = text.match(patterns.supplierPhone);
  if (supplierPhoneMatch) {
    invoiceData.supplier.phone = supplierPhoneMatch[1].trim();
  }

  const supplierEmailMatch = text.match(patterns.supplierEmail);
  if (supplierEmailMatch) {
    invoiceData.supplier.email = supplierEmailMatch[1].trim();
  }

  // Extraer detalles de la factura
  const invoiceNumberMatch = text.match(patterns.invoiceNumber);
  if (invoiceNumberMatch) {
    invoiceData.invoice_details.number = invoiceNumberMatch[1];
  }

  const invoiceDateMatch = text.match(patterns.invoiceDate);
  if (invoiceDateMatch) {
    // Convertir fecha a formato YYYY-MM-DD
    const dateStr = invoiceDateMatch[1];
    const [day, month, year] = dateStr.split(/[\/\-]/);
    invoiceData.invoice_details.date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const dueDateMatch = text.match(patterns.dueDate);
  if (dueDateMatch) {
    const dateStr = dueDateMatch[1];
    const [day, month, year] = dateStr.split(/[\/\-]/);
    invoiceData.invoice_details.due_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Extraer montos
  const subtotalMatch = text.match(patterns.subtotal);
  if (subtotalMatch) {
    invoiceData.totals.subtotal = parseFloat(
      subtotalMatch[1].replace(/,/g, ''),
    );
  }

  const ivaMatch = text.match(patterns.iva);
  if (ivaMatch) {
    invoiceData.totals.tax_amount = parseFloat(ivaMatch[1].replace(/,/g, ''));

    // Agregar impuesto IVA
    invoiceData.taxes.push({
      type: 'IVA',
      rate: 19, // Asumir 19% por defecto
      base_amount: invoiceData.totals.subtotal,
      tax_amount: invoiceData.totals.tax_amount,
    });
  }

  const totalMatch = text.match(patterns.total);
  if (totalMatch) {
    invoiceData.totals.total_amount = parseFloat(
      totalMatch[1].replace(/,/g, ''),
    );
  }

  // Extraer items (productos/servicios)
  let itemsStartIndex = -1;
  let itemsEndIndex = -1;

  // Buscar sección de items
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (
      line.includes('descripción') ||
      line.includes('producto') ||
      line.includes('servicio')
    ) {
      itemsStartIndex = i + 1;
    }
    if (line.includes('subtotal') || line.includes('total')) {
      itemsEndIndex = i;
      break;
    }
  }

  if (itemsStartIndex > -1 && itemsEndIndex > itemsStartIndex) {
    for (let i = itemsStartIndex; i < itemsEndIndex; i++) {
      const line = lines[i];
      const itemMatch = line.match(patterns.itemLine);

      if (itemMatch) {
        const [, description, quantity, unitPrice, totalPrice] = itemMatch;

        const item: InvoiceItem = {
          description: description.trim(),
          quantity: parseFloat(quantity),
          unit_price: parseFloat(unitPrice.replace(/,/g, '')),
          total_price: parseFloat(totalPrice.replace(/,/g, '')),
        };

        // Calcular impuesto del item si es aplicable
        if (invoiceData.totals.tax_amount > 0) {
          const taxRate =
            (invoiceData.totals.tax_amount / invoiceData.totals.subtotal) * 100;
          item.tax_rate = Math.round(taxRate);
          item.tax_amount = (item.total_price * taxRate) / 100;
        }

        invoiceData.items.push(item);
      }
    }
  }

  // Si no se encontraron items específicos, crear uno general
  if (invoiceData.items.length === 0 && invoiceData.totals.total_amount > 0) {
    invoiceData.items.push({
      description: invoiceData.supplier.name
        ? `Compra en ${invoiceData.supplier.name}`
        : 'Gasto general',
      quantity: 1,
      unit_price:
        invoiceData.totals.subtotal || invoiceData.totals.total_amount,
      total_price:
        invoiceData.totals.subtotal || invoiceData.totals.total_amount,
      tax_rate: invoiceData.totals.tax_amount > 0 ? 19 : 0,
      tax_amount: invoiceData.totals.tax_amount,
    });
  }

  console.warn(
    `✅ Datos parseados: ${invoiceData.items.length} items, Total: $${invoiceData.totals.total_amount}`,
  );

  return invoiceData;
}

/**
 * Handler principal de la función Vercel
 */
export default async function handler(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    console.warn('🚀 Iniciando procesamiento de factura DIAN...');

    if (req.method !== 'POST') {
      return NextResponse.json(
        { success: false, error: 'Método no permitido. Use POST.' },
        { status: 405 },
      );
    }

    const body: ProcessPDFRequest = await req.json();
    const { cufeCode, pdfUrl, pdfBase64 } = body;

    if (!cufeCode && !pdfUrl && !pdfBase64) {
      return NextResponse.json(
        {
          success: false,
          error: 'Debe proporcionar cufeCode, pdfUrl o pdfBase64',
        },
        { status: 400 },
      );
    }

    let pdfBuffer: Buffer;
    let method: string;

    // Determinar método de obtención del PDF
    if (pdfBase64) {
      console.warn('📄 Usando PDF desde base64...');
      pdfBuffer = Buffer.from(pdfBase64, 'base64');
      method = 'base64';
    } else if (pdfUrl) {
      console.warn('🌐 Descargando PDF desde URL...');
      pdfBuffer = await downloadPdfFromUrl(pdfUrl);
      method = 'url';
    } else if (cufeCode) {
      console.warn('🔍 Obteniendo PDF desde código CUFE...');
      const downloadUrl = await getPdfUrlFromCufe(cufeCode);
      pdfBuffer = await downloadPdfFromUrl(downloadUrl);
      method = 'cufe';
    } else {
      throw new Error('Parámetros inválidos');
    }

    // Extraer texto del PDF
    const pdfText = await extractTextFromPdf(pdfBuffer);

    // Parsear datos de la factura
    const invoiceData = parseDianInvoiceText(pdfText);

    const processingTime = Date.now() - startTime;

    const response: ProcessPDFResponse = {
      success: true,
      data: invoiceData,
      processing_info: {
        method,
        pages_processed: 1, // pdf-parse no proporciona número de páginas directamente
        text_length: pdfText.length,
        extraction_time: processingTime,
      },
    };

    console.warn(`✅ Procesamiento completado en ${processingTime}ms`);

    return NextResponse.json(response);
  } catch (error: unknown) {
    const processingTime = Date.now() - startTime;

    const errorMessage =
      error instanceof Error ? error.message : 'Error desconocido';
    console.error('❌ Error procesando factura:', errorMessage);

    const errorResponse: ProcessPDFResponse = {
      success: false,
      error: errorMessage,
      processing_info: {
        method: 'unknown',
        pages_processed: 0,
        text_length: 0,
        extraction_time: processingTime,
      },
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
