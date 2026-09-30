/**
 * OnboardingWizard - Organism Level
 *
 * Bienvenida de 3 pasos saltables (contratos §2.7): ingreso mensual,
 * presupuesto del mes con sugerencia 50/30/20, y primer gasto (aquí o por
 * WhatsApp). Terminar o saltar el último paso marca la bienvenida como hecha
 * y lleva al dashboard.
 */
'use client';

import { useMemo, useState } from 'react';

import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import Card from '@/components/atoms/Card/Card';
import CurrencyInput from '@/components/atoms/CurrencyInput/CurrencyInput';
import Input from '@/components/atoms/Input/Input';
import { WhatsAppLinkInstructions } from '@/components/organisms/WhatsAppLinkPanel/WhatsAppLinkPanel';
import {
  completeOnboardingAction,
  saveOnboardingBudgetAction,
  saveOnboardingIncomeAction,
} from '@/lib/actions/onboarding';
import { generateWhatsAppLinkCodeAction } from '@/lib/actions/whatsapp';
import { DEFAULT_ACCOUNT_NAME } from '@/lib/constants/expense-categories';
import { suggest503020 } from '@/lib/onboarding/budget-503020';
import type { WizardItem } from '@/lib/onboarding/wizard-data';
import { cn } from '@/lib/utils';
import { formatCOP, todayBogota } from '@/lib/whatsapp/format';
import { buildWhatsAppLinkUrl } from '@/lib/whatsapp/link-url';

type Paso = 1 | 2 | 3;

const PASOS: Array<{ n: Paso; titulo: string }> = [
  { n: 1, titulo: 'Tu ingreso' },
  { n: 2, titulo: 'Tu presupuesto' },
  { n: 3, titulo: 'Tu primer gasto' },
];

/** Cuenta con la que se guarda el primer gasto (contratos §2.6, S07). */
const CUENTA_GASTO = DEFAULT_ACCOUNT_NAME;

const SELECT_CLASES =
  'w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500';

export interface OnboardingWizardProps {
  /** Rubros del mes del usuario (kit inicial o los que ya tenga). */
  items: WizardItem[];
  /** Categorías activas del usuario, para el gasto del paso 3. */
  categoryNames: string[];
  /** NEXT_PUBLIC_WHATSAPP_BOT_NUMBER; sin él se muestra el código sin enlace. */
  botNumber?: string;
}

export default function OnboardingWizard({
  items,
  categoryNames,
  botNumber,
}: OnboardingWizardProps) {
  const [paso, setPaso] = useState<Paso>(1);
  const [terminando, setTerminando] = useState(false);

  // Paso 1
  const [ingreso, setIngreso] = useState(0);
  const [fuente, setFuente] = useState('Salario');
  const [guardandoIngreso, setGuardandoIngreso] = useState(false);

  // Paso 2
  const [montos, setMontos] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map(i => [i.id, i.budgetedAmount])),
  );
  const [ahorroSinAsignar, setAhorroSinAsignar] = useState<number | null>(null);
  const [guardandoPresupuesto, setGuardandoPresupuesto] = useState(false);

  // Paso 3
  const [gastoMonto, setGastoMonto] = useState(0);
  const [gastoDescripcion, setGastoDescripcion] = useState('');
  const [gastoCategoria, setGastoCategoria] = useState(() =>
    categoryNames.includes('OTROS') ? 'OTROS' : (categoryNames[0] ?? ''),
  );
  const [guardandoGasto, setGuardandoGasto] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [generandoCodigo, setGenerandoCodigo] = useState(false);

  const itemsPorCategoria = useMemo(() => {
    const grupos = new Map<string, WizardItem[]>();
    for (const item of items) {
      const lista = grupos.get(item.categoryName) ?? [];
      lista.push(item);
      grupos.set(item.categoryName, lista);
    }
    return Array.from(grupos.entries());
  }, [items]);

  const totalAsignado = Object.values(montos).reduce((s, m) => s + m, 0);
  const enlaceWhatsApp = codigo
    ? buildWhatsAppLinkUrl(botNumber, codigo)
    : null;
  const gastoListo =
    gastoMonto > 0 && gastoDescripcion.trim() !== '' && gastoCategoria !== '';

  const terminar = async () => {
    setTerminando(true);
    try {
      // Redirige a /dashboard desde el servidor.
      await completeOnboardingAction();
    } catch {
      toast.error('No pudimos terminar la bienvenida. Intenta de nuevo.');
      setTerminando(false);
    }
  };

  const guardarIngreso = async () => {
    setGuardandoIngreso(true);
    try {
      const r = await saveOnboardingIncomeAction({ monto: ingreso, fuente });
      if (!r.ok) {
        toast.error(r.error ?? 'No pudimos guardar tu ingreso.');
        return;
      }
      setPaso(2);
    } catch {
      toast.error('No pudimos guardar tu ingreso. Intenta de nuevo.');
    } finally {
      setGuardandoIngreso(false);
    }
  };

  const sugerir = () => {
    const sugerencia = suggest503020(
      ingreso,
      items.map(i => ({ id: i.id, classificationName: i.classificationName })),
    );
    setMontos(prev => ({ ...prev, ...sugerencia.amounts }));
    setAhorroSinAsignar(sugerencia.ahorroSinAsignar);
  };

  const guardarPresupuesto = async () => {
    setGuardandoPresupuesto(true);
    try {
      const r = await saveOnboardingBudgetAction(montos);
      if (!r.ok) {
        toast.error(r.error ?? 'No pudimos guardar tu presupuesto.');
        return;
      }
      setPaso(3);
    } catch {
      toast.error('No pudimos guardar tu presupuesto. Intenta de nuevo.');
    } finally {
      setGuardandoPresupuesto(false);
    }
  };

  const guardarGasto = async () => {
    if (!gastoListo) {
      toast.error('Completa el monto, la descripción y la categoría.');
      return;
    }
    setGuardandoGasto(true);
    try {
      // Import dinámico: expenses.ts crea un cliente de navegador al cargar el
      // módulo y no debe evaluarse al renderizar en el servidor.
      const { createExpenseTransaction } = await import(
        '@/lib/services/expenses'
      );
      await createExpenseTransaction({
        description: gastoDescripcion.trim(),
        amount: gastoMonto,
        transaction_date: todayBogota(),
        category_name: gastoCategoria,
        account_name: CUENTA_GASTO,
      });
      toast.success('¡Listo! Guardamos tu primer gasto.');
      await terminar();
    } catch {
      toast.error('No pudimos guardar el gasto. Intenta de nuevo.');
    } finally {
      setGuardandoGasto(false);
    }
  };

  const generarCodigo = async () => {
    setGenerandoCodigo(true);
    try {
      const r = await generateWhatsAppLinkCodeAction();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setCodigo(r.code);
    } catch {
      toast.error('No pudimos generar el código. Intenta de nuevo.');
    } finally {
      setGenerandoCodigo(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6 text-center">
        <p className="text-sm font-medium text-emerald-400">Bienvenida</p>
        <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
          Armemos tu presupuesto en 3 pasos
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Puedes saltar cualquier paso y completarlo después.
        </p>
      </header>

      <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Progreso">
        {PASOS.map(p => (
          <li
            key={p.n}
            aria-current={p.n === paso ? 'step' : undefined}
            className="space-y-2"
          >
            <div
              className={cn(
                'h-1.5 rounded-full transition-colors duration-200',
                p.n <= paso
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600'
                  : 'bg-slate-700',
              )}
            />
            <p
              className={cn(
                'text-xs',
                p.n === paso ? 'font-medium text-white' : 'text-slate-500',
              )}
            >
              {p.n}. {p.titulo}
            </p>
          </li>
        ))}
      </ol>

      <Card variant="glass" className="p-6 sm:p-8">
        {paso === 1 && (
          <section aria-labelledby="paso-1-titulo" className="space-y-6">
            <div>
              <h2
                id="paso-1-titulo"
                className="text-lg font-semibold text-white"
              >
                ¿Cuánto te entra al mes?
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Con tu ingreso te sugerimos cómo repartir el presupuesto. Lo
                guardamos en Ingresos con la fecha de hoy.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-white">
                Ingreso mensual
              </span>
              <CurrencyInput
                value={ingreso}
                onChange={setIngreso}
                placeholder="$0"
                disabled={guardandoIngreso}
              />
            </label>

            <div className="space-y-2">
              <label
                htmlFor="onboarding-fuente"
                className="text-sm font-medium text-white"
              >
                ¿De dónde viene?
              </label>
              <Input
                id="onboarding-fuente"
                variant="glass"
                value={fuente}
                onChange={e => setFuente(e.target.value)}
                placeholder="Ej.: Salario, negocio, freelance"
                maxLength={255}
                disabled={guardandoIngreso}
              />
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button
                variant="ghost"
                onClick={() => setPaso(2)}
                disabled={guardandoIngreso}
              >
                Saltar
              </Button>
              <Button
                variant="gradient"
                onClick={guardarIngreso}
                loading={guardandoIngreso}
                disabled={guardandoIngreso || ingreso <= 0 || !fuente.trim()}
              >
                Guardar y seguir
              </Button>
            </div>
          </section>
        )}

        {paso === 2 && (
          <section aria-labelledby="paso-2-titulo" className="space-y-6">
            <div>
              <h2
                id="paso-2-titulo"
                className="text-lg font-semibold text-white"
              >
                Tu presupuesto de este mes
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Ponle un monto a cada rubro. Si no sabes cuánto, déjalo en cero
                y lo ajustas después en Presupuesto.
              </p>
            </div>

            {items.length === 0 ? (
              <p className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-300">
                Aún no tienes rubros este mes. Puedes crearlos después en
                Presupuesto.
              </p>
            ) : (
              <>
                {ingreso > 0 ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-300">
                      50 % necesidades, 30 % deseos y 20 % ahorro de tus{' '}
                      {formatCOP(ingreso)}.
                    </p>
                    <Button variant="outline" onClick={sugerir}>
                      Sugerir con 50/30/20
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    Si escribes tu ingreso en el paso 1, te sugerimos los montos
                    con la regla 50/30/20.
                  </p>
                )}

                <div className="space-y-5">
                  {itemsPorCategoria.map(([categoria, lista]) => (
                    <fieldset key={categoria} className="space-y-3">
                      <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {categoria}
                      </legend>
                      {lista.map(item => (
                        <label
                          key={item.id}
                          className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_12rem]"
                        >
                          <span className="text-sm text-white">
                            {item.name}
                            <span className="ml-2 text-xs text-slate-500">
                              {item.classificationName}
                            </span>
                          </span>
                          <CurrencyInput
                            value={montos[item.id] ?? 0}
                            onChange={valor =>
                              setMontos(prev => ({ ...prev, [item.id]: valor }))
                            }
                            disabled={guardandoPresupuesto}
                          />
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>

                <dl className="space-y-1 rounded-lg bg-slate-800/60 p-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">Asignado</dt>
                    <dd className="font-medium tabular-nums text-white">
                      {formatCOP(totalAsignado)}
                      {ingreso > 0 && (
                        <span className="text-slate-500">
                          {' '}
                          de {formatCOP(ingreso)}
                        </span>
                      )}
                    </dd>
                  </div>
                  {ahorroSinAsignar !== null && ahorroSinAsignar > 0 && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-400">Sin asignar: ahorro</dt>
                      <dd className="font-medium tabular-nums text-emerald-400">
                        {formatCOP(ahorroSinAsignar)}
                      </dd>
                    </div>
                  )}
                </dl>
              </>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button
                  variant="ghost"
                  onClick={() => setPaso(1)}
                  disabled={guardandoPresupuesto}
                >
                  Atrás
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setPaso(3)}
                  disabled={guardandoPresupuesto}
                >
                  Saltar
                </Button>
              </div>
              {items.length === 0 ? (
                <Button variant="gradient" onClick={() => setPaso(3)}>
                  Seguir
                </Button>
              ) : (
                <Button
                  variant="gradient"
                  onClick={guardarPresupuesto}
                  loading={guardandoPresupuesto}
                  disabled={guardandoPresupuesto}
                >
                  Guardar y seguir
                </Button>
              )}
            </div>
          </section>
        )}

        {paso === 3 && (
          <section aria-labelledby="paso-3-titulo" className="space-y-6">
            <div>
              <h2
                id="paso-3-titulo"
                className="text-lg font-semibold text-white"
              >
                Registra tu primer gasto
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Anótalo aquí o mándalo por WhatsApp: una foto de la factura o un
                texto como «40 mil almuerzo».
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
                <h3 className="text-sm font-semibold text-white">Aquí mismo</h3>

                <label className="block space-y-2">
                  <span className="text-sm text-slate-300">Monto</span>
                  <CurrencyInput
                    value={gastoMonto}
                    onChange={setGastoMonto}
                    disabled={guardandoGasto || terminando}
                  />
                </label>

                <div className="space-y-2">
                  <label
                    htmlFor="onboarding-gasto-descripcion"
                    className="text-sm text-slate-300"
                  >
                    Descripción
                  </label>
                  <Input
                    id="onboarding-gasto-descripcion"
                    variant="glass"
                    value={gastoDescripcion}
                    onChange={e => setGastoDescripcion(e.target.value)}
                    placeholder="Ej.: Almuerzo"
                    maxLength={255}
                    disabled={guardandoGasto || terminando}
                  />
                </div>

                {categoryNames.length > 0 ? (
                  <div className="space-y-2">
                    <label
                      htmlFor="onboarding-gasto-categoria"
                      className="text-sm text-slate-300"
                    >
                      Categoría
                    </label>
                    <select
                      id="onboarding-gasto-categoria"
                      value={gastoCategoria}
                      onChange={e => setGastoCategoria(e.target.value)}
                      className={SELECT_CLASES}
                      disabled={guardandoGasto || terminando}
                    >
                      {categoryNames.map(nombre => (
                        <option key={nombre} value={nombre}>
                          {nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-sm text-amber-300">
                    Primero crea una categoría en Ajustes.
                  </p>
                )}

                <p className="text-xs text-slate-500">
                  Se guarda con la fecha de hoy en la cuenta {CUENTA_GASTO}.
                </p>

                <Button
                  variant="gradient"
                  className="w-full"
                  onClick={guardarGasto}
                  loading={guardandoGasto}
                  disabled={!gastoListo || guardandoGasto || terminando}
                >
                  Guardar gasto
                </Button>
              </div>

              <div className="space-y-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <h3 className="text-sm font-semibold text-white">
                  Mándalo por WhatsApp
                </h3>

                {codigo ? (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Tu código (válido 10 minutos)
                    </p>
                    <p className="font-mono text-3xl tracking-widest text-emerald-400">
                      {codigo}
                    </p>
                    <WhatsAppLinkInstructions
                      code={codigo}
                      linkUrl={enlaceWhatsApp}
                    />
                    <p className="text-xs text-slate-400">
                      Cuando el bot te confirme, mándale tu primer gasto.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-300">
                      Vincula tu número y registra gastos con una foto o un
                      mensaje.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={generarCodigo}
                      loading={generandoCodigo}
                      disabled={generandoCodigo || terminando}
                    >
                      Generar código
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button
                  variant="ghost"
                  onClick={() => setPaso(2)}
                  disabled={terminando || guardandoGasto}
                >
                  Atrás
                </Button>
                <Button
                  variant="ghost"
                  onClick={terminar}
                  disabled={terminando || guardandoGasto}
                >
                  Saltar
                </Button>
              </div>
              <Button
                variant="gradient"
                onClick={terminar}
                loading={terminando}
                disabled={terminando || guardandoGasto}
              >
                Ir a mi tablero
              </Button>
            </div>
          </section>
        )}
      </Card>
    </div>
  );
}
