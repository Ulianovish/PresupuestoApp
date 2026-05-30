import { describe, it, expect } from 'vitest';

import { parseSSEEventLine } from './sse';

describe('parseSSEEventLine', () => {
  it('parsea una línea data: con JSON', () => {
    const line = 'data: {"step":"fetching","progress":10}';
    expect(parseSSEEventLine(line)).toEqual({ step: 'fetching', progress: 10 });
  });

  it('devuelve null para líneas que no son data:', () => {
    expect(parseSSEEventLine('')).toBeNull();
    expect(parseSSEEventLine(': keep-alive')).toBeNull();
    expect(parseSSEEventLine('event: message')).toBeNull();
  });

  it('devuelve null para JSON malformado', () => {
    expect(parseSSEEventLine('data: {no-json')).toBeNull();
  });

  it('extrae el result del evento complete', () => {
    const line =
      'data: {"step":"complete","result":{"success":true,"items":[]}}';
    const ev = parseSSEEventLine(line);
    expect(ev?.step).toBe('complete');
    expect(ev?.result?.success).toBe(true);
  });
});
