/**
 * HomePage - Page Level
 * 
 * Landing page that introduces the budget application
 * and provides navigation to main features.
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/atoms/Button/Button";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/atoms/Card/Card";
import { Wallet, TrendingUp, Target, BarChart3 } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  // Auto-redirect to budget page after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/presupuesto');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

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
            construida con Next.js, shadcn/ui y Atomic Design.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              variant="gradient" 
              size="lg"
              onClick={() => router.push('/presupuesto')}
            >
              <Wallet className="w-5 h-5 mr-2" />
              Ir al Presupuesto
            </Button>
            <Button variant="glass" size="lg">
              <BarChart3 className="w-5 h-5 mr-2" />
              Ver Reportes
            </Button>
          </div>
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
                y seguimiento en tiempo real.
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
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-8 text-white">Tecnologías Utilizadas</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
              <div className="text-2xl font-bold text-blue-400">Next.js</div>
              <div className="text-sm text-gray-400">Framework React</div>
            </div>
            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
              <div className="text-2xl font-bold text-purple-400">shadcn/ui</div>
              <div className="text-sm text-gray-400">Componentes UI</div>
            </div>
            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
              <div className="text-2xl font-bold text-green-400">Atomic Design</div>
              <div className="text-sm text-gray-400">Metodología</div>
            </div>
            <div className="p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
              <div className="text-2xl font-bold text-orange-400">TypeScript</div>
              <div className="text-sm text-gray-400">Tipado Estático</div>
            </div>
          </div>
        </div>

        {/* Auto-redirect notice */}
        <div className="text-center mt-16 p-4 bg-blue-500/10 backdrop-blur-sm rounded-lg border border-blue-500/20">
          <p className="text-blue-300">
            Redirigiendo automáticamente a la página de presupuesto en 3 segundos...
          </p>
        </div>
      </div>
    </div>
  );
}
