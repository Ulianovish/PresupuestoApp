import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de texto (vitest corre en `node`, sin DOM): se verifica el cableado
// de /gastos. vitest corre desde la raíz del repo.
const pagina = readFileSync(
  resolve(process.cwd(), 'src/app/gastos/page.tsx'),
  'utf8',
);

describe('/gastos sin categorías (contratos §2.6 y §5.2)', () => {
  // La lógica (cuándo se bloquea, con qué texto, cuándo se avisa) vive en
  // expenseSubmitGuard y missingCategoryMessage, probadas en
  // src/lib/expense-form-defaults.test.ts; el aviso del modal se prueba
  // renderizando ExpenseModal. Aquí solo se comprueba que la página las usa.
  it('el modal recibe el estado del guard puro', () => {
    expect(pagina).toContain('expenseSubmitGuard({');
    expect(pagina).toContain('submitDisabled={submitGuard.disabled}');
    expect(pagina).toContain('submitDisabledLabel={submitGuard.disabledLabel}');
  });

  it('el submit sin categoría avisa solo según missingCategoryMessage', () => {
    expect(pagina).toContain('missingCategoryMessage(categoriesLoading)');
  });

  it('useCategories arranca cargando, para no mostrar el aviso en el primer render', () => {
    const hook = readFileSync(
      resolve(process.cwd(), 'src/hooks/useCategories.ts'),
      'utf8',
    );
    expect(hook).toMatch(
      /const \[isLoading, setIsLoading\] = useState\(true\)/,
    );
  });

  it('el submit rechaza un gasto sin categoría antes de guardarlo', () => {
    const guarda = pagina.indexOf('if (!form.category_name)');
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(pagina.indexOf('await addExpense(form)'));
    expect(guarda).toBeLessThan(
      pagina.indexOf('await updateExpense(editingTransaction.id, form)'),
    );
  });
});

describe('/gastos: cuenta por defecto al importar Excel', () => {
  it('las filas sin columna de cuenta usan la cuenta por defecto del usuario', () => {
    expect(pagina).toMatch(
      /accountCol && row\[accountCol\][\s\S]{0,80}: pickDefaultAccount\(accountNames\)/,
    );
  });

  it('«Importar Excel» queda deshabilitado hasta que las cuentas cargan', () => {
    expect(pagina).toMatch(/importDisabled=\{!accountsLoaded\}/);
    expect(pagina).toMatch(/setAccountsLoaded\(true\)/);
  });

  it('un fallo al cargar las cuentas se avisa en vez de tragarse', () => {
    expect(pagina).toMatch(
      /catch \(err\) \{[\s\S]{0,200}No se pudieron cargar tus cuentas/,
    );
  });
});

describe('/gastos: fecha por defecto', () => {
  it('el formulario en blanco usa la fecha local, no la de UTC', () => {
    expect(pagina).toMatch(/transaction_date: todayLocalISO\(\)/);
    expect(pagina).not.toMatch(/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  });
});
