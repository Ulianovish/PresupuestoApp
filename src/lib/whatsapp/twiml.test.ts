import { describe, expect, it } from 'vitest';

import { twimlEmpty, twimlMessage } from './twiml';

describe('twimlMessage', () => {
  it('envuelve el texto en <Response><Message>', () => {
    expect(twimlMessage('Hola')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Hola</Message></Response>',
    );
  });

  it('escapa caracteres XML peligrosos', () => {
    expect(twimlMessage('a & b <c> "d" \'e\'')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;</Message></Response>',
    );
  });
});

describe('twimlEmpty', () => {
  it('devuelve una respuesta vacía', () => {
    expect(twimlEmpty()).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    );
  });
});
