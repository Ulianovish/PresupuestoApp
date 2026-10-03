/**
 * Los 12 índices del test de realidad financiera.
 *
 * Módulo puro (sin Supabase ni React): recibe los totales ya calculados y
 * devuelve cada índice con su valor y su lectura. Los umbrales y los nombres
 * de los niveles salen del documento "TEST DE MI REALIDAD FINANCIERA".
 *
 * Todo índice al que le falte un dato devuelve `valor: null` y nivel
 * 'sin-dato': preferimos decir "falta este dato" antes que mostrar un número
 * inventado sobre el que alguien podría tomar una decisión.
 */

export interface DatosFinancieros {
  /** Ingresos del mes (todos). */
  ingresosMes: number;
  /** Parte de los ingresos del mes que llega sin trabajarla. */
  ingresoResidualMes: number;
  /** Gastos (egresos) del mes. */
  gastosMes: number;
  /** Suma de las cuotas mensuales de todas las deudas vigentes. */
  cuotasMensuales: number;
  /** Suma del valor de los activos. */
  totalActivos: number;
  /** Suma del saldo pendiente de las deudas. */
  totalDeudas: number;
  edad?: number | null;
  horasTrabajadasMes?: number | null;
  scoreCrediticio?: number | null;
  ingresoAnualPromedio10a?: number | null;
  termostatoFinanciero?: number | null;
  horasVidaDia?: number | null;
}

export type Nivel =
  | 'excelente'
  | 'bien'
  | 'alerta'
  | 'critico'
  | 'neutro'
  | 'sin-dato';

export interface Indice {
  id: string;
  nombre: string;
  /** Qué mide, en una línea. */
  descripcion: string;
  /** El número; null cuando falta algún dato para calcularlo. */
  valor: number | null;
  /** Cómo se presenta: moneda, porcentaje, meses, veces o un número suelto. */
  formato: 'moneda' | 'porcentaje' | 'meses' | 'veces' | 'numero' | 'texto';
  nivel: Nivel;
  /** Lectura del resultado, en lenguaje de todos los días. */
  lectura: string;
  /** Qué falta para poder calcularlo (solo cuando nivel es 'sin-dato'). */
  faltante?: string;
}

const SIN_DATO = (
  id: string,
  nombre: string,
  descripcion: string,
  formato: Indice['formato'],
  faltante: string,
): Indice => ({
  id,
  nombre,
  descripcion,
  valor: null,
  formato,
  nivel: 'sin-dato',
  lectura: `Falta ${faltante} para calcularlo.`,
  faltante,
});

/** 1. Flujo de Efectivo Mensual: lo que de verdad sobra cada mes. */
export function flujoEfectivoMensual(d: DatosFinancieros): Indice {
  const valor = d.ingresosMes - d.gastosMes;
  const base = {
    id: 'fem',
    nombre: 'Flujo de Efectivo Mensual',
    descripcion: 'Ingresos del mes menos gastos del mes.',
    valor,
    formato: 'moneda' as const,
  };
  if (valor < 0)
    return {
      ...base,
      nivel: 'critico',
      lectura: 'Gastas más de lo que te entra.',
    };
  if (valor === 0)
    return {
      ...base,
      nivel: 'alerta',
      lectura: 'Todo lo que entra se va. No queda nada.',
    };
  return { ...base, nivel: 'bien', lectura: 'Te sobra dinero cada mes.' };
}

/** 2. Patrimonio Líquido: lo que queda si vendes todo y pagas todo. */
export function patrimonioLiquido(d: DatosFinancieros): Indice {
  const valor = d.totalActivos - d.totalDeudas;
  const base = {
    id: 'pl',
    nombre: 'Patrimonio Líquido',
    descripcion: 'Tus activos menos tus deudas.',
    valor,
    formato: 'moneda' as const,
  };
  if (valor < 0)
    return {
      ...base,
      nivel: 'critico',
      lectura: 'Debes más de lo que tienes.',
    };
  if (valor === 0)
    return {
      ...base,
      nivel: 'alerta',
      lectura:
        'Estás en tablas: lo que tienes alcanza justo para lo que debes.',
    };
  return { ...base, nivel: 'bien', lectura: 'Tienes más de lo que debes.' };
}

/** 3. Índice de Prosperidad Financiera: meses que aguantas sin trabajar. */
export function prosperidadFinanciera(d: DatosFinancieros): Indice {
  const id = 'ipf';
  const nombre = 'Índice de Prosperidad Financiera';
  const descripcion = 'Meses que podrías vivir igual si dejaras de trabajar.';
  if (d.gastosMes <= 0)
    return SIN_DATO(
      id,
      nombre,
      descripcion,
      'meses',
      'registrar los gastos del mes',
    );

  const valor = (d.totalActivos - d.totalDeudas) / d.gastosMes;
  const base = { id, nombre, descripcion, valor, formato: 'meses' as const };
  if (valor < 0)
    return {
      ...base,
      nivel: 'critico',
      lectura: 'No tienes con qué vivir si pierdes tus ingresos.',
    };
  if (valor <= 3)
    return {
      ...base,
      nivel: 'critico',
      lectura: 'Menos de 3 meses de autonomía: sigues en urgencias.',
    };
  if (valor <= 6)
    return {
      ...base,
      nivel: 'alerta',
      lectura: 'Entre 3 y 6 meses de autonomía. Vas bien, pero ajustado.',
    };
  return {
    ...base,
    nivel: 'bien',
    lectura: `Vives bien unos ${Math.floor(valor)} meses. ¿Y después?`,
  };
}

/** 4. Índice de Flujo de Deuda: parte del ingreso que se va en cuotas. */
export function flujoDeDeuda(d: DatosFinancieros): Indice {
  const id = 'ifd';
  const nombre = 'Índice de Flujo de Deuda';
  const descripcion =
    'Parte de tu ingreso mensual que se va en cuotas de crédito.';
  if (d.ingresosMes <= 0)
    return SIN_DATO(
      id,
      nombre,
      descripcion,
      'porcentaje',
      'registrar el ingreso del mes',
    );

  const valor = (d.cuotasMensuales / d.ingresosMes) * 100;
  const base = {
    id,
    nombre,
    descripcion,
    valor,
    formato: 'porcentaje' as const,
  };
  if (valor > 50)
    return {
      ...base,
      nivel: 'critico',
      lectura: 'Más de la mitad de tu ingreso se va en cuotas.',
    };
  if (valor > 33)
    return {
      ...base,
      nivel: 'alerta',
      lectura: 'Entre un tercio y la mitad del ingreso. Debes bajarla.',
    };
  if (valor > 10)
    return {
      ...base,
      nivel: 'bien',
      lectura: 'Entre una décima y un tercio. Estás bien y puedes mejorar.',
    };
  return {
    ...base,
    nivel: 'excelente',
    lectura: 'Por debajo del 10 %. Estás muy bien.',
  };
}

/** 5. Índice de Endeudamiento: cuánto de lo que tienes, debes. */
export function endeudamiento(d: DatosFinancieros): Indice {
  const id = 'ide';
  const nombre = 'Índice de Endeudamiento';
  const descripcion = 'Tus deudas frente a tus activos.';
  if (d.totalActivos <= 0)
    return SIN_DATO(
      id,
      nombre,
      descripcion,
      'porcentaje',
      'registrar tus activos',
    );

  const valor = (d.totalDeudas / d.totalActivos) * 100;
  const base = {
    id,
    nombre,
    descripcion,
    valor,
    formato: 'porcentaje' as const,
  };
  if (valor > 60)
    return { ...base, nivel: 'critico', lectura: 'Sobreendeudado. Es grave.' };
  if (valor >= 40)
    return { ...base, nivel: 'alerta', lectura: 'Alerta: hay que bajarlo.' };
  if (valor >= 15) return { ...base, nivel: 'bien', lectura: 'Manejable.' };
  return { ...base, nivel: 'excelente', lectura: 'Muy bueno.' };
}

/** 6. Índice de Riqueza: patrimonio esperado para tu edad e ingresos. */
export function riqueza(d: DatosFinancieros): Indice {
  const id = 'idr';
  const nombre = 'Índice de Riqueza';
  const descripcion =
    'Patrimonio que deberías tener según tu edad y tus ingresos de 10 años.';
  if (!d.edad || !d.ingresoAnualPromedio10a)
    return SIN_DATO(
      id,
      nombre,
      descripcion,
      'moneda',
      'tu fecha de nacimiento y el promedio de ingresos de 10 años',
    );

  const esperado = (d.ingresoAnualPromedio10a * d.edad) / 10;
  const pl = d.totalActivos - d.totalDeudas;
  const base = {
    id,
    nombre,
    descripcion,
    valor: esperado,
    formato: 'moneda' as const,
  };
  if (pl >= esperado * 2)
    return {
      ...base,
      nivel: 'excelente',
      lectura: 'Tu patrimonio dobla lo esperado. Excelente, lo has hecho bien.',
    };
  if (pl >= esperado)
    return {
      ...base,
      nivel: 'bien',
      lectura: 'Tu patrimonio va a la par de lo esperado. Estás bien.',
    };
  return {
    ...base,
    nivel: 'alerta',
    lectura:
      'Tu patrimonio está por debajo de lo esperado: has destruido patrimonio.',
  };
}

/** 7. Precio Hora de Vida: cuánto vale una hora de tu trabajo. */
export function precioHoraDeVida(d: DatosFinancieros): Indice {
  const id = 'phv';
  const nombre = 'Precio Hora de Vida';
  const descripcion = 'Lo que vale una hora de tu trabajo.';
  if (!d.horasTrabajadasMes || d.horasTrabajadasMes <= 0)
    return SIN_DATO(
      id,
      nombre,
      descripcion,
      'moneda',
      'las horas que trabajas al mes',
    );

  const trabajado = d.ingresosMes - d.ingresoResidualMes;
  return {
    id,
    nombre,
    descripcion,
    valor: trabajado / d.horasTrabajadasMes,
    formato: 'moneda',
    nivel: 'neutro',
    lectura: 'Es lo que cuesta una hora de tu vida trabajada.',
  };
}

/** 8. Score Crediticio: tu calificación en centrales de riesgo. */
export function scoreCrediticio(d: DatosFinancieros): Indice {
  const id = 'sc';
  const nombre = 'Score Crediticio';
  const descripcion =
    'Tu calificación en centrales de riesgo (entre 150 y 950).';
  if (!d.scoreCrediticio)
    return SIN_DATO(
      id,
      nombre,
      descripcion,
      'numero',
      'consultar tu score y registrarlo',
    );

  const valor = d.scoreCrediticio;
  const base = { id, nombre, descripcion, valor, formato: 'numero' as const };
  if (valor < 600)
    return {
      ...base,
      nivel: 'critico',
      lectura: 'Ningún banco te presta: estás mal calificado.',
    };
  if (valor < 700)
    return {
      ...base,
      nivel: 'alerta',
      lectura: 'Calificación media. Hay espacio para mejorar.',
    };
  if (valor <= 800)
    return { ...base, nivel: 'bien', lectura: 'Estás bien calificado.' };
  return {
    ...base,
    nivel: 'excelente',
    lectura: 'Excelente: tienes acceso a las mejores tasas.',
  };
}

/** 9. Índice de Dependencia: cuánto dependes de tu trabajo. */
export function dependencia(d: DatosFinancieros): Indice {
  const id = 'idd';
  const nombre = 'Índice de Dependencia';
  const descripcion =
    'Cuánto dependes de seguir trabajando para cubrir tus gastos.';
  if (d.gastosMes <= 0)
    return SIN_DATO(
      id,
      nombre,
      descripcion,
      'numero',
      'registrar los gastos del mes',
    );

  const trabajado = d.ingresosMes - d.ingresoResidualMes;
  const valor = (trabajado - d.ingresoResidualMes) / d.gastosMes;
  const base = { id, nombre, descripcion, valor, formato: 'numero' as const };
  if (valor <= 0)
    return {
      ...base,
      nivel: 'excelente',
      lectura: 'Tus ingresos residuales pagan tus gastos. Vas muy bien.',
    };
  if (valor >= 1)
    return {
      ...base,
      nivel: 'critico',
      lectura:
        'Dependes por completo de tu trabajo: si lo pierdes, no cubres tus gastos.',
    };
  return {
    ...base,
    nivel: 'alerta',
    lectura: 'Tienes que trabajar para cubrir parte de tus gastos.',
  };
}

export type EtapaProgreso = 'HÁMSTER' | 'DELFÍN' | 'ÁGUILA' | 'RINOCERONTE';

/** 10. Progreso Financiero: tu ingreso residual frente a tus gastos. */
export function progresoFinanciero(d: DatosFinancieros): Indice & {
  etapa: EtapaProgreso | null;
} {
  const id = 'pf';
  const nombre = 'Progreso Financiero';
  const descripcion = 'Tu ingreso residual comparado con tus gastos mensuales.';
  if (d.gastosMes <= 0)
    return {
      ...SIN_DATO(
        id,
        nombre,
        descripcion,
        'veces',
        'registrar los gastos del mes',
      ),
      etapa: null,
    };

  const veces = d.ingresoResidualMes / d.gastosMes;
  const base = {
    id,
    nombre,
    descripcion,
    valor: veces,
    formato: 'veces' as const,
  };
  if (veces >= 10)
    return {
      ...base,
      nivel: 'excelente',
      lectura: 'RINOCERONTE: tus ingresos residuales son 10 veces tus gastos.',
      etapa: 'RINOCERONTE',
    };
  if (veces >= 3)
    return {
      ...base,
      nivel: 'excelente',
      lectura: 'ÁGUILA: tus ingresos residuales son 3 veces tus gastos.',
      etapa: 'ÁGUILA',
    };
  if (veces >= 1)
    return {
      ...base,
      nivel: 'bien',
      lectura:
        'DELFÍN: tus ingresos residuales cubren tus gastos. Vas muy bien.',
      etapa: 'DELFÍN',
    };
  return {
    ...base,
    nivel: 'alerta',
    lectura:
      'HÁMSTER: tus ingresos residuales no alcanzan tus gastos. Hay que trabajar.',
    etapa: 'HÁMSTER',
  };
}

/** 11. Termostato Financiero: el monto que "cabe en tu mente". */
export function termostatoFinanciero(d: DatosFinancieros): Indice {
  const id = 'tf';
  const nombre = 'Termostato Financiero';
  const descripcion = 'La cantidad de dinero que te resulta normal pronunciar.';
  if (!d.termostatoFinanciero)
    return SIN_DATO(
      id,
      nombre,
      descripcion,
      'moneda',
      'registrar tu termostato',
    );

  return {
    id,
    nombre,
    descripcion,
    valor: d.termostatoFinanciero,
    formato: 'moneda',
    nivel: 'neutro',
    lectura: 'Es el techo mental que hoy te resulta cómodo.',
  };
}

/** 12. Trabajo vs Vida: horas al día en lo que amas, con quien amas. */
export function trabajoVsVida(d: DatosFinancieros): Indice {
  const id = 'tvv';
  const nombre = 'Trabajo vs Vida';
  const descripcion =
    'Horas al día que dedicas a lo que amas, con quienes amas.';
  if (d.horasVidaDia === null || d.horasVidaDia === undefined)
    return SIN_DATO(
      id,
      nombre,
      descripcion,
      'numero',
      'registrar tus horas de vida al día',
    );

  const valor = d.horasVidaDia;
  const base = { id, nombre, descripcion, valor, formato: 'numero' as const };
  if (valor < 2)
    return {
      ...base,
      nivel: 'critico',
      lectura: 'Casi no queda día para lo que amas.',
    };
  if (valor < 4)
    return {
      ...base,
      nivel: 'alerta',
      lectura: 'Poco tiempo para lo que amas.',
    };
  return {
    ...base,
    nivel: 'bien',
    lectura: 'Dedicas un buen rato del día a lo que amas.',
  };
}

/** Los 12, en el orden del documento. */
export function calcularIndices(d: DatosFinancieros): Indice[] {
  return [
    flujoEfectivoMensual(d),
    patrimonioLiquido(d),
    prosperidadFinanciera(d),
    flujoDeDeuda(d),
    endeudamiento(d),
    riqueza(d),
    precioHoraDeVida(d),
    scoreCrediticio(d),
    dependencia(d),
    progresoFinanciero(d),
    termostatoFinanciero(d),
    trabajoVsVida(d),
  ];
}

/** Edad a partir de la fecha de nacimiento. */
export function edadDesde(
  fechaNacimiento: string | null | undefined,
  hoy = new Date(),
): number | null {
  if (!fechaNacimiento) return null;
  const n = new Date(`${fechaNacimiento}T00:00:00`);
  if (Number.isNaN(n.getTime())) return null;
  let edad = hoy.getFullYear() - n.getFullYear();
  const cumpleEsteAno =
    hoy.getMonth() > n.getMonth() ||
    (hoy.getMonth() === n.getMonth() && hoy.getDate() >= n.getDate());
  if (!cumpleEsteAno) edad -= 1;
  return edad >= 0 ? edad : null;
}
