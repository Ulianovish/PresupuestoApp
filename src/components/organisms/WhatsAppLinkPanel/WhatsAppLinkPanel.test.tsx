import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// La server action importa el cliente de Supabase de servidor; aquí no se usa.
vi.mock('@/lib/actions/whatsapp', () => ({
  generateWhatsAppLinkCodeAction: vi.fn(),
}));

import { WhatsAppLinkInstructions } from './WhatsAppLinkPanel';

const URL_WA = 'https://wa.me/573000000000?text=VINCULAR%20123456';

describe('WhatsAppLinkInstructions', () => {
  it('con enlace: botón "Abrir WhatsApp" que abre wa.me en otra pestaña', () => {
    const html = renderToStaticMarkup(
      <WhatsAppLinkInstructions code="123456" linkUrl={URL_WA} />,
    );
    expect(html).toContain('Abrir WhatsApp');
    expect(html).toContain(`href="${URL_WA}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    // El mensaje sigue visible por si el enlace no abre.
    expect(html).toContain('>VINCULAR 123456</p>');
  });

  it('sin enlace (sin la variable del bot): solo el código, como antes', () => {
    const html = renderToStaticMarkup(
      <WhatsAppLinkInstructions code="123456" linkUrl={null} />,
    );
    expect(html).not.toContain('Abrir WhatsApp');
    expect(html).not.toContain('<a');
    expect(html).toContain('Abre WhatsApp y envía al número del bot:');
    expect(html).toContain('>VINCULAR 123456</p>');
  });
});
