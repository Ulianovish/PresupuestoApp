/**
 * CreditCardsSummary - Organism Level
 *
 * Muestra, por cada tarjeta de crédito con movimiento en el mes, cuánto se
 * gastó con ella y cuánto se le abonó.
 *
 * Son dos cosas distintas y por eso van separadas: "gastado" son las compras
 * cargadas a la tarjeta, y "pagado" son los abonos que le hiciste. No tienen
 * por qué coincidir.
 */

import React from 'react';

import { CreditCard } from 'lucide-react';

import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';
import type { CreditCardSummary as Tarjeta } from '@/lib/services/credit-cards-filter';

interface CreditCardsSummaryProps {
  tarjetas: Tarjeta[];
  nombreMes: string;
  isLoading?: boolean;
  formatCurrency: (amount: number) => string;
}

export default function CreditCardsSummary({
  tarjetas,
  nombreMes,
  isLoading,
  formatCurrency,
}: CreditCardsSummaryProps) {
  return (
    <Card variant="glass" className="p-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-white">
          <div className="flex items-center">
            <CreditCard className="mr-2 h-5 w-5 text-orange-400" />
            Tarjetas de Crédito
          </div>
          <span className="text-sm font-normal text-gray-400">{nombreMes}</span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="py-6 text-center text-gray-400">Cargando…</p>
        ) : tarjetas.length === 0 ? (
          <p className="py-6 text-center text-gray-400">
            Ninguna tarjeta tuvo gastos ni pagos en {nombreMes}.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tarjetas.map(t => (
              <div
                key={t.accountId}
                className="rounded-lg border border-white/10 bg-white/5 p-4"
              >
                <p className="mb-3 font-medium text-white">{t.accountName}</p>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Gastado</span>
                  <span className="font-semibold text-red-300">
                    {formatCurrency(t.gastado)}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-gray-400">Pagado</span>
                  <span className="font-semibold text-emerald-400">
                    {formatCurrency(t.pagado)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
