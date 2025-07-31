/**
 * Servicio para manejo de Facturas Electrónicas DIAN
 * Integra con funciones Vercel para procesamiento de códigos CUFE y PDFs
 */

import { createClient } from '@/lib/supabase/client';
import {
  ElectronicInvoice,
  InvoiceProcessingResult,
  CreateElectronicInvoiceData,
  UpdateElectronicInvoiceData,
  SuggestedExpense,
  InvoiceProcessingError,
  CufeValidationResult,
  InvoiceExtractedData,
} from '@/types/electronic-invoices';

import { ExpenseFormData } from './expenses';

// Cliente de Supabase
const supabase = createClient();

// URLs de las funciones Vercel (configurables por ambiente)
const PROCESS_PDF_API_URL =
  process.env.NEXT_PUBLIC_PROCESS_PDF_API_URL || '/api/process-invoice-pdf';

/**
 * Validar formato de código CUFE
 */
export function isValidCufeCode(cufeCode: string): boolean {
  // CUFE debe ser un UUID (8-4-4-4-12 caracteres hexadecimales)
  const cufeRegex =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  return cufeRegex.test(cufeCode);
}

/**
 * Extraer código CUFE del contenido de un QR
 */
export function extractCufeFromQR(qrContent: string): string | null {
  try {
    console.warn('🔍 Analizando contenido del QR:', qrContent);

    // Los QR de facturas DIAN contienen una URL con el CUFE
    // Formato típico: https://catalogo-vpfe.dian.gov.co/Document/FindDocument?documentKey=CUFE&partitionKey=...
    const cufeMatch = qrContent.match(/documentKey=([a-f0-9-]{36})/i);

    if (cufeMatch) {
      const cufe = cufeMatch[1];
      console.warn('✅ CUFE extraído del QR:', cufe);
      return cufe;
    }

    // Fallback: buscar cualquier patrón UUID en el contenido
    const uuidMatch = qrContent.match(
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i,
    );

    if (uuidMatch) {
      const cufe = uuidMatch[0];
      console.warn('✅ UUID encontrado en QR (fallback):', cufe);
      return cufe;
    }

    console.warn('❌ No se encontró CUFE válido en el contenido del QR');
    return null;
  } catch (error) {
    console.error('❌ Error extrayendo CUFE del QR:', error);
    return null;
  }
}

/**
 * Verificar si un código CUFE ya existe para el usuario actual
 */
export async function checkCufeExists(cufeCode: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const { data, error } = await supabase.rpc('check_cufe_exists', {
    p_user_id: user.id,
    p_cufe_code: cufeCode,
  });

  if (error) {
    console.error('Error verificando CUFE:', error);
    throw new Error(`Error verificando CUFE: ${error.message}`);
  }

  return data || false;
}

/**
 * Validar código CUFE (formato y duplicados)
 */
export async function validateCufe(
  cufeCode: string,
): Promise<CufeValidationResult> {
  const result: CufeValidationResult = {
    is_valid: false,
    format_valid: false,
    already_exists: false,
  };

  // Validar formato
  result.format_valid = isValidCufeCode(cufeCode);

  if (!result.format_valid) {
    result.error_message = 'Formato de CUFE inválido. Debe ser un UUID válido.';
    return result;
  }

  try {
    // Verificar si ya existe
    result.already_exists = await checkCufeExists(cufeCode);

    if (result.already_exists) {
      result.error_message = 'Esta factura ya ha sido procesada anteriormente.';
      return result;
    }

    result.is_valid = true;
    return result;
  } catch (error) {
    result.error_message = `Error validando CUFE: ${error instanceof Error ? error.message : 'Error desconocido'}`;
    return result;
  }
}

/**
 * Procesar factura desde código CUFE
 * Coordina todo el flujo: CUFE → URL → PDF → Datos
 */
export async function processInvoiceFromCufe(
  cufeCode: string,
): Promise<InvoiceProcessingResult> {
  console.warn('🚀 Iniciando procesamiento de factura desde CUFE:', cufeCode);

  try {
    // Paso 1: Validar CUFE
    console.warn('✅ Paso 1: Validando CUFE...');
    const validation = await validateCufe(cufeCode);

    if (!validation.is_valid) {
      throw new InvoiceProcessingError(
        'INVALID_CUFE',
        validation.error_message || 'CUFE inválido',
      );
    }

    // Paso 2: Procesar PDF usando la función que coordina todo
    console.warn('✅ Paso 2: Procesando PDF desde CUFE...');
    const response = await fetch(PROCESS_PDF_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cufeCode,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new InvoiceProcessingError(
        'PROCESSING_FAILED',
        errorData.error || `Error HTTP ${response.status}`,
      );
    }

    const processResult = await response.json();

    if (!processResult.success) {
      throw new InvoiceProcessingError(
        'EXTRACTION_FAILED',
        processResult.error || 'Error extrayendo datos del PDF',
      );
    }

    // Paso 3: Crear estructura de factura electrónica
    console.warn('✅ Paso 3: Estructurando datos de factura...');
    const invoiceData: CreateElectronicInvoiceData = {
      cufe_code: cufeCode,
      supplier_name: processResult.data.supplier?.name || '',
      supplier_nit: processResult.data.supplier?.nit || '',
      invoice_date:
        processResult.data.invoice_details?.date ||
        new Date().toISOString().split('T')[0],
      total_amount: processResult.data.totals?.total_amount || 0,
      extracted_data: processResult.data,
    };

    // Paso 4: Generar gastos sugeridos
    console.warn('✅ Paso 4: Generando gastos sugeridos...');
    const suggestedExpenses = generateSuggestedExpenses(
      processResult.data,
      invoiceData,
    );

    // Crear factura electrónica temporal (sin guardar aún)
    const tempInvoice: ElectronicInvoice = {
      id: '', // Se asignará al guardar
      user_id: '',
      cufe_code: cufeCode,
      supplier_name: invoiceData.supplier_name,
      supplier_nit: invoiceData.supplier_nit,
      invoice_date: invoiceData.invoice_date,
      total_amount: invoiceData.total_amount,
      extracted_data: invoiceData.extracted_data,
      pdf_url: null,
      processed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result: InvoiceProcessingResult = {
      invoice: tempInvoice,
      extracted_expenses: suggestedExpenses,
      processing_status: 'success',
    };

    console.warn('🎉 Procesamiento completado exitosamente');
    return result;
  } catch (error) {
    console.error('❌ Error procesando factura:', error);

    if (error instanceof InvoiceProcessingError) {
      throw error;
    }

    throw new InvoiceProcessingError(
      'PROCESSING_FAILED',
      `Error procesando factura: ${error instanceof Error ? error.message : 'Error desconocido'}`,
    );
  }
}

/**
 * Generar gastos sugeridos basados en los datos extraídos de la factura
 */
function generateSuggestedExpenses(
  extractedData: InvoiceExtractedData,
  invoiceData: CreateElectronicInvoiceData,
): SuggestedExpense[] {
  const expenses: SuggestedExpense[] = [];

  // Si hay items específicos, crear un gasto por cada item
  if (extractedData.items && extractedData.items.length > 0) {
    extractedData.items.forEach((item, index) => {
      expenses.push({
        id: `item-${index}`,
        description: item.description,
        amount: item.total_price,
        transaction_date: invoiceData.invoice_date,
        suggested_category: suggestCategoryFromDescription(item.description),
        place: invoiceData.supplier_name || '',
        original_item: item,
        confidence_score: calculateConfidenceScore(item.description),
      });
    });
  } else {
    // Si no hay items, crear un gasto general
    expenses.push({
      id: 'general-expense',
      description: invoiceData.supplier_name
        ? `Compra en ${invoiceData.supplier_name}`
        : 'Gasto desde factura electrónica',
      amount: invoiceData.total_amount,
      transaction_date: invoiceData.invoice_date,
      suggested_category: suggestCategoryFromSupplier(
        invoiceData.supplier_name || '',
      ),
      place: invoiceData.supplier_name || '',
      confidence_score: 0.8,
    });
  }

  return expenses;
}

/**
 * Sugerir categoría basada en la descripción del producto/servicio
 */
function suggestCategoryFromDescription(description: string): string {
  const desc = description.toLowerCase();

  // Mapeo de palabras clave a categorías
  const categoryMappings = {
    MERCADO: [
      'comida',
      'alimento',
      'bebida',
      'supermercado',
      'tienda',
      'mercado',
      'frutas',
      'verduras',
    ],
    TRANSPORTE: [
      'combustible',
      'gasolina',
      'uber',
      'taxi',
      'transporte',
      'peaje',
      'parking',
    ],
    VIVIENDA: [
      'arriendo',
      'alquiler',
      'servicios',
      'agua',
      'luz',
      'gas',
      'internet',
      'telefono',
    ],
    DEUDAS: ['cuota', 'credito', 'prestamo', 'financiacion', 'tarjeta'],
  };

  for (const [category, keywords] of Object.entries(categoryMappings)) {
    if (keywords.some(keyword => desc.includes(keyword))) {
      return category;
    }
  }

  return 'OTROS'; // Categoría por defecto
}

/**
 * Sugerir categoría basada en el nombre del proveedor
 */
function suggestCategoryFromSupplier(supplierName: string): string {
  const name = supplierName.toLowerCase();

  // Mapeo de tipos de proveedor a categorías
  if (
    name.includes('supermercado') ||
    name.includes('tienda') ||
    name.includes('market')
  ) {
    return 'MERCADO';
  }

  if (
    name.includes('gasolina') ||
    name.includes('combustible') ||
    name.includes('esso') ||
    name.includes('shell')
  ) {
    return 'TRANSPORTE';
  }

  if (
    name.includes('epm') ||
    name.includes('enel') ||
    name.includes('claro') ||
    name.includes('movistar')
  ) {
    return 'VIVIENDA';
  }

  if (
    name.includes('banco') ||
    name.includes('financiera') ||
    name.includes('credito')
  ) {
    return 'DEUDAS';
  }

  return 'OTROS';
}

/**
 * Calcular puntuación de confianza para la categorización automática
 */
function calculateConfidenceScore(description: string): number {
  // Lógica simple: más palabras clave = mayor confianza
  const keywords = ['comida', 'transporte', 'servicio', 'producto', 'cuota'];
  const matches = keywords.filter(keyword =>
    description.toLowerCase().includes(keyword),
  ).length;

  return Math.min(0.5 + matches * 0.2, 1.0);
}

/**
 * Guardar factura electrónica en la base de datos
 */
export async function saveElectronicInvoice(
  invoiceData: CreateElectronicInvoiceData,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const { data, error } = await supabase
    .from('electronic_invoices')
    .insert({
      user_id: user.id,
      cufe_code: invoiceData.cufe_code,
      supplier_name: invoiceData.supplier_name,
      supplier_nit: invoiceData.supplier_nit,
      invoice_date: invoiceData.invoice_date,
      total_amount: invoiceData.total_amount,
      extracted_data: invoiceData.extracted_data,
      pdf_url: invoiceData.pdf_url,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error guardando factura electrónica:', error);
    throw new Error(`Error guardando factura: ${error.message}`);
  }

  return data.id;
}

/**
 * Crear gastos desde gastos sugeridos
 */
export async function createExpensesFromSuggestions(
  invoiceId: string,
  suggestedExpenses: SuggestedExpense[],
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  // Convertir gastos sugeridos a formato de gastos
  const expensePromises = suggestedExpenses.map(async suggestion => {
    const expenseData: ExpenseFormData = {
      description: suggestion.description,
      amount: suggestion.amount,
      transaction_date: suggestion.transaction_date,
      category_name: suggestion.suggested_category,
      account_name: 'Efectivo', // Valor por defecto, el usuario puede cambiarlo
      place: suggestion.place,
      electronic_invoice_id: invoiceId,
    };

    // Usar la función existente del servicio de gastos
    const { createExpenseTransaction } = await import('./expenses');
    return createExpenseTransaction(expenseData);
  });

  await Promise.all(expensePromises);
  console.warn(`✅ ${suggestedExpenses.length} gastos creados exitosamente`);
}

/**
 * Obtener facturas electrónicas por rango de fechas
 */
export async function getElectronicInvoicesByDateRange(
  startDate: string,
  endDate: string,
): Promise<ElectronicInvoice[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const { data, error } = await supabase.rpc(
    'get_electronic_invoices_by_date_range',
    {
      p_user_id: user.id,
      p_start_date: startDate,
      p_end_date: endDate,
    },
  );

  if (error) {
    console.error('Error obteniendo facturas electrónicas:', error);
    throw new Error(`Error obteniendo facturas: ${error.message}`);
  }

  return data || [];
}

/**
 * Actualizar factura electrónica
 */
export async function updateElectronicInvoice(
  invoiceId: string,
  updateData: UpdateElectronicInvoiceData,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const { error } = await supabase
    .from('electronic_invoices')
    .update(updateData)
    .eq('id', invoiceId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error actualizando factura electrónica:', error);
    throw new Error(`Error actualizando factura: ${error.message}`);
  }
}

/**
 * Eliminar factura electrónica
 */
export async function deleteElectronicInvoice(
  invoiceId: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const { error } = await supabase
    .from('electronic_invoices')
    .delete()
    .eq('id', invoiceId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error eliminando factura electrónica:', error);
    throw new Error(`Error eliminando factura: ${error.message}`);
  }
}

/**
 * Flujo completo: Procesar y guardar factura desde CUFE
 */
export async function processAndSaveInvoiceFromCufe(cufeCode: string): Promise<{
  invoiceId: string;
  expensesCreated: number;
}> {
  console.warn('🚀 Iniciando flujo completo para CUFE:', cufeCode);

  try {
    // Paso 1: Procesar factura
    const processingResult = await processInvoiceFromCufe(cufeCode);

    if (processingResult.processing_status !== 'success') {
      throw new Error('Error procesando factura');
    }

    // Paso 2: Guardar factura en base de datos
    const invoiceData: CreateElectronicInvoiceData = {
      cufe_code: cufeCode,
      supplier_name: processingResult.invoice.supplier_name,
      supplier_nit: processingResult.invoice.supplier_nit,
      invoice_date: processingResult.invoice.invoice_date,
      total_amount: processingResult.invoice.total_amount,
      extracted_data: processingResult.invoice.extracted_data,
    };

    const invoiceId = await saveElectronicInvoice(invoiceData);

    // Paso 3: Crear gastos sugeridos
    await createExpensesFromSuggestions(
      invoiceId,
      processingResult.extracted_expenses,
    );

    console.warn('🎉 Flujo completo exitoso');

    return {
      invoiceId,
      expensesCreated: processingResult.extracted_expenses.length,
    };
  } catch (error) {
    console.error('❌ Error en flujo completo:', error);
    throw error;
  }
}

// Clase de error personalizada
export class InvoiceProcessingError extends Error {
  constructor(
    public code:
      | 'DUPLICATE_CUFE'
      | 'INVALID_CUFE'
      | 'PDF_NOT_FOUND'
      | 'EXTRACTION_FAILED'
      | 'SAVE_FAILED'
      | 'NETWORK_ERROR'
      | 'PROCESSING_FAILED',
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'InvoiceProcessingError';
  }
}
