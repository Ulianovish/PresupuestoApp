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
import { forgotPasswordAction } from '@/lib/actions/auth';
import { resolveForgotPasswordFeedback } from '@/lib/auth/password-reset-feedback';

/**
 * ForgotPasswordForm - Pide el correo para enviar el enlace de recuperación
 */
function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // `?error=` y `?message=` traen códigos: nunca se pinta texto de la URL.
  useEffect(() => {
    const feedback = resolveForgotPasswordFeedback({
      error: searchParams.get('error'),
      message: searchParams.get('message'),
    });
    setError(feedback.error);
    setMessage(feedback.message);
  }, [searchParams]);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await forgotPasswordAction(formData);
      // La Server Action termina siempre con una redirección
    } catch (error) {
      console.error('Error pidiendo el enlace de recuperación:', error);
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
              Recupera tu contraseña
            </CardTitle>
            <p className="text-gray-300 text-sm">
              Escribe tu correo y te enviamos un enlace para crear una nueva.
            </p>
          </CardHeader>

          <CardContent>
            <form action={handleSubmit} className="space-y-6">
              {/* Campo Correo */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-white"
                >
                  Correo
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  variant="glass"
                  placeholder="tu@correo.com"
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
                {isSubmitting ? 'Enviando...' : 'Enviar enlace'}
              </Button>

              {/* Enlaces adicionales */}
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 text-sm">
                  <span className="text-gray-300">¿Ya la recordaste?</span>
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
 * ForgotPasswordPage - Página para pedir el enlace de recuperación
 * Componente de página (Pages level en Atomic Design) con Suspense boundary
 */
export default function ForgotPasswordPage() {
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
      <ForgotPasswordForm />
    </Suspense>
  );
}
