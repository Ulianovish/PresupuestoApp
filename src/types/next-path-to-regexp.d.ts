// Next.js no publica tipos para su copia de path-to-regexp (v6). Solo se usa
// en tests, para compilar config.matcher igual que Next.js.
declare module 'next/dist/compiled/path-to-regexp' {
  export function pathToRegexp(path: string): RegExp;
}
