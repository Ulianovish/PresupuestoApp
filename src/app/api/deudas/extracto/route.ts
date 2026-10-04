import { NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { leerExtractoConIA } from '@/lib/extractos/extracto-ia';
import { createClient } from '@/lib/supabase/server';

const ExtractoSchema = z.object({
  texto: z.string().min(1),
  descripcion: z.string().default(''),
  acreedor: z.string().default(''),
});

/**
 * POST /api/deudas/extracto
 *
 * Recibe el texto ya extraído del Excel o del PDF (eso se hace en el
 * navegador, así el archivo nunca sale del equipo) y devuelve las filas que
 * el modelo propone. No escribe nada: la persona confirma antes de guardar.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 },
      );
    }

    const parsed = ExtractoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'El extracto llegó vacío' },
        { status: 400 },
      );
    }

    const { texto, descripcion, acreedor } = parsed.data;
    const { filas, error } = await leerExtractoConIA(texto, {
      descripcion,
      acreedor,
    });

    if (error) return NextResponse.json({ error }, { status: 502 });
    return NextResponse.json({ filas });
  } catch (error) {
    console.error('Error en POST /api/deudas/extracto:', error);
    return NextResponse.json(
      { error: 'Error leyendo el extracto' },
      { status: 500 },
    );
  }
}
