'use client';

import { Suspense, useEffect, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import Button from '@/components/atoms/Button/Button';
import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';
import Input from '@/components/atoms/Input/Input';
import { registerAction } from '@/lib/actions/auth';

/**
 * RegisterForm - Formulario de registro que usa useSearchParams
 */
function RegisterForm() {
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
      await registerAction(formData);
      // Si llegamos aquí sin error, el Server Action manejó la redirección
    } catch (error) {
      console.error('Error en registro:', error);
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {/* Fondo con efecto glassmorphism */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-emerald-500/10" />

      <div className="relative w-full max-w-md">
        <Card variant="glass" className="p-8">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white mb-2">
              Crear Cuenta
            </CardTitle>
            <p className="text-gray-300 text-sm">
              Únete y comienza a gestionar tu presupuesto
            </p>
          </CardHeader>

          <CardContent>
            <form action={handleSubmit} className="space-y-6">
              {/* Campo Nombre Completo */}
              <div className="space-y-2">
                <label
                  htmlFor="fullName"
                  className="block text-sm font-medium text-white"
                >
                  Nombre Completo
                </label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  variant="glass"
                  placeholder="Tu nombre completo"
                  required
                  disabled={isSubmitting}
                  className="w-full"
                />
              </div>

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
                <p className="text-xs text-gray-400">
                  Mínimo 6 caracteres, incluye mayúscula, minúscula y número
                </p>
              </div>

              {/* Campo Confirmar Contraseña */}
              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-white"
                >
                  Confirmar Contraseña
                </label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
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

              {/* Términos y Condiciones */}
              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="terms"
                  name="terms"
                  required
                  disabled={isSubmitting}
                  className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                />
                <label htmlFor="terms" className="text-sm text-gray-300">
                  Acepto los{' '}
                  <Link
                    href="/terms"
                    className="text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    términos y condiciones
                  </Link>{' '}
                  y la{' '}
                  <Link
                    href="/privacy"
                    className="text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    política de privacidad
                  </Link>
                </label>
              </div>

              {/* Botón de Submit */}
              <Button
                type="submit"
                variant="gradient"
                size="lg"
                className="w-full"
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creando cuenta...' : 'Crear Cuenta'}
              </Button>

              {/* Enlaces adicionales */}
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 text-sm">
                  <span className="text-gray-300">¿Ya tienes cuenta?</span>
                  <Link
                    href="/auth/login"
                    className="text-blue-400 hover:text-blue-300 hover:underline font-medium transition-colors"
                  >
                    Inicia sesión
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

/**
 * RegisterPage - Página de registro de usuario
 * Componente de página (Pages level en Atomic Design) con Suspense boundary
 */
export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-emerald-500/10" />
          <div className="relative">
            <Card variant="glass" className="p-8">
              <CardContent>
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                  <p>Cargando...</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
