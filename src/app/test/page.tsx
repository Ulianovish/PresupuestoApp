'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Button from "@/components/atoms/Button/Button";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/atoms/Card/Card";
import CurrencyInput from "@/components/atoms/CurrencyInput/CurrencyInput";

/**
 * TestPage - Página completa de prueba para componentes y Supabase
 */
export default function TestPage() {
  // Estados para componentes originales
  const [amount, setAmount] = useState(0);
  
  // Estados para prueba de Supabase
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'connected' | 'error'>('testing');
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    // Función para probar la conexión con Supabase
    const testConnection = async () => {
      try {
        // Intentar obtener las categorías para verificar la conexión
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .limit(5);

        if (error) {
          console.error('Error de Supabase:', error);
          setError(error.message);
          setConnectionStatus('error');
          return;
        }

        console.log('✅ Conexión exitosa con Supabase');
        console.log('Categorías obtenidas:', data);
        setCategories(data || []);
        setConnectionStatus('connected');
      } catch (err) {
        console.error('Error general:', err);
        setError('Error de conexión general');
        setConnectionStatus('error');
      }
    };

    testConnection();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-center text-blue-400">
          Test de Componentes - Dark Theme
        </h1>

        {/* NUEVA SECCIÓN: Prueba de Supabase */}
        <Card variant="glass" className="p-6">
          <CardHeader>
            <CardTitle className="text-white">🧪 Prueba de Configuración de Supabase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Estado de Conexión */}
            <div>
              <h3 className="text-lg font-semibold mb-2 text-white">Estado de Conexión:</h3>
              <div className={`p-3 rounded-lg ${
                connectionStatus === 'testing' ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400' :
                connectionStatus === 'connected' ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
                'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
                {connectionStatus === 'testing' && '🔄 Probando conexión...'}
                {connectionStatus === 'connected' && '✅ ¡Conectado exitosamente!'}
                {connectionStatus === 'error' && `❌ Error: ${error}`}
              </div>
            </div>

            {/* Variables de Entorno */}
            <div>
              <h3 className="text-lg font-semibold mb-2 text-white">Variables de Entorno:</h3>
              <div className="bg-slate-800 p-3 rounded-lg font-mono text-sm border border-slate-700">
                <div className="text-white">
                  <strong>SUPABASE_URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Configurada' : '❌ No configurada'}
                </div>
                <div className="text-white">
                  <strong>SUPABASE_ANON_KEY:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Configurada' : '❌ No configurada'}
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || 'No definida'}
                </div>
              </div>
            </div>

            {/* Datos de Prueba */}
            {connectionStatus === 'connected' && (
              <div>
                <h3 className="text-lg font-semibold mb-2 text-white">Categorías Encontradas:</h3>
                <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                  {categories.length > 0 ? (
                    <ul className="space-y-2">
                      {categories.map((category) => (
                        <li key={category.id} className="flex justify-between text-white">
                          <span className="font-medium text-blue-400">{category.name}</span>
                          <span className="text-gray-300">{category.description}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400">No hay categorías aún</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Button */}
        <Card variant="glass" className="p-6">
          <CardHeader>
            <CardTitle className="text-white">Test Button</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <Button variant="default" className="bg-slate-700 text-white hover:bg-slate-600">Default</Button>
              <Button variant="gradient">Gradient</Button>
              <Button variant="glass">Glass</Button>
              <Button variant="outline" className="text-white border-slate-600 hover:bg-slate-700">Outline</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="secondary" className="bg-slate-700 text-white hover:bg-slate-600">Secondary</Button>
            </div>
          </CardContent>
        </Card>

        {/* Test CurrencyInput */}
        <Card variant="glass" className="p-6">
          <CardHeader>
            <CardTitle className="text-white">Test CurrencyInput</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                Amount: {new Intl.NumberFormat('es-CO', {
                  style: 'currency',
                  currency: 'COP',
                  minimumFractionDigits: 0,
                }).format(amount)}
              </label>
              <CurrencyInput 
                value={amount}
                onChange={setAmount}
                placeholder="Enter amount"
                className="bg-slate-800 border-slate-600 text-white placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                With Error State
              </label>
              <CurrencyInput 
                value={0}
                onChange={() => {}}
                placeholder="Error input"
                error={true}
                className="bg-slate-800 border-red-500 text-white placeholder-gray-400"
              />
            </div>
          </CardContent>
        </Card>

        {/* Test Card Variants */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="default" className="p-4 bg-slate-800 border-slate-700">
            <CardTitle className="text-white">Default Card</CardTitle>
            <p className="text-sm text-gray-300">This is a default card with dark background</p>
          </Card>
          
          <Card variant="glass" className="p-4">
            <CardTitle className="text-white">Glass Card</CardTitle>
            <p className="text-sm text-gray-300">This is a glass card with transparency</p>
          </Card>
          
          <Card variant="gradient-border" className="p-4">
            <CardTitle className="text-white">Gradient Border</CardTitle>
            <p className="text-sm text-gray-300">This is a gradient border card</p>
          </Card>
        </div>

        {/* Test Form Elements */}
        <Card variant="glass" className="p-6">
          <CardHeader>
            <CardTitle className="text-white">Test Form Elements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Regular Input
                </label>
                <input 
                  type="text" 
                  placeholder="Type something..."
                  className="w-full px-3 py-2 border border-slate-600 rounded-md text-sm bg-slate-800 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Select Dropdown
                </label>
                <select className="w-full px-3 py-2 border border-slate-600 rounded-md text-sm bg-slate-800 text-white">
                  <option>Option 1</option>
                  <option>Option 2</option>
                  <option>Option 3</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Color Palette */}
        <Card variant="glass" className="p-6">
          <CardHeader>
            <CardTitle className="text-white">Test Color Palette</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="text-blue-400 font-semibold">Blue</div>
                <div className="text-blue-300 text-sm">Primary color</div>
              </div>
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="text-green-400 font-semibold">Green</div>
                <div className="text-green-300 text-sm">Success color</div>
              </div>
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="text-red-400 font-semibold">Red</div>
                <div className="text-red-300 text-sm">Error color</div>
              </div>
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <div className="text-purple-400 font-semibold">Purple</div>
                <div className="text-purple-300 text-sm">Accent color</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Loading States */}
        <Card variant="glass" className="p-6">
          <CardHeader>
            <CardTitle className="text-white">Test Loading States</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <Button variant="gradient" loading>Loading Gradient</Button>
              <Button variant="glass" loading>Loading Glass</Button>
              <Button variant="outline" loading className="text-white border-slate-600">Loading Outline</Button>
            </div>
          </CardContent>
        </Card>

        {/* Instrucciones para Supabase */}
        <Card variant="glass" className="p-6">
          <CardHeader>
            <CardTitle className="text-white">📋 Instrucciones de Supabase</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-400 mb-2">Qué hacer según el resultado:</h3>
              <ul className="text-blue-300 space-y-1 text-sm">
                <li>✅ <strong>Si está conectado:</strong> ¡Perfecto! Supabase está configurado correctamente</li>
                <li>❌ <strong>Si hay error:</strong> Verifica tus variables de entorno en .env.local</li>
                <li>🔄 <strong>Si sigue cargando:</strong> Revisa la consola del navegador para más detalles</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 