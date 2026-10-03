import { Geist, Geist_Mono } from 'next/font/google';

import ToasterProvider from '@/components/atoms/ToasterProvider/ToasterProvider';
import AppShell from '@/components/organisms/AppShell/AppShell';
import { MonthProvider } from '@/contexts/MonthContext';
import { SCRIPT_TEMA_INICIAL, ThemeProvider } from '@/contexts/ThemeContext';

import type { Metadata } from 'next';

import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Presupuesto 2025 - Gestión de Presupuesto',
  description:
    'Aplicación moderna de gestión de presupuesto construida con Next.js, shadcn/ui y Atomic Design',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <head>
        {/* Aplica la preferencia guardada antes de pintar: sin esto, quien
            tenga el tema claro ve un destello oscuro en cada carga. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-white min-h-screen pt-16 lg:pt-0`}
      >
        <ThemeProvider>
          <MonthProvider>
            <AppShell>{children}</AppShell>
            <ToasterProvider />
          </MonthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
