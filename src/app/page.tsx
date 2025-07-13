/**
 * HomePage - Page Level
 * 
 * Landing page that introduces the budget application
 * and provides navigation to main features and authentication.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/atoms/Button/Button";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/atoms/Card/Card";
import { supabase } from "@/lib/supabase/client";
import { Wallet, TrendingUp, Target, BarChart3, User, LogIn, UserPlus, TestTube } from "lucide-react";
import type { User } from '@supabase/supabase-js';

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Verificar estado de autenticación
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Error verificando autenticación:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-6">
            Presupuesto 2025
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Gestiona tu presupuesto de manera inteligente con nuestra aplicación 
            construida con Next.js, Supabase, shadcn/ui y Atomic Design.
          </p>
          
          {/* Navegación basada en autenticación */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {loading ? (
              <Button variant="glass" size="lg" disabled>
                Cargando...
              </Button>
            ) : user ? (
              // Usuario autenticado
              <>
                <Button 
                  variant="gradient" 
                  size="lg"
                  onClick={() => router.push('/dashboard')}
                >
                  <Wallet className="w-5 h-5 mr-2" />
                  Ir al Dashboard
                </Button>
                <Button 
                  variant="glass" 
                  size="lg"
                  onClick={() => router.push('/presupuesto')}
                >
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Ver Presupuesto
                </Button>
              </>
            ) : (
              // Usuario no autenticado
              <>
                <Button 
                  variant="gradient" 
                  size="lg"
                  onClick={() => router.push('/auth/login')}
                >
                  <LogIn className="w-5 h-5 mr-2" />
                  Iniciar Sesión
                </Button>
                <Button 
                  variant="glass" 
                  size="lg"
                  onClick={() => router.push('/auth/register')}
                >
                  <UserPlus className="w-5 h-5 mr-2" />
                  Crear Cuenta
                </Button>
              </>
            )}
          </div>

          {/* Estado del usuario */}
          {!loading && (
            <div className="mt-6 p-3 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 max-w-md mx-auto">
              {user ? (
                <p className="text-green-400 text-sm">
                  ✅ Conectado como: {user.email}
                </p>
              ) : (
                <p className="text-gray-400 text-sm">
                  👤 No has iniciado sesión
                </p>
              )}
            </div>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card variant="glass" hover className="p-6 text-center">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-6 h-6 text-blue-400" />
            </div>
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-xl text-white">Gestión de Presupuesto</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-gray-300">
                Crea y gestiona tu presupuesto mensual con categorías personalizables 
                y seguimiento en tiempo real con Supabase.
              </p>
            </CardContent>
          </Card>

          <Card variant="glass" hover className="p-6 text-center">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-xl text-white">Análisis Inteligente</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-gray-300">
                Visualiza tus gastos con gráficos interactivos y recibe 
                alertas cuando te acerques a tu límite de presupuesto.
              </p>
            </CardContent>
          </Card>

          <Card variant="glass" hover className="p-6 text-center">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Target className="w-6 h-6 text-purple-400" />
            </div>
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-xl text-white">Metas Financieras</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-gray-300">
                Establece metas de ahorro y recibe recomendaciones 
                personalizadas para alcanzar tus objetivos financieros.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Technology Stack */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-8 text-white">Tecnologías Utilizadas</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
              <div className="text-2xl font-bold text-blue-400">Next.js</div>
              <div className="text-sm text-gray-400">Framework React</div>
            </div>
            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
              <div className="text-2xl font-bold text-green-400">Supabase</div>
              <div className="text-sm text-gray-400">Backend & DB</div>
            </div>
            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
              <div className="text-2xl font-bold text-purple-400">shadcn/ui</div>
              <div className="text-sm text-gray-400">Componentes UI</div>
            </div>
            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
              <div className="text-2xl font-bold text-emerald-400">Atomic Design</div>
              <div className="text-sm text-gray-400">Metodología</div>
            </div>
            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
              <div className="text-2xl font-bold text-orange-400">TypeScript</div>
              <div className="text-sm text-gray-400">Tipado Estático</div>
            </div>
          </div>
        </div>

        {/* Navegación rápida */}
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-6 text-white">Enlaces Rápidos</h2>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/test">
              <Button variant="outline" size="sm" className="text-white border-slate-600 hover:bg-slate-700">
                <TestTube className="w-4 h-4 mr-2" />
                Página de Prueba
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="text-white border-slate-600 hover:bg-slate-700">
                <BarChart3 className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <Link href="/presupuesto">
              <Button variant="outline" size="sm" className="text-white border-slate-600 hover:bg-slate-700">
                <Wallet className="w-4 h-4 mr-2" />
                Presupuesto
              </Button>
            </Link>
            <Link href="/gastos">
              <Button variant="outline" size="sm" className="text-white border-slate-600 hover:bg-slate-700">
                <TrendingUp className="w-4 h-4 mr-2" />
                Gastos
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
