const fs = require('fs');
const path = require('path');

// Archivos que necesitan corrección de import order
const files = [
  'src/app/api/electronic-invoices/[id]/route.ts',
  'src/app/api/electronic-invoices/route.ts', 
  'src/app/api/electronic-invoices/validate-cufe/route.ts',
  'src/components/organisms/InvoiceProcessingModal/InvoiceProcessingModal.tsx',
  'src/components/organisms/InvoiceWorkflow/InvoiceWorkflow.tsx',
  'src/components/organisms/QRInputModal/QRInputModal.tsx',
  'src/components/organisms/QRScanner/QRScanner.tsx',
  'src/components/pages/IngresosDeudas.tsx',
  'src/hooks/useElectronicInvoices.ts',
  'src/hooks/useInvoiceWorkflow.ts',
  'src/lib/services/electronic-invoices.ts'
];

function addEmptyLineBetweenImportGroups(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    let newLines = [];
    let inImportSection = false;
    let lastWasImport = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Check if this is an import line
      const isImport = trimmed.startsWith('import ') && !trimmed.includes('//');
      
      if (isImport) {
        if (inImportSection && lastWasImport) {
          // Check if we need to add empty line between different import groups
          const prevLine = newLines[newLines.length - 1];
          if (prevLine && !prevLine.trim().startsWith('import') && prevLine.trim() !== '') {
            // Different import group detected, add empty line
            if (newLines[newLines.length - 1] !== '') {
              newLines.push('');
            }
          }
        }
        inImportSection = true;
        lastWasImport = true;
      } else if (trimmed === '') {
        // Keep empty lines
        lastWasImport = false;
      } else if (inImportSection && !isImport && trimmed !== '') {
        // End of import section
        inImportSection = false;
        lastWasImport = false;
      }
      
      newLines.push(line);
    }
    
    const newContent = newLines.join('\n');
    
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`✅ Fixed import order in: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

console.log('🔧 Fixing import order...\n');

let fixedCount = 0;
files.forEach(file => {
  if (addEmptyLineBetweenImportGroups(file)) {
    fixedCount++;
  }
});

console.log(`\n✅ Fixed import order in ${fixedCount} files`);