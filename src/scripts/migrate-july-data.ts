/**
 * Script para migrar datos mockeados de julio 2025 a Supabase
 * Ejecutar este script una vez para poblar la base de datos con datos reales
 */

import { createClient } from '@/lib/supabase/client';

// Datos mockeados del archivo original
const julyMockData = [
  {
    categoria: 'VIVIENDA',
    items: [
      {
        descripcion: 'Cuota Apto',
        fecha: '5/mes',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 3100000,
        real: 4357000,
      },
      {
        descripcion: 'Administración',
        fecha: '29/mes',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 300000,
        real: 1624000,
      },
      {
        descripcion: 'EPM',
        fecha: '24/mes',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 709065,
        real: 0,
      },
      {
        descripcion: 'Martrix',
        fecha: '30/mes',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 450000,
        real: 450000,
      },
      {
        descripcion: 'Internet',
        fecha: '10/mes',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 76049,
        real: 93845,
      },
      {
        descripcion: 'Arreglos',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 500000,
        real: 0,
      },
      {
        descripcion: 'Remodelación',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 1200000,
        real: 0,
      },
      {
        descripcion: 'Muebles',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 150000,
        real: 75000,
      },
      {
        descripcion: 'Arriendo',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 1419000,
        real: 1410000,
      },
    ],
  },
  {
    categoria: 'DEUDAS',
    items: [
      {
        descripcion: 'TC Falabella',
        fecha: '10/mes',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 2500000,
        real: 3200000,
      },
      {
        descripcion: 'TC NuBank',
        fecha: '21/mes',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 2850000,
        real: 0,
      },
      {
        descripcion: 'Sinfa',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Carro',
        fecha: '5/mes',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 987850,
        real: 987850,
      },
      {
        descripcion: 'Gloria',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 6700000,
      },
    ],
  },
  {
    categoria: 'TRANSPORTE',
    items: [
      {
        descripcion: 'Gasolina',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 0,
        real: 8200,
      },
      {
        descripcion: 'Parking',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Lavadero',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Comprepartos',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Mantenimientos',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Cívica',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 440000,
        real: 0,
      },
      {
        descripcion: 'Licencia de conducción',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 435000,
        real: 0,
      },
      {
        descripcion: 'Didi',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 711710,
      },
      {
        descripcion: 'Metro',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Vuelos',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
    ],
  },
  {
    categoria: 'IMPUESTOS',
    items: [
      {
        descripcion: 'Impuesto Carro',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Impuesto Casa',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Impuesto Apto',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Declaración Milo',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Declaración Miguel',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Cámara de comercio',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Referyfuente',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
    ],
  },
  {
    categoria: 'AHORROS',
    items: [
      {
        descripcion: 'Inversión',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Mitierra',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Román',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 5000000,
        real: 0,
      },
    ],
  },
  {
    categoria: 'ALICE',
    items: [
      {
        descripcion: 'Matrícula Alice',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Pensión Alice',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 1620750,
        real: 0,
      },
      {
        descripcion: 'Alimentación Alice',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 547071,
        real: 0,
      },
      {
        descripcion: 'Útiles Alice',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Trabajos Alice',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Ropa Alice',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Zapatos Alice',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Cursos Alice',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 137500,
        real: 0,
      },
      {
        descripcion: 'Juguetes Alice',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
    ],
  },
  {
    categoria: 'ABRIL',
    items: [
      {
        descripcion: 'Matrícula Abril',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Pensión Abril',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Alimentación Abril',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Útiles Abril',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Trabajos Abril',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Ropa Abril',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Zapatos Abril',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Cursos Abril',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 47500,
        real: 0,
      },
      {
        descripcion: 'Juguetes Abril',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 150000,
      },
    ],
  },
  {
    categoria: 'MASCOTAS',
    items: [
      {
        descripcion: 'Comida Mascotas',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 45000,
        real: 0,
      },
      {
        descripcion: 'Arena',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 17000,
        real: 0,
      },
      {
        descripcion: 'Juguetes',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Veterinario',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Vacunas',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Purga',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
    ],
  },
  {
    categoria: 'EDUCACIÓN',
    items: [
      {
        descripcion: 'Curso online',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 179000,
        real: 0,
      },
      {
        descripcion: 'Capacitaciones',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Conferencias',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Presencial',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Libros',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Membresía',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 200000,
        real: 0,
      },
    ],
  },
  {
    categoria: 'COMUNICACIONES',
    items: [
      {
        descripcion: 'Minutos',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 46751,
        real: 0,
      },
      {
        descripcion: 'Celular',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Recargas',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Minutos Miguel',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
    ],
  },
  {
    categoria: 'SALUD',
    items: [
      {
        descripcion: 'Seguridad Social',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 425000,
        real: 0,
      },
      {
        descripcion: 'Eps',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Medicamentos',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Copagos',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Vitaminas',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Suplementos',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 304000,
        real: 0,
      },
      {
        descripcion: 'Dentista',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Droguería',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 0,
        real: 25735,
      },
    ],
  },
  {
    categoria: 'MERCADO',
    items: [
      {
        descripcion: 'Verduras y frutas',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 350000,
        real: 60524,
      },
      {
        descripcion: 'Carnes',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 400000,
        real: 175256,
      },
      {
        descripcion: 'Lacena',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 150000,
        real: 32727,
      },
      {
        descripcion: 'Dulces',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 20000,
        real: 0,
      },
      {
        descripcion: 'Aseo',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Necesario',
        presupuestado: 180000,
        real: 0,
      },
      {
        descripcion: 'Congelados',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 80000,
        real: 0,
      },
      {
        descripcion: 'Licores',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 44000,
      },
      {
        descripcion: 'Varios',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 30000,
        real: 0,
      },
    ],
  },
  {
    categoria: 'GASTOS PERSONALES',
    items: [
      {
        descripcion: 'Salidas',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 250000,
        real: 0,
      },
      {
        descripcion: 'Restaurantes',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 200000,
        real: 0,
      },
      {
        descripcion: 'Juegos',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 50000,
        real: 0,
      },
      {
        descripcion: 'Paseos',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Cine',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Diversión y Ocio',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Compras',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Regalos',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'CUIDADO PERSONAL',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Vestuario',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Maquillaje',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Peluquería',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Zapatos',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Libros',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Barbería',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Zapatos Mg',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Vestuario Mg',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Libros',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'SUSCRIPCIONES',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Suscripción Pappi',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Suscripción Chat GPT',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Discrecional',
        presupuestado: 80000,
        real: 0,
      },
      {
        descripcion: 'Suscripción Netflix',
        fecha: '',
        clasificacion: 'Fijo',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'VACACIONES',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 157446,
        real: 157446,
      },
      {
        descripcion: 'Vuelos',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 157446,
        real: 0,
      },
      {
        descripcion: 'Hotel',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
      {
        descripcion: 'Alimentación',
        fecha: '',
        clasificacion: 'Variable',
        control: 'Discrecional',
        presupuestado: 0,
        real: 0,
      },
    ],
  },
];

/**
 * Función principal para migrar los datos
 */
export async function migrateJulyData() {
  const supabase = createClient();

  try {
    console.log('🚀 Iniciando migración de datos de julio 2025...');

    // 1. Verificar autenticación
    const { data: user, error: authError } = await supabase.auth.getUser();
    if (authError || !user.user) {
      throw new Error('Usuario no autenticado');
    }

    console.log('✅ Usuario autenticado:', user.user.email);

    // 2. Crear o obtener template para julio 2025
    console.log('📝 Creando template de presupuesto para julio...');
    const { data: templateId, error: templateError } = await supabase.rpc(
      'upsert_monthly_budget',
      {
        p_user_id: user.user.id,
        p_month_year: '2025-07',
        p_template_name: 'Presupuesto Julio 2025',
      },
    );

    if (templateError || !templateId) {
      throw new Error(`Error creando template: ${templateError?.message}`);
    }

    console.log('✅ Template creado con ID:', templateId);

    // 3. Obtener IDs de categorías, clasificaciones y controles
    console.log('📋 Obteniendo referencias de la base de datos...');

    const [
      categoriesResult,
      classificationsResult,
      controlsResult,
      statusResult,
    ] = await Promise.all([
      supabase.from('categories').select('id, name'),
      supabase.from('classifications').select('id, name'),
      supabase.from('controls').select('id, name'),
      supabase
        .from('budget_statuses')
        .select('id, name')
        .eq('name', 'Activo')
        .single(),
    ]);

    if (
      categoriesResult.error ||
      classificationsResult.error ||
      controlsResult.error ||
      statusResult.error
    ) {
      throw new Error('Error obteniendo referencias de la base de datos');
    }

    // Crear mapas para búsqueda rápida
    const categoriesMap = new Map(
      categoriesResult.data?.map(c => [c.name, c.id]) || [],
    );
    const classificationsMap = new Map(
      classificationsResult.data?.map(c => [c.name, c.id]) || [],
    );
    const controlsMap = new Map(
      controlsResult.data?.map(c => [c.name, c.id]) || [],
    );
    const activeStatusId = statusResult.data?.id;

    console.log('✅ Referencias obtenidas');

    // 4. Migrar cada categoría y sus items
    let totalItems = 0;
    let successfulItems = 0;

    for (const categoryData of julyMockData) {
      console.log(`\n📁 Procesando categoría: ${categoryData.categoria}`);

      const categoryId = categoriesMap.get(categoryData.categoria);
      if (!categoryId) {
        console.warn(`⚠️  Categoría no encontrada: ${categoryData.categoria}`);
        continue;
      }

      for (const item of categoryData.items) {
        totalItems++;

        try {
          const classificationId = classificationsMap.get(item.clasificacion);
          const controlId = controlsMap.get(item.control);

          if (!classificationId || !controlId) {
            console.warn(
              `⚠️  Referencias no encontradas para item: ${item.descripcion}`,
            );
            continue;
          }

          // Insertar item
          const { error: itemError } = await supabase
            .from('budget_items')
            .insert({
              user_id: user.user.id,
              template_id: templateId,
              category_id: categoryId,
              classification_id: classificationId,
              control_id: controlId,
              status_id: activeStatusId,
              name: item.descripcion,
              budgeted_amount: item.presupuestado,
              real_amount: item.real,
              due_date: item.fecha || null,
            });

          if (itemError) {
            console.error(
              `❌ Error insertando item ${item.descripcion}:`,
              itemError.message,
            );
          } else {
            successfulItems++;
            console.log(
              `  ✅ ${item.descripcion} - $${item.presupuestado.toLocaleString()}`,
            );
          }
        } catch (error) {
          console.error(`❌ Error procesando item ${item.descripcion}:`, error);
        }
      }
    }

    console.log('\n🎉 Migración completada:');
    console.log(`   📊 Total items procesados: ${totalItems}`);
    console.log(`   ✅ Items migrados exitosamente: ${successfulItems}`);
    console.log(`   ❌ Items fallidos: ${totalItems - successfulItems}`);

    return {
      success: true,
      totalItems,
      successfulItems,
      failedItems: totalItems - successfulItems,
    };
  } catch (error) {
    console.error('💥 Error durante la migración:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Función para verificar el estado de la migración
 */
export async function checkMigrationStatus() {
  const supabase = createClient();

  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error('Usuario no autenticado');
    }

    // Verificar si existe el template para julio
    const { data: budgetData, error } = await supabase.rpc(
      'get_budget_by_month',
      {
        p_user_id: user.user.id,
        p_month_year: '2025-07',
      },
    );

    if (error) {
      throw new Error(`Error verificando migración: ${error.message}`);
    }

    return {
      migrated: budgetData && budgetData.length > 0,
      itemCount: budgetData?.length || 0,
    };
  } catch (error) {
    console.error('Error verificando estado de migración:', error);
    return {
      migrated: false,
      itemCount: 0,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}
