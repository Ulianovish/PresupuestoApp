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
import { resetPasswordAction } from '@/lib/actions/auth';
import { resolveResetPasswordError } from '@/lib/auth/password-reset-feedback';
import {
  PASSWORD_HINT,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/lib/validations/password-rules';

import AuthLoadingFallback from '../AuthLoadingFallback';

/**
 * ResetPasswordFields - Formulario de contraseña nueva que usa useSearchParams
 */
function ResetPasswordFields() {
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `?error=` trae un código: nunca se pinta texto de la URL.
  useEffect(() => {
    setError(resolveResetPasswordError(searchParams.get('error')));
  }, [searchParams]);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      await resetPasswordAction(formData);
      // La Server Action termina siempre con una redirección
    } catch (error) {
      console.error('Error guardando la contraseña nueva:', error);
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
              Crea una contraseña nueva
            </CardTitle>
            <p className="text-gray-300 text-sm">
              Escríbela dos veces para confirmarla.
            </p>
          </CardHeader>

          <CardContent>
            <form action={handleSubmit} className="space-y-6">
              {/* Campo Contraseña */}
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-white"
                >
                  Contraseña nueva
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  variant="glass"
                  placeholder="••••••••"
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  required
                  disabled={isSubmitting}
                  className="w-full"
                />
                <p className="text-xs text-gray-400">{PASSWORD_HINT}</p>
              </div>

              {/* Campo Confirmar Contraseña */}
              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-white"
                >
                  Confirmar contraseña
                </label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  variant="glass"
                  placeholder="••••••••"
                  maxLength={PASSWORD_MAX_LENGTH}
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

              {/* Botón de Submit */}
              <Button
                type="submit"
                variant="gradient"
                size="lg"
                className="w-full"
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Guardando...' : 'Guardar contraseña'}
              </Button>
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
 * ResetPasswordForm - Formulario con Suspense boundary (useSearchParams lo exige)
 */
export default function ResetPasswordForm() {
  return (
    <Suspense fallback={<AuthLoadingFallback />}>
      <ResetPasswordFields />
    </Suspense>
  );
}
