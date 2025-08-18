/**
 * CUFE (Código Único de Facturación Electrónica) Validator
 * Funciones para validar y procesar códigos CUFE de facturas electrónicas
 */

/**
 * Valida si un código CUFE tiene el formato correcto
 */
export function isValidCufeFormat(cufe: string): boolean {
  // Un CUFE válido debería tener 96 caracteres hexadecimales
  const cufeRegex = /^[a-fA-F0-9]{96}$/;
  return cufeRegex.test(cufe);
}

/**
 * Valida un código CUFE
 */
export function validateCufeCode(cufe: string): {
  isValid: boolean;
  error?: string;
} {
  if (!cufe) {
    return { isValid: false, error: 'CUFE no puede estar vacío' };
  }

  if (!isValidCufeFormat(cufe)) {
    return {
      isValid: false,
      error: 'CUFE debe tener exactamente 96 caracteres hexadecimales',
    };
  }

  return { isValid: true };
}

/**
 * Normaliza un código CUFE removiendo espacios y convirtiendo a mayúsculas
 */
export function normalizeCufeCode(cufe: string): string {
  return cufe.replace(/\s+/g, '').toUpperCase();
}

/**
 * Extrae el CUFE de un código QR de factura electrónica DIAN
 */
export function extractCufeFromQR(qrData: string): string | null {
  try {
    // Los QR de la DIAN tienen formato específico
    // Buscar el CUFE en el texto del QR
    const cufeMatch = qrData.match(/[a-fA-F0-9]{96}/);
    return cufeMatch ? cufeMatch[0] : null;
  } catch (error) {
    console.error('Error extrayendo CUFE del QR:', error);
    return null;
  }
}

/**
 * Verifica si un QR podría ser una factura electrónica DIAN
 */
export function isPotentialDianInvoiceQR(qrData: string): boolean {
  // Verificar si contiene palabras clave de facturas DIAN
  const dianKeywords = [
    'dian.gov.co',
    'facturacionelectronica',
    'CUFE',
    'NumFac',
    'FecFac',
  ];

  return dianKeywords.some(keyword =>
    qrData.toLowerCase().includes(keyword.toLowerCase()),
  );
}
