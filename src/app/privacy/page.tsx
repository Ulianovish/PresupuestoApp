import Link from 'next/link';

import { CONTACT_EMAIL, LEGAL_UPDATED_AT } from '@/lib/constants/legal';

import { PRIVACY_SECTIONS } from './content';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de privacidad',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-gray-200">
      <h1 className="text-3xl font-bold text-white">Política de privacidad</h1>
      <p className="mt-2 text-sm text-gray-400">
        Última actualización: {LEGAL_UPDATED_AT}
      </p>

      {PRIVACY_SECTIONS.map(section => (
        <section key={section.title} className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-white">{section.title}</h2>
          {section.paragraphs.map(paragraph => (
            <p key={paragraph} className="leading-relaxed">
              {paragraph}
            </p>
          ))}
          {section.items && (
            <ul className="list-disc space-y-2 pl-6 leading-relaxed">
              {section.items.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <p className="mt-10">
        ¿Tienes preguntas? Escribe a{' '}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-blue-400 hover:text-blue-300 hover:underline"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <nav className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link
          href="/terms"
          className="text-blue-400 hover:text-blue-300 hover:underline"
        >
          Términos y condiciones
        </Link>
        <Link
          href="/auth/register"
          className="text-gray-400 hover:text-white transition-colors"
        >
          ← Volver al registro
        </Link>
      </nav>
    </main>
  );
}
