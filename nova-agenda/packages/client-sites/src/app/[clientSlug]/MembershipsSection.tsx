'use client';

import { useEffect, useState } from 'react';
import {
  confirmMembership,
  createMembershipCheckout,
  MembershipPlan,
} from '@/lib/api';

interface Props {
  clientSlug: string;
  clientName: string;
  primaryColor: string;
  plans: MembershipPlan[];
  checkoutStatus?: 'success' | 'canceled' | null;
  sessionId?: string | null;
}

const INTERVALS: Record<string, string> = {
  month: 'mes',
  year: 'año',
  one_time: 'pago único',
};

function money(price: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency.toUpperCase() }).format(price);
  } catch {
    return `$${price} ${currency}`;
  }
}

export default function MembershipsSection({
  clientSlug,
  clientName,
  primaryColor,
  plans,
  checkoutStatus,
  sessionId,
}: Props) {
  const [selected, setSelected] = useState<MembershipPlan | null>(null);
  const [form, setForm] = useState({ customerName: '', customerEmail: '', customerPhone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmedName, setConfirmedName] = useState('');
  const [banner, setBanner] = useState<'success' | 'canceled' | 'pending' | null>(
    checkoutStatus === 'canceled' ? 'canceled' : null
  );

  useEffect(() => {
    if (checkoutStatus !== 'success' || !sessionId) return;
    let cancelled = false;
    setBanner('pending');
    confirmMembership({ sessionId, clientSlug })
      .then((purchase) => {
        if (cancelled) return;
        setConfirmedName(purchase.plan?.name || '');
        setBanner('success');
      })
      .catch(() => {
        if (!cancelled) setBanner('pending');
      });
    return () => {
      cancelled = true;
    };
  }, [checkoutStatus, sessionId, clientSlug]);

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      const { url } = await createMembershipCheckout({
        clientSlug,
        planId: selected.id,
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim(),
        customerPhone: form.customerPhone.trim() || undefined,
        returnUrl: window.location.origin + window.location.pathname,
      });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el pago');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-xl">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-md text-on-primary shadow-lg"
          style={{ backgroundColor: primaryColor }}
        >
          <span className="material-symbols-outlined text-3xl">card_membership</span>
        </div>
        <h1 className="font-headline-lg text-on-surface mb-2">Membresías</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Elige un plan de {clientName} y págalo de forma segura con Stripe.
        </p>
      </div>

      {banner === 'success' && (
        <div className="mb-xl p-5 rounded-xl border bg-secondary-container/20 border-secondary-container flex items-start gap-3">
          <span className="material-symbols-outlined text-on-secondary-container">check_circle</span>
          <div>
            <p className="font-medium text-on-surface">¡Membresía activada!</p>
            <p className="font-body-sm text-on-surface-variant">
              {confirmedName
                ? `Tu plan ${confirmedName} ya está activo. Recibirás confirmación en tu correo.`
                : 'Tu pago se registró correctamente.'}
            </p>
          </div>
        </div>
      )}

      {banner === 'pending' && (
        <div className="mb-xl p-5 rounded-xl border border-outline-variant bg-surface-container-low">
          Estamos confirmando tu pago. Si ya se cobró, tu membresía quedará activa en unos segundos.
        </div>
      )}

      {banner === 'canceled' && (
        <div className="mb-xl p-5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface-variant">
          El checkout se canceló. Puedes elegir otra membresía cuando quieras.
        </div>
      )}

      {plans.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl p-xl border border-outline-variant text-center text-on-surface-variant">
          Este negocio aún no tiene membresías publicadas.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-surface-container-lowest rounded-2xl p-lg border border-outline-variant flex flex-col">
              <h2 className="font-headline-md text-on-surface">{plan.name}</h2>
              <p className="font-headline-lg mt-2" style={{ color: primaryColor }}>
                {money(plan.price, plan.currency)}
                <span className="font-body-sm text-on-surface-variant"> / {INTERVALS[plan.interval] || plan.interval}</span>
              </p>
              {plan.description && (
                <p className="font-body-sm text-on-surface-variant mt-3">{plan.description}</p>
              )}
              <ul className="space-y-2 my-5 flex-1">
                {(plan.benefits || []).map((benefit) => (
                  <li key={benefit} className="flex gap-2 font-body-sm text-on-surface">
                    <span className="material-symbols-outlined text-[18px]" style={{ color: primaryColor }}>check</span>
                    {benefit}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => { setSelected(plan); setError(''); }}
                className="w-full py-3 text-on-primary rounded-xl font-semibold shadow-lg hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                Adquirir
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-xl border border-outline-variant shadow-xl">
            <h3 className="font-headline-md text-on-surface mb-1">Checkout — {selected.name}</h3>
            <p className="font-body-sm text-on-surface-variant mb-lg">
              {money(selected.price, selected.currency)} / {INTERVALS[selected.interval] || selected.interval}. Te llevamos a Stripe para pagar.
            </p>

            {error && (
              <div className="p-4 bg-error-container text-on-error-container rounded-lg mb-lg font-body-sm">{error}</div>
            )}

            <form onSubmit={handleCheckout} className="space-y-md">
              <div>
                <label className="font-label-md text-on-surface mb-xs block">Nombre *</label>
                <input
                  required
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="font-label-md text-on-surface mb-xs block">Correo *</label>
                <input
                  required
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="font-label-md text-on-surface mb-xs block">Teléfono</label>
                <input
                  type="tel"
                  value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg outline-none focus:border-primary"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 text-on-primary rounded-xl font-semibold disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {loading ? 'Redirigiendo…' : 'Ir a pagar'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="px-4 py-3 border border-outline-variant rounded-xl font-label-md"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
