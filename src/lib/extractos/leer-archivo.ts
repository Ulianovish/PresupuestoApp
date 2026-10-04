/**
 * Saca el texto de un extracto en Excel, CSV o PDF, dentro del navegador.
 *
 * El archivo no se sube a ningún lado: solo viaja el texto que se le manda al
 * modelo. Un extracto trae números de cuenta y movimientos, así que entre
 * menos salga del equipo, mejor.
 */

import { filasATexto } from './extracto';

/** El worker de pdf.js se sirve desde public/ (lo copia el postinstall). */
const WORKER_PDF = '/pdf.worker.min.mjs';

export function esPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name.trim());
}

async function textoDePdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_PDF;

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() })
    .promise;

  const paginas: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const contenido = await pagina.getTextContent();
    paginas.push(
      contenido.items
        .map(item => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
  }
  return paginas.filter(Boolean).join('\n');
}

async function textoDeHojaDeCalculo(file: File): Promise<string> {
  const XLSX = await import('xlsx');
  const libro = XLSX.read(await file.arrayBuffer(), { type: 'array' });

  return libro.SheetNames.map(nombre => {
    const filas = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[nombre], {
      header: 1,
      blankrows: false,
    });
    return `# ${nombre}\n${filasATexto(filas)}`;
  }).join('\n\n');
}

export async function textoDelArchivo(file: File): Promise<string> {
  const texto = esPdf(file)
    ? await textoDePdf(file)
    : await textoDeHojaDeCalculo(file);

  const limpio = texto.trim();
  if (!limpio) {
    throw new Error(
      esPdf(file)
        ? 'El PDF no tiene texto seleccionable (parece escaneado).'
        : 'El archivo no tiene filas con datos.',
    );
  }
  return limpio;
}
