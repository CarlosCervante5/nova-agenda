'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSearchParams } from 'next/navigation';

interface PlanInfo {
  name: string;
  price: number;
  features: string[];
}

interface Subscription {
  id: string;
  status: string;
  currentPeriodEnd: string;
  cancelAt: string | null;
}

const PLAN_ICONS: Record<string, string> = {
  FREE: 'free_cancellation',
  BASIC: 'star',
  PRO: 'workspace_premium',
};

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-surface-container-high text-on-surface-variant',
  BASIC: 'bg-tertiary-container text-on-tertiary-container',
  PRO: 'bg-primary-container text-on-primary-container',
};

export default function BillingPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [currentPlan, setCurrentPlan] = useState('FREE');
  const [plans, setPlans] = useState<Record<string, PlanInfo>>({});
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<{
    services: { used: number; limit: number | null };
    bookingsThisMonth: { used: number; limit: number | null };
    publicBooking: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const PLAN_ORDER = ['FREE', 'BASIC', 'PRO'];

  useEffect(() => {
    loadPlans();
    // Handle redirect results from Stripe
    if (searchParams.get('success') === 'true') {
      setMessage('Pago procesado exitosamente. Tu plan ha sido actualizado.');
      setTimeout(() => setMessage(''), 5000);
    }
    if (searchParams.get('canceled') === 'true') {
      setMessage('El pago fue cancelado.');
    }
  }, [searchParams]);

  async function loadPlans() {
    try {
      const data = await api.getPlans();
      setCurrentPlan(data.currentPlan);
      setPlans(data.plans);
      setSubscription(data.subscription);
      setUsage(data.usage || null);
    } catch (error: unknown) {
      console.error('Error loading plans:', error);
      setMessage('Error: ' + (error instanceof Error ? error.message : 'No se pudieron cargar los planes'));
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(plan: string) {
    setCheckoutLoading(plan);
    setMessage('');
    try {
      const { url } = await api.createCheckoutSession(plan);
      if (url) {
        window.location.href = url;
        return;
      }
      setMessage('Error: Stripe no devolvió URL de checkout');
    } catch (error: unknown) {
      setMessage('Error: ' + (error instanceof Error ? error.message : 'No se pudo iniciar el pago'));
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleManageSubscription() {
    try {
      const { url } = await api.createPortalSession();
      if (url) {
        window.location.href = url;
      }
    } catch (error: any) {
      setMessage('Error: ' + error.message);
    }
  }

  if (loading) {
    return (
      <div className="space-y-gutter animate-pulse">
        <div className="glass-card rounded-xl h-12" />
        <div className="glass-card rounded-xl h-96" />
      </div>
    );
  }

  const currentLevel = PLAN_ORDER.indexOf(currentPlan);

  return (
    <div className="space-y-gutter">
      <div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Facturación y Planes</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">Gestiona tu suscripción y plan actual</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.startsWith('Error') ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'
        }`}>
          <span className="material-symbols-outlined">{message.startsWith('Error') ? 'error' : 'check_circle'}</span>
          <p className="font-body-sm text-body-sm">{message}</p>
        </div>
      )}

      {message.startsWith('Error') && message.includes('Stripe') && (
        <div className="p-4 rounded-lg bg-surface-container-low border border-outline-variant">
          <p className="font-label-md text-label-md text-on-surface mb-1">Configuración requerida</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            El administrador de la plataforma debe configurar Stripe en{' '}
            <strong>Configuración → Stripe</strong> o agregar las variables{' '}
            <code className="text-xs">STRIPE_SECRET_KEY</code>,{' '}
            <code className="text-xs">STRIPE_PRICE_ID_BASIC</code> y{' '}
            <code className="text-xs">STRIPE_PRICE_ID_PRO</code> en el servicio API.
          </p>
        </div>
      )}

      {/* Current Plan Banner */}
      <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${PLAN_COLORS[currentPlan] || PLAN_COLORS.FREE}`}>
              <span className="material-symbols-outlined text-2xl">{PLAN_ICONS[currentPlan] || 'help'}</span>
            </div>
            <div>
              <p className="font-label-md text-label-md text-on-surface-variant">Tu Plan Actual</p>
              <h3 className="font-headline-md text-headline-md text-on-surface">{plans[currentPlan]?.name || currentPlan}</h3>
            </div>
          </div>
          {subscription && (
            <div className="text-right">
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {subscription.status === 'active' ? 'Activo' : subscription.status === 'past_due' ? 'Pago pendiente' : subscription.status}
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Renovación: {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES')}
              </p>
              {subscription.cancelAt && (
                <p className="font-body-sm text-body-sm text-error">
                  Se cancela el: {new Date(subscription.cancelAt).toLocaleDateString('es-ES')}
                </p>
              )}
            </div>
          )}
        </div>
        {usage && (
          <div className="mt-lg pt-lg border-t border-outline-variant grid grid-cols-1 sm:grid-cols-2 gap-md">
            <div className="p-md rounded-lg bg-surface-container-low">
              <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Servicios</p>
              <p className="font-headline-md text-on-surface">
                {usage.services.used}
                {usage.services.limit !== null ? ` / ${usage.services.limit}` : ' (ilimitados)'}
              </p>
            </div>
            <div className="p-md rounded-lg bg-surface-container-low">
              <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Citas este mes</p>
              <p className="font-headline-md text-on-surface">
                {usage.bookingsThisMonth.used}
                {usage.bookingsThisMonth.limit !== null ? ` / ${usage.bookingsThisMonth.limit}` : ' (ilimitadas)'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
        {PLAN_ORDER.map((planKey) => {
          const plan = plans[planKey];
          if (!plan) return null;
          const isCurrent = planKey === currentPlan;
          const isDowngrade = PLAN_ORDER.indexOf(planKey) < currentLevel;
          const isUpgrade = PLAN_ORDER.indexOf(planKey) > currentLevel;

          return (
            <div
              key={planKey}
              className={`bg-surface-container-lowest p-xl rounded-xl border flex flex-col transition-all ${
                isCurrent
                  ? 'border-primary border-2 shadow-lg shadow-primary/10'
                  : 'border-outline-variant hover:border-primary/50'
              }`}
            >
              {isCurrent && (
                <div className="bg-primary text-on-primary text-center py-1.5 -mx-xl -mt-xl rounded-t-xl font-label-sm text-label-sm uppercase font-bold">
                  Plan Actual
                </div>
              )}
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mt-4 mb-md ${PLAN_COLORS[planKey]}`}>
                <span className="material-symbols-outlined text-xl">{PLAN_ICONS[planKey]}</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-1">{plan.name}</h3>
              <div className="mb-lg">
                {plan.price === 0 ? (
                  <span className="font-headline-lg text-headline-lg text-on-surface">Gratis</span>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="font-headline-lg text-headline-lg text-on-surface">${plan.price}</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">/mes</span>
                  </div>
                )}
              </div>
              <ul className="space-y-3 mb-xl flex-grow">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-lg mt-0.5">check_circle</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">{f}</span>
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                subscription ? (
                  <button
                    onClick={handleManageSubscription}
                    className="w-full py-3 rounded-lg border border-outline text-on-surface font-label-md text-label-md font-bold hover:bg-surface-container-high transition-all"
                  >
                    Gestionar Suscripción
                  </button>
                ) : (
                  <div className="w-full py-3 rounded-lg bg-surface-container-high text-on-surface-variant text-center font-label-md text-label-md">
                    Plan Gratuito
                  </div>
                )
              ) : isUpgrade ? (
                <button
                  onClick={() => handleUpgrade(planKey)}
                  disabled={checkoutLoading === planKey}
                  className="w-full py-3 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-bold shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {checkoutLoading === planKey ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-on-primary border-t-transparent rounded-full" />
                      Redirigiendo...
                    </span>
                  ) : (
                    'Mejorar Plan'
                  )}
                </button>
              ) : (
                <button
                  onClick={handleManageSubscription}
                  disabled={isDowngrade}
                  className="w-full py-3 rounded-lg border border-outline text-on-surface-variant font-label-md text-label-md font-bold hover:bg-surface-container-high disabled:opacity-30 transition-all"
                >
                  {isDowngrade ? 'No disponible' : 'Cambiar'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
        <h3 className="font-headline-md text-headline-md text-on-surface mb-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">help</span>
          Preguntas Frecuentes
        </h3>
        <div className="space-y-lg">
          <div>
            <p className="font-label-md text-label-md text-on-surface mb-xs">¿Puedo cambiar de plan en cualquier momento?</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Sí. Al mejorar, se aplica el cobro de inmediato. Al cancelar o cambiar a un plan inferior, se mantiene el plan actual hasta el final del período de facturación.</p>
          </div>
          <div>
            <p className="font-label-md text-label-md text-on-surface mb-xs">¿Qué métodos de pago aceptan?</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Aceptamos todas las tarjetas de crédito y débito principales a través de Stripe.</p>
          </div>
          <div>
            <p className="font-label-md text-label-md text-on-surface mb-xs">¿Qué pasa si no pago a tiempo?</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Si un pago falla, Stripe reintenta el cobro. Si persiste, tu plan se mantendrá por un período de gracia de 7 días antes de degradarse a Gratuito.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
