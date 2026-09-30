import Card, { CardContent } from '@/components/atoms/Card/Card';

/**
 * AuthLoadingFallback - Fallback de Suspense de las páginas de auth
 * (login, registro, recuperar y crear contraseña).
 */
export default function AuthLoadingFallback() {
  return (
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
  );
}
