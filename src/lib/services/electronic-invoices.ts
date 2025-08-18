/**
 * Servicio para manejo de facturas electrónicas DIAN
 * Integra con el endpoint SSE para procesamiento en tiempo real
 * y maneja la persistencia en la base de datos
 */

import { createClient } from '@/lib/supabase/client';

import {
  validateCufeCode,
  normalizeCufeCode,
} from '@/lib/validations/cufe-validator';
import { EXPENSE_CATEGORIES as _EXPENSE_CATEGORIES } from '@/lib/services/expenses';

import type {
  ElectronicInvoice,
  CreateElectronicInvoiceData,
  UpdateElectronicInvoiceData,
  InvoiceProcessingResult,
  SuggestedExpense,
  CategoryMappingRule,
} from '@/types/electronic-invoices';

// Cliente de Supabase
const supabase = createClient();

/**
 * Verifica si un código CUFE ya existe para el usuario actual
 * @param cufeCode Código CUFE a verificar
 * @returns true si ya existe
 */
export async function checkCufeExists(cufeCode: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const normalizedCufe = normalizeCufeCode(cufeCode);

  const { data, error } = await supabase.rpc('check_cufe_exists', {
    p_user_id: user.id,
    p_cufe_code: normalizedCufe,
  });

  if (error) {
    console.error('Error verificando CUFE:', error);
    throw new Error(`Error verificando duplicados: ${error.message}`);
  }

  return data || false;
}

/**
 * Procesa una factura desde código QR usando el endpoint SSE
 * @param cufeCode Código CUFE de la factura
 * @param options Opciones de procesamiento
 * @returns Promise que se resuelve cuando el procesamiento completa
 */
export async function processInvoiceFromQR(
  cufeCode: string,
  options: {
    maxRetries?: number;
    captchaApiKey?: string;
    onProgress?: (data: any) => void;
    onConnect?: () => void;
  } = {},
): Promise<InvoiceProcessingResult> {
  // Validar CUFE antes de procesar
  const validationResult = await validateCufeCode(cufeCode, checkCufeExists);

  if (!validationResult.is_valid) {
    throw new InvoiceProcessingErrorLocal(
      'INVALID_CUFE',
      validationResult.error_message || 'CUFE inválido',
    );
  }

  const normalizedCufe = normalizeCufeCode(cufeCode);

  return new Promise((resolve, reject) => {
    // Construir URL del endpoint SSE - apuntar al endpoint real
    const url = new URL(
      'https://factura-dian.vercel.app/api/cufe-to-data-stream',
    );
    url.searchParams.set('cufe', normalizedCufe);

    // Parámetros opcionales según el endpoint real
    if (options.maxRetries) {
      url.searchParams.set('maxRetries', options.maxRetries.toString());
    }

    if (options.captchaApiKey) {
      url.searchParams.set('captchaApiKey', options.captchaApiKey);
    }

    // Crear conexión SSE
    const eventSource = new EventSource(url.toString());

    // Manejar conexión establecida
    eventSource.addEventListener('open', () => {
      options.onConnect?.();
    });

    // Manejar eventos de progreso
    eventSource.addEventListener('progress', event => {
      try {
        const data = JSON.parse(event.data);
        options.onProgress?.(data);
      } catch (error) {
        console.error('Error parsing progress event:', error);
      }
    });

    // Manejar finalización exitosa
    eventSource.addEventListener('complete', event => {
      try {
        const data = JSON.parse(event.data);
        eventSource.close();

        // Convertir resultado del SSE al formato esperado
        const result = transformSSEResultToInvoiceProcessingResult(
          data.result,
          normalizedCufe,
        );
        resolve(result);
      } catch (_error) {
        eventSource.close();
        reject(
          new InvoiceProcessingErrorLocal(
            'PROCESSING_FAILED',
            'Error procesando respuesta del servidor',
          ),
        );
      }
    });

    // Manejar errores
    eventSource.addEventListener('error', event => {
      try {
        const data = JSON.parse((event as any).data);
        eventSource.close();
        reject(
          new InvoiceProcessingErrorLocal('PROCESSING_FAILED', data.error),
        );
      } catch {
        eventSource.close();
        reject(
          new InvoiceProcessingErrorLocal(
            'NETWORK_ERROR',
            'Error de conexión con el servidor',
          ),
        );
      }
    });

    // Manejar errores de conexión SSE
    eventSource.onerror = error => {
      console.error('SSE connection error:', error);
      eventSource.close();
      reject(
        new InvoiceProcessingErrorLocal(
          'NETWORK_ERROR',
          'Error de conexión SSE',
        ),
      );
    };
  });
}

/**
 * Transforma el resultado del SSE al formato esperado por el frontend
 */
function transformSSEResultToInvoiceProcessingResult(
  sseResult: any,
  cufeCode: string,
): InvoiceProcessingResult {
  const invoiceDetails = sseResult.invoice_details;
  const items = sseResult.items || [];
  const processingInfo = sseResult.processing_info || {};

  // Crear datos de factura electrónica
  const invoiceData: CreateElectronicInvoiceData = {
    cufe_code: cufeCode,
    supplier_name: invoiceDetails.storeName,
    supplier_nit: invoiceDetails.nit,
    invoice_date: invoiceDetails.date,
    total_amount: invoiceDetails.total_amount,
    extracted_data: {
      supplier: {
        name: invoiceDetails.storeName,
        nit: invoiceDetails.nit,
      },
      invoice_details: {
        number:
          invoiceDetails.invoiceNumber ||
          invoiceDetails.cufe?.substring(0, 8) ||
          '',
        date: invoiceDetails.date,
        currency: invoiceDetails.currency || 'COP',
      },
      items: items.map((item: any) => ({
        id: `item-${item.idx || item.item_number}`,
        description: item.description || 'Producto sin descripción',
        quantity: parseFloat(item.quantity) || 1,
        unit_price: parseFloat(item.unit_price) || 0,
        total_price: parseFloat(item.total_price) || 0,
        tax_rate: item.iva_percent ? parseFloat(item.iva_percent) : undefined,
        tax_amount: item.iva_amount ? parseFloat(item.iva_amount) : undefined,
        unit: item.unit_measure || undefined,
        product_code: item.code || undefined,
      })),
      totals: {
        subtotal: invoiceDetails.subtotal || 0,
        tax_amount:
          (invoiceDetails.total_amount || 0) - (invoiceDetails.subtotal || 0),
        total_amount: invoiceDetails.total_amount || 0,
      },
      taxes: [
        {
          type: 'IVA',
          rate: 19, // IVA estándar en Colombia
          base_amount: invoiceDetails.subtotal || 0,
          tax_amount:
            (invoiceDetails.total_amount || 0) - (invoiceDetails.subtotal || 0),
        },
      ],
      additional_info: {
        notes: `Procesado en ${processingInfo.total_time}ms`,
        observations: `PDF de ${processingInfo.pdf_size} bytes con ${processingInfo.items_found} items`,
      },
    },
  };

  // Generar gastos sugeridos
  const suggestedExpenses = generateSuggestedExpenses(items, invoiceDetails);

  // Crear factura temporal para el resultado
  const tempInvoice: ElectronicInvoice = {
    id: 'temp-' + Date.now(),
    user_id: '',
    cufe_code: cufeCode,
    supplier_name: invoiceDetails.storeName,
    supplier_nit: invoiceDetails.nit,
    invoice_date: invoiceDetails.date,
    total_amount: invoiceDetails.total_amount,
    extracted_data: invoiceData.extracted_data!,
    pdf_url: null,
    processed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return {
    invoice: tempInvoice,
    extracted_expenses: suggestedExpenses,
    processing_status: 'success',
    processing_errors: [],
  };
}

/**
 * Genera gastos sugeridos basados en los items de la factura
 */
function generateSuggestedExpenses(
  items: any[],
  invoiceDetails: any,
): SuggestedExpense[] {
  const expenses: SuggestedExpense[] = [];

  // Mapeo básico de categorías basado en palabras clave
  const categoryMapping: CategoryMappingRule[] = [
    {
      supplier_pattern: 'super|mercado|tienda|almacen',
      suggested_category: 'MERCADO',
      confidence: 0.8,
      keywords: ['comida', 'alimento', 'bebida', 'limpieza'],
    },
    {
      supplier_pattern: 'transporte|taxi|uber|bus|metro',
      suggested_category: 'TRANSPORTE',
      confidence: 0.9,
      keywords: ['viaje', 'pasaje', 'combustible'],
    },
    {
      supplier_pattern: 'farmacia|drogueria|medic',
      suggested_category: 'OTROS',
      confidence: 0.7,
      keywords: ['medicina', 'salud'],
    },
    {
      supplier_pattern: 'servicio|agua|luz|gas|internet|telefon',
      suggested_category: 'VIVIENDA',
      confidence: 0.8,
      keywords: ['servicio', 'factura'],
    },
  ];

  if (items.length === 0) {
    // Si no hay items, crear un gasto único con el total
    expenses.push({
      id: 'expense-1',
      description: `Compra en ${invoiceDetails.storeName}`,
      amount: invoiceDetails.total_amount,
      transaction_date: invoiceDetails.date,
      suggested_category: suggestCategoryFromSupplier(
        invoiceDetails.storeName,
        categoryMapping,
      ),
      place: invoiceDetails.storeName,
      confidence_score: 0.6,
    });
  } else {
    // Determinar si agrupar items o crear gastos individuales
    const shouldGroupItems = items.length > 10; // Si hay muchos items, agrupar

    if (shouldGroupItems) {
      // Crear un gasto único agrupado
      expenses.push({
        id: 'expense-grouped',
        description: `Compra en ${invoiceDetails.storeName} (${items.length} items)`,
        amount: invoiceDetails.total_amount,
        transaction_date: invoiceDetails.date,
        suggested_category: suggestCategoryFromSupplier(
          invoiceDetails.storeName,
          categoryMapping,
        ),
        place: invoiceDetails.storeName,
        confidence_score: 0.8,
      });
    } else {
      // Crear un gasto por cada item (solo para pocas cantidades)
      items.forEach(item => {
        const amount = parseFloat(item.total_price) || 0;
        if (amount > 0) {
          expenses.push({
            id: `expense-${item.idx || item.item_number}`,
            description: item.description || 'Producto sin descripción',
            amount,
            transaction_date: invoiceDetails.date,
            suggested_category: suggestCategoryFromItem(
              item,
              invoiceDetails.storeName,
              categoryMapping,
            ),
            place: invoiceDetails.storeName,
            original_item: {
              id: `item-${item.idx || item.item_number}`,
              description: item.description || 'Producto sin descripción',
              quantity: parseFloat(item.quantity) || 1,
              unit_price: parseFloat(item.unit_price) || 0,
              total_price: amount,
              unit: item.unit_measure || undefined,
              product_code: item.code || undefined,
            },
            confidence_score: 0.7,
          });
        }
      });
    }
  }

  return expenses;
}

/**
 * Sugiere una categoría basada en el proveedor y palabras clave
 */
function suggestCategoryFromSupplier(
  supplierName: string,
  mappingRules: CategoryMappingRule[],
): string {
  if (!supplierName) return 'OTROS';

  const lowerSupplier = supplierName.toLowerCase();

  for (const rule of mappingRules) {
    const regex = new RegExp(rule.supplier_pattern, 'i');
    if (regex.test(lowerSupplier)) {
      return rule.suggested_category;
    }
  }

  return 'OTROS'; // Categoría por defecto
}

/**
 * Sugiere una categoría basada en el item específico
 */
function suggestCategoryFromItem(
  item: Record<string, unknown>,
  supplierName: string,
  mappingRules: CategoryMappingRule[],
): string {
  const itemDescription = (item.description as string || '').toLowerCase();
  const _lowerSupplier = (supplierName || '').toLowerCase();

  // Palabras clave específicas para categorización por producto
  const productKeywords = {
    MERCADO: [
      'alime',
      'cereal',
      'arepas',
      'chocolisto',
      'ponque',
      'atun',
      'yogurt',
      'leche',
      'mantequilla',
      'helado',
      'milo',
      'pulpa',
      'avena',
      'kolag',
      'agua',
      'papa',
      'fresa',
      'lechuga',
      'brocoli',
      'papaya',
      'champinones',
      'aguacate',
      'pina',
      'ensalada',
      'harina',
      'tortillas',
      'muslos',
      'alitas',
      'crema',
      'tostadas',
      'arandano',
      'bebida',
      'comida',
      'alimento',
    ],
    OTROS: ['molde', 'plato', 'esponja', 'crema dent', 'colgate', 'papel'],
    VIVIENDA: ['servicio', 'agua', 'luz', 'gas', 'internet', 'telefono'],
    TRANSPORTE: ['combustible', 'gasolina', 'diesel', 'transporte'],
  };

  // Primero intentar categorizar por palabras clave del producto
  for (const [category, keywords] of Object.entries(productKeywords)) {
    const hasKeyword = keywords.some(keyword =>
      itemDescription.includes(keyword.toLowerCase()),
    );
    if (hasKeyword) {
      return category;
    }
  }

  // Luego intentar con las reglas de mapeo configuradas
  for (const rule of mappingRules) {
    if (rule.keywords) {
      const hasKeyword = rule.keywords.some(keyword =>
        itemDescription.includes(keyword.toLowerCase()),
      );
      if (hasKeyword) {
        return rule.suggested_category;
      }
    }
  }

  // Si no hay match por item, usar categoría del proveedor
  return suggestCategoryFromSupplier(supplierName, mappingRules);
}

/**
 * Guarda una factura electrónica en la base de datos
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
      supplier_name: invoiceData.supplier_name || undefined,
      supplier_nit: invoiceData.supplier_nit || undefined,
      invoice_date: invoiceData.invoice_date,
      total_amount: invoiceData.total_amount,
      extracted_data: invoiceData.extracted_data || undefined,
      pdf_url: invoiceData.pdf_url || undefined,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error guardando factura:', error);
    throw new Error(`Error guardando factura: ${error.message}`);
  }

  return data.id;
}

/**
 * Crea gastos en la base de datos desde los gastos sugeridos
 */
export async function createExpensesFromInvoice(
  invoiceId: string,
  expenses: SuggestedExpense[],
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  // Preparar datos para inserción en transactions
  const transactionData = expenses.map(expense => ({
    user_id: user.id,
    description: expense.description,
    amount: expense.amount,
    transaction_date: expense.transaction_date,
    category_name: expense.suggested_category,
    place: expense.place,
    month_year: expense.transaction_date.substring(0, 7), // YYYY-MM
    type_id: null, // Se establecerá por el RPC
    electronic_invoice_id: invoiceId,
  }));

  // Usar la función existente para crear gastos
  for (const txData of transactionData) {
    const { error } = await supabase.rpc('upsert_monthly_expense', {
      p_user_id: user.id,
      p_description: txData.description,
      p_amount: txData.amount,
      p_transaction_date: txData.transaction_date,
      p_category_name: txData.category_name,
      p_account_name: 'Efectivo', // Cuenta por defecto para facturas
      p_place: txData.place,
      p_month_year: txData.month_year,
    });

    if (error) {
      console.error('Error creando gasto:', error);
      throw new Error(`Error creando gasto: ${error.message}`);
    }
  }
}

/**
 * Procesa completamente una factura: valida, procesa y guarda
 */
export async function processAndSaveInvoice(
  cufeCode: string,
  options: {
    maxRetries?: number;
    captchaApiKey?: string;
    onProgress?: (data: any) => void;
    onConnect?: () => void;
  } = {},
): Promise<{
  invoiceId: string;
  invoice: ElectronicInvoice;
  expensesCreated: number;
}> {
  // 1. Procesar factura desde QR
  const processingResult = await processInvoiceFromQR(cufeCode, options);

  if (processingResult.processing_status !== 'success') {
    throw new Error(
      'Error procesando factura: ' +
        processingResult.processing_errors?.join(', '),
    );
  }

  // 2. Guardar factura en BD
  const invoiceData: CreateElectronicInvoiceData = {
    cufe_code: processingResult.invoice.cufe_code,
    supplier_name: processingResult.invoice.supplier_name || undefined,
    supplier_nit: processingResult.invoice.supplier_nit || undefined,
    invoice_date: processingResult.invoice.invoice_date,
    total_amount: processingResult.invoice.total_amount,
    extracted_data: processingResult.invoice.extracted_data || undefined,
    pdf_url: processingResult.invoice.pdf_url || undefined,
  };

  const invoiceId = await saveElectronicInvoice(invoiceData);

  // 3. Crear gastos desde los datos extraídos
  await createExpensesFromInvoice(
    invoiceId,
    processingResult.extracted_expenses,
  );

  // 4. Obtener factura guardada
  const { data: savedInvoice, error } = await supabase
    .from('electronic_invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (error) {
    throw new Error(`Error obteniendo factura guardada: ${error.message}`);
  }

  return {
    invoiceId,
    invoice: savedInvoice,
    expensesCreated: processingResult.extracted_expenses.length,
  };
}

/**
 * Obtiene facturas electrónicas por rango de fechas
 */
export async function getElectronicInvoicesByDateRange(
  startDate?: string,
  endDate?: string,
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
      p_start_date: startDate || null,
      p_end_date: endDate || null,
    },
  );

  if (error) {
    console.error('Error obteniendo facturas:', error);
    throw new Error(`Error obteniendo facturas: ${error.message}`);
  }

  return data || [];
}

/**
 * Actualiza una factura electrónica existente
 */
export async function updateElectronicInvoice(
  id: string,
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
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error actualizando factura:', error);
    throw new Error(`Error actualizando factura: ${error.message}`);
  }
}

/**
 * Elimina una factura electrónica y sus gastos relacionados
 */
export async function deleteElectronicInvoice(id: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  // Primero eliminar gastos relacionados
  const { error: expensesError } = await supabase
    .from('transactions')
    .delete()
    .eq('electronic_invoice_id', id)
    .eq('user_id', user.id);

  if (expensesError) {
    console.error('Error eliminando gastos relacionados:', expensesError);
    throw new Error(`Error eliminando gastos: ${expensesError.message}`);
  }

  // Luego eliminar la factura
  const { error } = await supabase
    .from('electronic_invoices')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error eliminando factura:', error);
    throw new Error(`Error eliminando factura: ${error.message}`);
  }
}

/**
 * Clase de error específica para procesamiento de facturas
 */
class InvoiceProcessingErrorLocal extends Error {
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
  ) {
    super(message);
    this.name = 'InvoiceProcessingError';
  }
}

// Alias para export
export const InvoiceProcessingError = InvoiceProcessingErrorLocal;
