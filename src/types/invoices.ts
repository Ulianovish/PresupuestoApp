// Tipos para facturas electrónicas DIAN (CUFE)

// Estructura de item tal como la devuelve factura-dian.vercel.app
export interface InvoiceItem {
  description: string;
  code?: string;
  item_number?: number;
  unit_measure?: string;
  quantity: number;
  unit_price: number;
  iva_amount?: number;
  iva_percent?: number;
  inc_amount?: number;
  inc_percent?: number;
  total_price: number; // total de línea (OJO: no es `total`)
}

export interface InvoiceDetails {
  cufe: string;
  storeName: string;
  date: string;
  currency: string;
  nit: string;
  subtotal: number;
  total_amount: number;
}

export interface CufeProcessResult {
  success: boolean;
  invoice_details: InvoiceDetails;
  items: InvoiceItem[];
  processing_info?: {
    total_time?: number;
    items_found?: number;
    extraction_method?: string;
    [key: string]: unknown;
  };
  pdf_download?: {
    filename: string;
    content_type: string;
    base64: string;
    size_bytes: number;
    size_kb: number;
  };
  error?: string;
}

export interface SSEEvent {
  step:
    | 'init'
    | 'fetching'
    | 'captcha'
    | 'extracting'
    | 'complete'
    | 'error'
    | string;
  message?: string;
  details?: string;
  progress?: number;
  method?: string;
  download_pdf?: boolean;
  result?: CufeProcessResult;
  error?: string;
}

// --- Persistencia (tabla electronic_invoices) ---

export type InvoiceStatus =
  | 'processing'
  | 'pending_review'
  | 'approved'
  | 'error';

// Item enriquecido que guardamos en la fila (con categoría sugerida/elegida).
export interface StoredInvoiceItem extends InvoiceItem {
  suggested_category: string;
  category: string;
}

export interface ElectronicInvoice {
  id: string;
  user_id: string;
  cufe_code: string;
  supplier_name: string | null;
  supplier_nit: string | null;
  invoice_date: string | null;
  currency: string | null;
  subtotal: number | null;
  total_amount: number | null;
  items: StoredInvoiceItem[];
  status: InvoiceStatus;
  selected_account_name: string | null;
  error_message: string | null;
  processing_time_ms: number | null;
  created_at: string;
  processed_at: string | null;
  approved_at: string | null;
}
