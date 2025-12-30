import { Geist, Geist_Mono } from 'next/font/google';

import Header from '@/components/organisms/Header/Header';
import { MonthProvider } from '@/contexts/MonthContext';

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-slate-900 text-white min-h-screen pt-20`}
      >
        <MonthProvider>
          <Header />
          {children}
        </MonthProvider>
      </body>
    </html>
  );
}
