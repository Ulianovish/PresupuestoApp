import { CONTACT_EMAIL, type LegalSection } from '@/lib/constants/legal';

/**
 * Texto de /terms. Si cambias algo, actualiza LEGAL_UPDATED_AT.
 */
export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: 'Qué es esta app',
    paragraphs: [
      'Es una app para llevar tu presupuesto personal o el de tu hogar: registras ingresos, gastos, deudas y facturas por la web o por WhatsApp. La administra una persona, a la que aquí llamamos «quien administra la app», y el registro es solo por invitación.',
    ],
  },
  {
    title: 'Tu cuenta',
    paragraphs: ['Al crear tu cuenta aceptas lo siguiente:'],
    items: [
      'Usa un correo que sea tuyo y una contraseña de al menos 8 caracteres que no uses en otros sitios.',
      'Cuida tu contraseña: eres responsable de lo que se haga con tu cuenta.',
      'Una cuenta es un presupuesto. Puedes vincular varios números de WhatsApp, por ejemplo los de tu hogar. Quien escriba desde un número vinculado puede consultar tu presupuesto y registrar gastos en él.',
    ],
  },
  {
    title: 'El bot y la inteligencia artificial',
    paragraphs: ['Ten en cuenta cómo funciona el registro automático:'],
    items: [
      'El bot usa inteligencia artificial para leer tus mensajes y facturas y para elegir el rubro de cada gasto. Se puede equivocar: revisa tus gastos de vez en cuando y corrígelos en la app.',
      'La app solo maneja pesos colombianos (COP). No mandes facturas en otra moneda: sus montos se sumarían como si fueran pesos.',
      'Leer una factura por su CUFE depende del portal de la DIAN. Si el portal no responde, la factura puede tardar o no leerse.',
    ],
  },
  {
    title: 'Lo que la app no es',
    paragraphs: [
      'La app te ayuda a organizarte, pero no es asesoría financiera, contable ni tributaria. Las decisiones sobre tu dinero son tuyas.',
      'Se ofrece tal como está: puede tener fallas, cambiar o dejar de estar disponible. Si algo es importante para ti, guarda también tu propia copia.',
    ],
  },
  {
    title: 'Uso aceptable',
    paragraphs: ['Para que la app siga funcionando para todos:'],
    items: [
      'No intentes entrar a cuentas o datos de otras personas.',
      'No uses el bot para mandar mensajes masivos o automáticos: cada mensaje le cuesta a la app.',
      'No compartas tu cuenta con personas que no sean de tu hogar.',
    ],
  },
  {
    title: 'Cerrar tu cuenta',
    paragraphs: [
      `Puedes pedir que se cierre tu cuenta y se borren tus datos escribiendo a ${CONTACT_EMAIL}.`,
      'Quien administra la app puede retirar el acceso si no se cumplen estos términos o si la app deja de funcionar. En ese caso te avisará por correo para que puedas pedir una copia de tus datos.',
    ],
  },
  {
    title: 'Privacidad',
    paragraphs: [
      'Qué datos se guardan, con quién se comparten y cómo pedir el borrado está explicado en la política de privacidad.',
    ],
  },
  {
    title: 'Cambios a estos términos',
    paragraphs: [
      'Si estos términos cambian, se actualiza la fecha de arriba. Seguir usando la app después del cambio significa que lo aceptas.',
    ],
  },
];
