/**
 * Tipos TypeScript para Facturas Electrónicas DIAN
 * Incluye interfaces para el manejo de facturas, códigos CUFE y datos extraídos
 */

import { Database } from './database';

// Tipos base de la base de datos
export type ElectronicInvoiceRow =
  Database['public']['Tables']['electronic_invoices']['Row'];
export type ElectronicInvoiceInsert =
  Database['public']['Tables']['electronic_invoices']['Insert'];
export type ElectronicInvoiceUpdate =
  Database['public']['Tables']['electronic_invoices']['Update'];

// Interfaz principal para facturas electrónicas
export interface ElectronicInvoice {
  id: string;
  user_id: string;
  cufe_code: string;
  supplier_name: string | null;
  supplier_nit: string | null;
  invoice_date: string; // Formato: YYYY-MM-DD
  total_amount: number;
  extracted_data: InvoiceExtractedData | null;
  pdf_url: string | null;
  processed_at: string;
  created_at: string;
  updated_at: string;
}

// Estructura de datos extraídos del PDF de la factura
export interface InvoiceExtractedData {
  // Información del proveedor (extraída del PDF)
  supplier: {
    name: string;
    nit: string;
    address?: string;
    phone?: string;
    email?: string;
  };

  // Información del cliente/comprador
  customer?: {
    name: string;
    nit?: string;
    address?: string;
  };

  // Detalles de la factura
  invoice_details: {
    number: string; // Número de factura
    date: string; // Fecha de emisión
    due_date?: string; // Fecha de vencimiento
    currency: string; // Normalmente "COP"
  };

  // Items/productos de la factura
  items: InvoiceItem[];

  // Totales e impuestos
  totals: {
    subtotal: number; // Subtotal antes de impuestos
    tax_amount: number; // Monto total de impuestos (principalmente IVA)
    discount_amount?: number; // Descuentos aplicados
    total_amount: number; // Total final
  };

  // Detalles de impuestos
  taxes: InvoiceTax[];

  // Métodos de pago
  payment_methods?: PaymentMethod[];

  // Información adicional
  additional_info?: {
    notes?: string;
    observations?: string;
    qr_code?: string; // El código QR original
  };
}

// Item individual de la factura
export interface InvoiceItem {
  id?: string; // ID interno para el frontend
  description: string; // Descripción del producto/servicio
  quantity: number; // Cantidad
  unit_price: number; // Precio unitario
  total_price: number; // Precio total (quantity * unit_price)
  tax_rate?: number; // Tasa de impuesto aplicada (ej: 19 para IVA del 19%)
  tax_amount?: number; // Monto del impuesto
  discount_rate?: number; // Porcentaje de descuento
  discount_amount?: number; // Monto del descuento
  unit?: string; // Unidad de medida (ej: "UN", "KG", etc.)
  product_code?: string; // Código del producto si existe
}

// Impuesto aplicado en la factura
export interface InvoiceTax {
  type: string; // Tipo de impuesto (ej: "IVA", "ICA")
  rate: number; // Tasa del impuesto (ej: 19 para IVA del 19%)
  base_amount: number; // Monto base sobre el que se calcula
  tax_amount: number; // Monto del impuesto
}

// Método de pago de la factura
export interface PaymentMethod {
  type: string; // Tipo de pago (ej: "Efectivo", "Tarjeta", "Transferencia")
  amount: number; // Monto pagado con este método
  reference?: string; // Referencia del pago (ej: número de transacción)
}

// Datos para crear una nueva factura electrónica
export interface CreateElectronicInvoiceData {
  cufe_code: string;
  supplier_name?: string;
  supplier_nit?: string;
  invoice_date: string;
  total_amount: number;
  extracted_data?: InvoiceExtractedData;
  pdf_url?: string;
}

// Datos para actualizar una factura electrónica existente
export interface UpdateElectronicInvoiceData {
  supplier_name?: string;
  supplier_nit?: string;
  invoice_date?: string;
  total_amount?: number;
  extracted_data?: InvoiceExtractedData;
  pdf_url?: string;
}

// Resultado del procesamiento de una factura desde QR
export interface InvoiceProcessingResult {
  invoice: ElectronicInvoice;
  extracted_expenses: SuggestedExpense[];
  processing_status: 'success' | 'partial' | 'failed';
  processing_errors?: string[];
}

// Gasto sugerido basado en los datos de la factura
export interface SuggestedExpense {
  id: string; // ID temporal para el frontend
  description: string;
  amount: number;
  transaction_date: string;
  suggested_category: string; // Categoría sugerida basada en el tipo de proveedor
  place?: string; // Lugar (nombre del proveedor)
  original_item?: InvoiceItem; // Referencia al item original de la factura
  confidence_score?: number; // Puntuación de confianza en la categorización (0-1)
}

// Estados del procesamiento de facturas
export type InvoiceProcessingStatus =
  | 'idle' // Estado inicial
  | 'scanning' // Escaneando código QR
  | 'validating' // Validando código CUFE
  | 'downloading' // Descargando PDF
  | 'extracting' // Extrayendo datos del PDF
  | 'reviewing' // Usuario revisando datos
  | 'saving' // Guardando en base de datos
  | 'success' // Proceso completado exitosamente
  | 'error'; // Error en el proceso

// Errores específicos del procesamiento de facturas
export interface InvoiceProcessingError {
  code:
    | 'DUPLICATE_CUFE'
    | 'INVALID_CUFE'
    | 'PDF_NOT_FOUND'
    | 'EXTRACTION_FAILED'
    | 'SAVE_FAILED'
    | 'NETWORK_ERROR';
  message: string;
  details?: any;
}

// Configuración para el escáner QR
export interface QRScannerConfig {
  camera_facing: 'front' | 'back';
  scan_timeout: number; // Tiempo en milliseconds
  auto_start: boolean;
  show_overlay: boolean;
  beep_on_scan: boolean;
}

// Filtros para buscar facturas electrónicas
export interface ElectronicInvoiceFilters {
  start_date?: string;
  end_date?: string;
  supplier_name?: string;
  supplier_nit?: string;
  min_amount?: number;
  max_amount?: number;
  has_expenses?: boolean; // Si ya se crearon gastos para esta factura
}

// Estadísticas de facturas electrónicas
export interface InvoiceStatistics {
  total_invoices: number;
  total_amount: number;
  average_amount: number;
  top_suppliers: Array<{
    supplier_name: string;
    supplier_nit: string;
    invoice_count: number;
    total_amount: number;
  }>;
  monthly_totals: Array<{
    month: string; // Formato: YYYY-MM
    invoice_count: number;
    total_amount: number;
  }>;
}

// Validación de código CUFE
export interface CufeValidationResult {
  is_valid: boolean;
  format_valid: boolean;
  already_exists: boolean;
  error_message?: string;
}

// Opciones para mapeo automático de categorías
export interface CategoryMappingRule {
  supplier_pattern: string; // Patrón regex o string para el nombre del proveedor
  nit_pattern?: string; // Patrón para el NIT
  suggested_category: string; // Categoría de gasto sugerida
  confidence: number; // Confianza en la sugerencia (0-1)
  keywords?: string[]; // Palabras clave en productos que refuerzan la categoría
}

// Configuración del usuario para facturas electrónicas
export interface UserInvoiceSettings {
  auto_categorize: boolean; // Categorización automática habilitada
  default_account: string; // Cuenta por defecto para gastos de facturas
  split_by_items: boolean; // Dividir factura en gastos por item
  review_before_save: boolean; // Siempre revisar antes de guardar
  category_mapping_rules: CategoryMappingRule[]; // Reglas personalizadas de categorización
}

// Hook data para el manejo de facturas electrónicas
export interface UseElectronicInvoicesData {
  invoices: ElectronicInvoice[];
  loading: boolean;
  error: string | null;
  processing_status: InvoiceProcessingStatus;
  current_invoice: ElectronicInvoice | null;
  suggested_expenses: SuggestedExpense[];
}

// Acciones para el hook de facturas electrónicas
export interface UseElectronicInvoicesActions {
  processInvoiceFromQR: (cufeCode: string) => Promise<InvoiceProcessingResult>;
  saveInvoiceAndExpenses: (
    invoiceData: CreateElectronicInvoiceData,
    expenses: SuggestedExpense[],
  ) => Promise<void>;
  updateInvoice: (
    id: string,
    data: UpdateElectronicInvoiceData,
  ) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  getInvoicesByDateRange: (
    startDate: string,
    endDate: string,
  ) => Promise<ElectronicInvoice[]>;
  checkCufeExists: (cufeCode: string) => Promise<boolean>;
  refreshInvoices: () => Promise<void>;
}
