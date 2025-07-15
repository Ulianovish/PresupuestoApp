/**
 * Servicios para gestionar ingresos y deudas con Supabase
 *
 * Este archivo contiene todas las funciones para realizar operaciones CRUD
 * sobre las tablas de ingresos y deudas en Supabase.
 */

import { supabase } from '@/lib/supabase/client';

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface Ingreso {
  id: string;
  user_id: string;
  descripcion: string;
  fuente: string;
  monto: number;
  fecha: string;
  tipo: 'ingreso';
  es_activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Deuda {
  id: string;
  user_id: string;
  descripcion: string;
  acreedor: string;
  monto: number;
  fecha_vencimiento: string;
  pagada: boolean;
  tipo: 'deuda';
  es_activo: boolean;
  created_at: string;
  updated_at: string;
}

// Tipos para crear nuevos registros (sin campos autogenerados)
export interface NuevoIngreso {
  descripcion: string;
  fuente: string;
  monto: number;
  fecha: string;
}

export interface NuevaDeuda {
  descripcion: string;
  acreedor: string;
  monto: number;
  fecha_vencimiento: string;
}

// Tipo para resumen financiero
export interface ResumenFinanciero {
  totalIngresos: number;
  totalDeudas: number;
  balanceNeto: number;
  cantidadIngresos: number;
  cantidadDeudas: number;
  deudasPendientes: number;
}

// ============================================
// FUNCIONES PARA INGRESOS
// ============================================

/**
 * Obtener todos los ingresos del usuario autenticado
 */
export async function obtenerIngresos(): Promise<Ingreso[]> {
  try {
    const { data, error } = await supabase
      .from('ingresos')
      .select('*')
      .eq('es_activo', true)
      .order('fecha', { ascending: false });

    if (error) {
      console.error('Error al obtener ingresos:', error);
      throw new Error('No se pudieron cargar los ingresos');
    }

    return data || [];
  } catch (error) {
    console.error('Error en obtenerIngresos:', error);
    throw error;
  }
}

/**
 * Crear un nuevo ingreso
 */
export async function crearIngreso(
  nuevoIngreso: NuevoIngreso,
): Promise<Ingreso> {
  try {
    // Verificar que el usuario esté autenticado
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    const { data, error } = await supabase
      .from('ingresos')
      .insert([
        {
          user_id: user.id,
          descripcion: nuevoIngreso.descripcion,
          fuente: nuevoIngreso.fuente,
          monto: nuevoIngreso.monto,
          fecha: nuevoIngreso.fecha,
          tipo: 'ingreso',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error al crear ingreso:', error);
      throw new Error('No se pudo crear el ingreso');
    }

    return data;
  } catch (error) {
    console.error('Error en crearIngreso:', error);
    throw error;
  }
}

/**
 * Actualizar un ingreso existente
 */
export async function actualizarIngreso(
  id: string,
  datosActualizados: Partial<NuevoIngreso>,
): Promise<Ingreso> {
  try {
    const { data, error } = await supabase
      .from('ingresos')
      .update(datosActualizados)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar ingreso:', error);
      throw new Error('No se pudo actualizar el ingreso');
    }

    return data;
  } catch (error) {
    console.error('Error en actualizarIngreso:', error);
    throw error;
  }
}

/**
 * Eliminar un ingreso (soft delete)
 */
export async function eliminarIngreso(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('ingresos')
      .update({ es_activo: false })
      .eq('id', id);

    if (error) {
      console.error('Error al eliminar ingreso:', error);
      throw new Error('No se pudo eliminar el ingreso');
    }
  } catch (error) {
    console.error('Error en eliminarIngreso:', error);
    throw error;
  }
}

// ============================================
// FUNCIONES PARA DEUDAS
// ============================================

/**
 * Obtener todas las deudas del usuario autenticado
 */
export async function obtenerDeudas(): Promise<Deuda[]> {
  try {
    const { data, error } = await supabase
      .from('deudas')
      .select('*')
      .eq('es_activo', true)
      .order('fecha_vencimiento', { ascending: true });

    if (error) {
      console.error('Error al obtener deudas:', error);
      throw new Error('No se pudieron cargar las deudas');
    }

    return data || [];
  } catch (error) {
    console.error('Error en obtenerDeudas:', error);
    throw error;
  }
}

/**
 * Crear una nueva deuda
 */
export async function crearDeuda(nuevaDeuda: NuevaDeuda): Promise<Deuda> {
  try {
    // Verificar que el usuario esté autenticado
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    const { data, error } = await supabase
      .from('deudas')
      .insert([
        {
          user_id: user.id,
          descripcion: nuevaDeuda.descripcion,
          acreedor: nuevaDeuda.acreedor,
          monto: nuevaDeuda.monto,
          fecha_vencimiento: nuevaDeuda.fecha_vencimiento,
          tipo: 'deuda',
          pagada: false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error al crear deuda:', error);
      throw new Error('No se pudo crear la deuda');
    }

    return data;
  } catch (error) {
    console.error('Error en crearDeuda:', error);
    throw error;
  }
}

/**
 * Actualizar una deuda existente
 */
export async function actualizarDeuda(
  id: string,
  datosActualizados: Partial<NuevaDeuda> & { pagada?: boolean },
): Promise<Deuda> {
  try {
    const { data, error } = await supabase
      .from('deudas')
      .update(datosActualizados)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar deuda:', error);
      throw new Error('No se pudo actualizar la deuda');
    }

    return data;
  } catch (error) {
    console.error('Error en actualizarDeuda:', error);
    throw error;
  }
}

/**
 * Marcar una deuda como pagada
 */
export async function marcarDeudaComoPagada(id: string): Promise<Deuda> {
  return actualizarDeuda(id, { pagada: true });
}

/**
 * Eliminar una deuda (soft delete)
 */
export async function eliminarDeuda(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('deudas')
      .update({ es_activo: false })
      .eq('id', id);

    if (error) {
      console.error('Error al eliminar deuda:', error);
      throw new Error('No se pudo eliminar la deuda');
    }
  } catch (error) {
    console.error('Error en eliminarDeuda:', error);
    throw error;
  }
}

// ============================================
// FUNCIONES DE RESUMEN
// ============================================

/**
 * Obtener resumen financiero completo del usuario
 */
export async function obtenerResumenFinanciero(): Promise<ResumenFinanciero> {
  try {
    // Obtener ingresos y deudas en paralelo
    const [ingresos, deudas] = await Promise.all([
      obtenerIngresos(),
      obtenerDeudas(),
    ]);

    // Calcular totales
    const totalIngresos = ingresos
      .filter(ingreso => ingreso.monto > 0)
      .reduce((sum, ingreso) => sum + ingreso.monto, 0);

    const totalDeudas = deudas
      .filter(deuda => !deuda.pagada)
      .reduce((sum, deuda) => sum + deuda.monto, 0);

    const balanceNeto = totalIngresos - totalDeudas;
    const cantidadIngresos = ingresos.length;
    const cantidadDeudas = deudas.length;
    const deudasPendientes = deudas.filter(deuda => !deuda.pagada).length;

    return {
      totalIngresos,
      totalDeudas,
      balanceNeto,
      cantidadIngresos,
      cantidadDeudas,
      deudasPendientes,
    };
  } catch (error) {
    console.error('Error en obtenerResumenFinanciero:', error);
    throw error;
  }
}

/**
 * Inicializar datos de ejemplo para un nuevo usuario
 */
export async function inicializarDatosEjemplo(): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    // Verificar si ya tiene datos
    const [ingresosExistentes, deudasExistentes] = await Promise.all([
      obtenerIngresos(),
      obtenerDeudas(),
    ]);

    // Solo crear datos de ejemplo si no tiene ningún dato
    if (ingresosExistentes.length === 0 && deudasExistentes.length === 0) {
      // Crear ingresos de ejemplo
      const ingresosEjemplo = [
        {
          descripcion: 'Salario mensual',
          fuente: 'Phi Dimension',
          monto: 16000000,
          fecha: '2025-01-01',
        },
        {
          descripcion: 'Proyecto freelance',
          fuente: 'Hactch Works',
          monto: 16400000,
          fecha: '2025-01-01',
        },
        {
          descripcion: 'Consultoría',
          fuente: 'Hasugue',
          monto: 0,
          fecha: '2025-01-01',
        },
        {
          descripcion: 'Inversión MOF',
          fuente: 'MOF',
          monto: 0,
          fecha: '2025-01-01',
        },
        {
          descripcion: 'Arriendo apartamento',
          fuente: 'Apto 216',
          monto: 0,
          fecha: '2025-01-01',
        },
        {
          descripcion: 'Arriendo parqueadero',
          fuente: 'Parking',
          monto: 100000,
          fecha: '2025-01-01',
        },
      ];

      // Crear deudas de ejemplo
      const deudasEjemplo = [
        {
          descripcion: 'Crédito vehículo',
          acreedor: 'Banco Davivienda',
          monto: 25000000,
          fecha_vencimiento: '2025-02-15',
        },
        {
          descripcion: 'Hipoteca casa',
          acreedor: 'Banco de Bogotá',
          monto: 45000000,
          fecha_vencimiento: '2025-02-01',
        },
      ];

      // Insertar en paralelo
      await Promise.all([
        ...ingresosEjemplo.map(ingreso => crearIngreso(ingreso)),
        ...deudasEjemplo.map(deuda => crearDeuda(deuda)),
      ]);

      console.log('Datos de ejemplo inicializados correctamente');
    }
  } catch (error) {
    console.error('Error al inicializar datos de ejemplo:', error);
    // No lanzar error para no bloquear la aplicación
  }
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Formatear moneda en pesos colombianos
 */
export function formatearMoneda(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Verificar si una deuda está próxima a vencer (próximos 7 días)
 */
export function estaProximaAVencer(fechaVencimiento: string): boolean {
  const hoy = new Date();
  const vencimiento = new Date(fechaVencimiento);
  const diferenciaDias = Math.ceil(
    (vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24),
  );

  return diferenciaDias <= 7 && diferenciaDias >= 0;
}

/**
 * Obtener el color para mostrar un monto según el contexto
 */
export function obtenerColorMonto(
  monto: number,
  esIngreso: boolean = true,
): string {
  if (monto === 0) return 'text-gray-500';
  return esIngreso ? 'text-emerald-400' : 'text-orange-400';
}
