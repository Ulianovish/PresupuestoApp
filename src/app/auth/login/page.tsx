'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import Button from '@/components/atoms/Button/Button';
import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';
import Input from '@/components/atoms/Input/Input';
import { loginAction } from '@/lib/actions/auth';

/**
 * LoginPage - Página de inicio de sesión
 * Componente de página (Pages level en Atomic Design)
 */
export default function LoginPage() {
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Obtener errores y mensajes de los query parameters
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');

    setError(errorParam);
    setMessage(messageParam);
  }, [searchParams]);

  // Función para manejar el envío del formulario
  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await loginAction(formData);
      // Si llegamos aquí sin error, el Server Action manejó la redirección
    } catch (error) {
      console.error('Error en login:', error);
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {/* Fondo con efecto glassmorphism */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-emerald-500/10" />

      <div className="relative w-full max-w-md">
        <Card variant="glass" className="p-8">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white mb-2">
              Iniciar Sesión
            </CardTitle>
            <p className="text-gray-300 text-sm">
              Accede a tu cuenta de presupuesto
            </p>
          </CardHeader>

          <CardContent>
            <form action={handleSubmit} className="space-y-6">
              {/* Campo Email */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-white"
                >
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  variant="glass"
                  placeholder="tu@email.com"
                  required
                  disabled={isSubmitting}
                  className="w-full"
                />
              </div>

              {/* Campo Contraseña */}
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-white"
                >
                  Contraseña
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  variant="glass"
                  placeholder="••••••••"
                  required
                  disabled={isSubmitting}
                  className="w-full"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Success Message */}
              {message && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-green-400 text-sm">{message}</p>
                </div>
              )}

              {/* Botón de Submit */}
              <Button
                type="submit"
                variant="gradient"
                size="lg"
                className="w-full"
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>

              {/* Enlaces adicionales */}
              <div className="space-y-3 text-center">
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>

                <div className="flex items-center justify-center space-x-1 text-sm">
                  <span className="text-gray-300">¿No tienes cuenta?</span>
                  <Link
                    href="/auth/register"
                    className="text-blue-400 hover:text-blue-300 hover:underline font-medium transition-colors"
                  >
                    Regístrate
                  </Link>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
