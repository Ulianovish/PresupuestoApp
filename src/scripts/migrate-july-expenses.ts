/**
 * Script de migración de datos mockeados de gastos - Julio 2025
 * Migra los datos de ejemplo de gastos a Supabase
 */

import { ExpenseFormData } from '@/lib/services/expenses';
import { createClient } from '@/lib/supabase/client';

// Datos mockeados de gastos de julio 2025
const JULY_2025_EXPENSES: ExpenseFormData[] = [
  {
    description: 'Arriendo',
    amount: 1410000,
    transaction_date: '2025-07-01',
    category_name: 'VIVIENDA',
    account_name: 'Nequi',
    place: '',
  },
  {
    description: 'Administración',
    amount: 324000,
    transaction_date: '2025-07-01',
    category_name: 'VIVIENDA',
    account_name: 'Nequi',
    place: '',
  },
  {
    description: 'Cobro cuota manejo',
    amount: 14495,
    transaction_date: '2025-07-24',
    category_name: 'DEUDAS',
    account_name: 'TC Falabella',
    place: '',
  },
  {
    description: 'Didi',
    amount: 6930,
    transaction_date: '2025-07-21',
    category_name: 'TRANSPORTE',
    account_name: 'TC Falabella',
    place: '',
  },
  {
    description: 'Gasolina',
    amount: 50000,
    transaction_date: '2025-07-15',
    category_name: 'TRANSPORTE',
    account_name: 'TC Falabella',
    place: '',
  },
  {
    description: 'Lacena',
    amount: 38277,
    transaction_date: '2025-07-14',
    category_name: 'MERCADO',
    account_name: 'TC Falabella',
    place: '',
  },
];

// Cliente de Supabase
const supabase = createClient();

/**
 * Verifica si el usuario está autenticado
 */
async function checkAuthentication() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado. Por favor inicia sesión primero.');
  }

  console.log('✅ Usuario autenticado:', user.email);
  return user;
}

/**
 * Verifica si ya existen datos de gastos para julio 2025
 */
async function checkExistingJulyData(userId: string): Promise<boolean> {
  console.log('🔍 Verificando datos existentes de julio 2025...');

  const { data, error } = await supabase.rpc('get_expenses_by_month', {
    p_user_id: userId,
    p_month_year: '2025-07',
  });

  if (error) {
    console.error('Error verificando datos existentes:', error);
    return false;
  }

  const hasData = data && data.length > 0;
  console.log(`📊 Gastos existentes en julio 2025: ${data?.length || 0}`);

  return hasData;
}

/**
 * Migra un gasto individual a Supabase
 */
async function migrateExpense(
  userId: string,
  expense: ExpenseFormData,
): Promise<string | null> {
  try {
    console.log(
      `💰 Migrando: ${expense.description} - ${expense.amount.toLocaleString('es-CO')}`,
    );

    const { data, error } = await supabase.rpc('upsert_monthly_expense', {
      p_user_id: userId,
      p_description: expense.description,
      p_amount: expense.amount,
      p_transaction_date: expense.transaction_date,
      p_category_name: expense.category_name,
      p_account_name: expense.account_name,
      p_place: expense.place || null,
      p_month_year: '2025-07',
    });

    if (error) {
      console.error(`❌ Error migrando ${expense.description}:`, error);
      return null;
    }

    console.log(`✅ ${expense.description} migrado exitosamente (ID: ${data})`);
    return data;
  } catch (error) {
    console.error(
      `❌ Error inesperado migrando ${expense.description}:`,
      error,
    );
    return null;
  }
}

/**
 * Función principal de migración
 */
export async function migrateJulyExpenses(): Promise<{
  success: boolean;
  migratedCount: number;
  totalCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let migratedCount = 0;

  try {
    console.log('🚀 Iniciando migración de gastos de julio 2025...');

    // Verificar autenticación
    const user = await checkAuthentication();

    // Verificar si ya existen datos
    const hasExistingData = await checkExistingJulyData(user.id);

    if (hasExistingData) {
      const message =
        'Ya existen gastos para julio 2025. La migración se canceló para evitar duplicados.';
      console.log(`⚠️ ${message}`);
      return {
        success: false,
        migratedCount: 0,
        totalCount: JULY_2025_EXPENSES.length,
        errors: [message],
      };
    }

    console.log(`📋 Migrando ${JULY_2025_EXPENSES.length} gastos...`);

    // Migrar cada gasto
    for (const expense of JULY_2025_EXPENSES) {
      const result = await migrateExpense(user.id, expense);

      if (result) {
        migratedCount++;
      } else {
        errors.push(`Error migrando ${expense.description}`);
      }

      // Pequeña pausa para no sobrecargar la base de datos
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📊 Resumen de migración:');
    console.log(`✅ Gastos migrados exitosamente: ${migratedCount}`);
    console.log(`❌ Errores: ${errors.length}`);
    console.log(`📈 Total de gastos: ${JULY_2025_EXPENSES.length}`);

    if (errors.length > 0) {
      console.log('\n🚨 Errores encontrados:');
      errors.forEach(error => console.log(`  - ${error}`));
    }

    const success = migratedCount > 0 && errors.length === 0;

    if (success) {
      console.log('\n🎉 ¡Migración completada exitosamente!');
      console.log(
        'Los gastos de julio 2025 están ahora disponibles en Supabase.',
      );
    } else if (migratedCount > 0) {
      console.log('\n⚠️ Migración completada con algunos errores.');
    } else {
      console.log('\n❌ La migración falló completamente.');
    }

    return {
      success,
      migratedCount,
      totalCount: JULY_2025_EXPENSES.length,
      errors,
    };
  } catch (error) {
    const errorMessage = `Error general en la migración: ${error instanceof Error ? error.message : 'Error desconocido'}`;
    console.error('💥', errorMessage);

    return {
      success: false,
      migratedCount,
      totalCount: JULY_2025_EXPENSES.length,
      errors: [errorMessage, ...errors],
    };
  }
}

/**
 * Verifica el estado de la migración
 */
export async function checkMigrationStatus(): Promise<{
  hasJulyData: boolean;
  expenseCount: number;
  totalAmount: number;
}> {
  try {
    const user = await checkAuthentication();

    const { data, error } = await supabase.rpc('get_expenses_by_month', {
      p_user_id: user.id,
      p_month_year: '2025-07',
    });

    if (error) {
      console.error('Error verificando estado de migración:', error);
      return { hasJulyData: false, expenseCount: 0, totalAmount: 0 };
    }

    const expenseCount = data?.length || 0;
    const totalAmount =
      data?.reduce(
        (sum: number, expense: { amount: number }) => sum + expense.amount,
        0,
      ) || 0;

    return {
      hasJulyData: expenseCount > 0,
      expenseCount,
      totalAmount,
    };
  } catch (error) {
    console.error('Error verificando estado de migración:', error);
    return { hasJulyData: false, expenseCount: 0, totalAmount: 0 };
  }
}

/**
 * Elimina todos los gastos de julio 2025 (para testing)
 */
export async function deleteJulyExpenses(): Promise<boolean> {
  try {
    console.log('🗑️ Eliminando gastos de julio 2025...');

    const user = await checkAuthentication();

    // Necesitamos usar el JOIN para filtrar por tipo
    const { data: gastos } = await supabase.rpc('get_expenses_by_month', {
      p_user_id: user.id,
      p_month_year: '2025-07',
    });

    if (gastos && gastos.length > 0) {
      const gastoIds = gastos.map((g: { id: string }) => g.id);
      const { error } = await supabase
        .from('transactions')
        .delete()
        .in('id', gastoIds);

      if (error) {
        console.error('Error eliminando gastos de julio:', error);
        return false;
      }
    }

    console.log('✅ Gastos de julio 2025 eliminados exitosamente');
    return true;
  } catch (error) {
    console.error('Error eliminando gastos de julio:', error);
    return false;
  }
}

// Solo ejecutar si se llama directamente
if (typeof window !== 'undefined') {
  // Función helper para usar en la consola del navegador
  (window as unknown as Record<string, unknown>).migrateJulyExpenses =
    migrateJulyExpenses;
  (window as unknown as Record<string, unknown>).checkMigrationStatus =
    checkMigrationStatus;
  (window as unknown as Record<string, unknown>).deleteJulyExpenses =
    deleteJulyExpenses;

  console.log('🔧 Funciones de migración disponibles en la consola:');
  console.log('  - migrateJulyExpenses()');
  console.log('  - checkMigrationStatus()');
  console.log('  - deleteJulyExpenses()');
}
