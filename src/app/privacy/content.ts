import { CONTACT_EMAIL, type LegalSection } from '@/lib/constants/legal';

/**
 * Texto de /privacy. Debe describir lo que la app hace de verdad:
 * si agregas una tabla con datos personales o un proveedor nuevo, actualiza
 * esta lista y LEGAL_UPDATED_AT.
 */
export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: 'Quién administra la app',
    paragraphs: [
      'Esta app de presupuesto la administra una persona para un grupo pequeño de usuarios invitados. En este texto la llamamos «quien administra la app». Solo te puedes registrar si tu correo recibió una invitación.',
      `Para cualquier asunto sobre tus datos, escribe a ${CONTACT_EMAIL}.`,
    ],
  },
  {
    title: 'Qué datos guarda la app',
    paragraphs: ['Solo lo que hace falta para que funcione tu presupuesto:'],
    items: [
      'Tu cuenta: correo, nombre y contraseña. La contraseña se guarda cifrada; nadie puede leerla, ni siquiera quien administra la app.',
      'Tu presupuesto: categorías, rubros, montos, ingresos, deudas, pagos y el nombre de tus cuentas o tarjetas.',
      'Tus gastos: monto, fecha, descripción, rubro, la cuenta con la que pagaste y, si llegó por WhatsApp, desde qué número se registró.',
      'Facturas electrónicas: el código CUFE, el nombre y el NIT del comercio, la fecha, los totales y los productos de la factura.',
      'WhatsApp: el número de cada teléfono que vincules y, si la cargas, tu cédula o NIT para buscar facturas en la DIAN.',
      'Conversación con el bot: los últimos 6 mensajes, para que el bot entienda tus respuestas. Deja de tenerlos en cuenta a los 30 minutos y se reemplazan con la siguiente conversación.',
    ],
  },
  {
    title: 'Lo que la app no guarda',
    paragraphs: ['Hay cosas que la app nunca pide o no conserva:'],
    items: [
      'Las fotos de facturas que mandas por WhatsApp: se leen para sacar los datos y la app no las guarda. Twilio, que entrega los mensajes, conserva una copia según sus propias reglas.',
      'Números de tarjeta, claves bancarias ni acceso a tus bancos.',
      'Cookies de publicidad o de analítica. Solo se usan las cookies necesarias para mantener tu sesión abierta.',
    ],
  },
  {
    title: 'Para qué se usan tus datos',
    paragraphs: [
      'Para mostrarte tu presupuesto, registrar los gastos que mandas por la web o por WhatsApp, clasificarlos en tus rubros, leer tus facturas y avisarte por WhatsApp cuando un rubro se acerca a su tope o lo pasa, si tienes las alertas activas.',
      'Tus datos no se venden ni se usan para publicidad.',
    ],
  },
  {
    title: 'Con quién se comparten',
    paragraphs: [
      'La app usa estos proveedores para funcionar. Cada uno recibe solo lo que necesita para su parte:',
    ],
    items: [
      'Supabase: guarda la base de datos y maneja el inicio de sesión.',
      'Vercel: aloja la app y procesa cada visita y cada mensaje que llega.',
      'Twilio y Meta (WhatsApp): entregan los mensajes entre tú y el bot.',
      'Proveedores de inteligencia artificial, a través de Vercel AI Gateway o directamente MiniMax: reciben el texto de tus mensajes al bot, las fotos de facturas y las descripciones de gastos, para entenderlos y clasificarlos.',
      'Resend: envía los correos de confirmación de cuenta y de recuperación de contraseña.',
      'DIAN: para leer una factura electrónica, un servicio propio de la app consulta el portal de la DIAN con el CUFE y, si hace falta, con tu cédula o NIT.',
    ],
  },
  {
    title: 'Cuánto tiempo se guardan',
    paragraphs: [
      'Mientras tengas tu cuenta. Si pides el borrado, se eliminan tu cuenta y todo lo que depende de ella. Las copias de respaldo de los proveedores pueden conservar esos datos por un tiempo limitado, hasta que se reemplazan.',
    ],
  },
  {
    title: 'Tus derechos y cómo pedir el borrado',
    paragraphs: [
      `En cualquier momento puedes pedir una copia de tus datos, que se corrijan o que se borren, o cerrar tu cuenta. Escribe a ${CONTACT_EMAIL} desde el correo con el que te registraste y di qué necesitas.`,
    ],
  },
  {
    title: 'Cambios a esta política',
    paragraphs: ['Si esta política cambia, se actualiza la fecha de arriba.'],
  },
];
