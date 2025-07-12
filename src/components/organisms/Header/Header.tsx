/**
 * Header - Organism Level
 * 
 * Header principal con navegación para la app de presupuesto.
 * Incluye enlaces a Dashboard, Presupuesto, Gastos y Test, con iconos y glassmorphism.
 * Es fixed y semitransparente al hacer scroll.
 */
"use client";

import Link from "next/link";
import { LayoutDashboard, PieChart, ReceiptText, FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-slate-900/80 backdrop-blur-md shadow-lg border-b border-white/20"
          : "bg-white/10 dark:bg-slate-800/30 backdrop-blur-md border-b border-white/20"
      }`}
    >
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-blue-400 tracking-tight select-none">
            Presupuesto 2025
          </span>
        </div>
        <ul className="flex gap-6 text-md font-medium">
          <li>
            <Link href="/dashboard" className="flex items-center gap-1 text-white hover:text-blue-400 transition-colors">
              <LayoutDashboard size={18} />
              Dashboard
            </Link>
          </li>
          <li>
            <Link href="/presupuesto" className="flex items-center gap-1 text-white hover:text-blue-400 transition-colors">
              <PieChart size={18} />
              Presupuesto
            </Link>
          </li>
          <li>
            <Link href="/gastos" className="flex items-center gap-1 text-white hover:text-blue-400 transition-colors">
              <ReceiptText size={18} />
              Gastos
            </Link>
          </li>
          <li>
            <Link href="/test" className="flex items-center gap-1 text-white hover:text-blue-400 transition-colors">
              <FlaskConical size={18} />
              Test
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
} 