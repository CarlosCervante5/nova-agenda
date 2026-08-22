'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, MembershipPlan, MembershipPurchase } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const INTERVALS = [
  { value: 'month', label: 'Mensual' },
  { value: 'year', label: 'Anual' },
  { value: 'one_time', label: 'Pago único' },
];

const emptyForm = {
  name: '',
  description: '',
  price: '0',
  currency: 'mxn',
  interval: 'month',
  benefits: '',
  isActive: true,
};

function intervalLabel(value: string) {
  return INTERVALS.find((i) => i.value === value)?.label || value;
}

function money(price: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency.toUpperCase() }).format(price);
  } catch {
    return `$${price} ${currency}`;
  }
}

export default function MembershipsPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [purchases, setPurchases] = useState<MembershipPurchase[]>([]);
  const [tab, setTab] = useState<'plans' | 'sales'>('plans');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MembershipPlan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [stripeReady, setStripeReady] = useState(true);

  useEffect(() => {
    if (user?.clientId) loadData();
    else setLoading(false);
  }, [user]);

  async function loadData() {
    try {
      const [planData, purchaseData, stripe] = await Promise.all([
        api.getMemberships(),
        api.getMembershipPurchases(),
        api.getClientStripeConfig().catch(() => null),
      ]);
      setPlans(planData);
      setPurchases(purchaseData);
      setStripeReady(Boolean(stripe?.configured || stripe?.hasSecretKey));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron cargar las membresías');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage('');
  }

  function openEdit(plan: MembershipPlan) {
    setEditing(plan);
    setForm({
      name: plan.name,
      description: plan.description || '',
      price: String(plan.price),
      currency: plan.currency || 'mxn',
      interval: plan.interval || 'month',
      benefits: (plan.benefits || []).join('\n'),
      isActive: plan.isActive,
    });
    setShowForm(true);
    setMessage('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    const payload = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      currency: form.currency,
      interval: form.interval,
      benefits: form.benefits,
      isActive: form.isActive,
    };
    try {
      if (editing) await api.updateMembership(editing.id, payload);
      else await api.createMembership(payload);
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(plan: MembershipPlan) {
    if (!confirm(`¿Desactivar "${plan.name}"? Dejará de aparecer en la página pública.`)) return;
    try {
      await api.deleteMembership(plan.id);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo desactivar');
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

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Membresías</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Créalas aquí y tus clientes las compran con checkout Stripe en tu página pública.
            Necesitas las claves de Stripe en Configuración.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-on-primary px-md py-2.5 rounded-lg font-label-md font-bold shadow-lg shadow-primary/20 hover:opacity-90"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Nueva membresía
        </button>
      </div>

      <div className="flex gap-2 bg-surface-container-low rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('plans')}
          className={`px-4 py-2 rounded-md font-label-md ${tab === 'plans' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant'}`}
        >
          Planes
        </button>
        <button
          onClick={() => setTab('sales')}
          className={`px-4 py-2 rounded-md font-label-md ${tab === 'sales' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant'}`}
        >
          Compras ({purchases.length})
        </button>
      </div>

      {message && (
        <div className="p-4 bg-error-container text-on-error-container rounded-lg">{message}</div>
      )}

      {!stripeReady && (
        <div className="p-4 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface">
          Para vender membresías configura Stripe en{' '}
          <Link href="/dashboard/settings" className="text-primary font-bold underline">Configuración</Link>.
          El checkout de la página pública cobra en tu cuenta.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant grid grid-cols-1 md:grid-cols-2 gap-lg">
          <h3 className="col-span-full font-headline-md text-on-surface">{editing ? 'Editar membresía' : 'Nueva membresía'}</h3>
          <div>
            <label className="font-label-md text-on-surface mb-xs block">Nombre *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg" placeholder="Ej: Membresía Gold" />
          </div>
          <div>
            <label className="font-label-md text-on-surface mb-xs block">Precio *</label>
            <input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg" />
          </div>
          <div>
            <label className="font-label-md text-on-surface mb-xs block">Moneda</label>
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg">
              <option value="mxn">MXN</option>
              <option value="usd">USD</option>
            </select>
          </div>
          <div>
            <label className="font-label-md text-on-surface mb-xs block">Cobro</label>
            <select value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg">
              {INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="font-label-md text-on-surface mb-xs block">Descripción</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg min-h-[80px]" />
          </div>
          <div className="md:col-span-2">
            <label className="font-label-md text-on-surface mb-xs block">Beneficios (uno por línea)</label>
            <textarea value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg min-h-[100px]" placeholder={'Citas ilimitadas\n10% de descuento\nPrioridad en agenda'} />
          </div>
          <label className="flex items-center gap-2 col-span-full">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-5 h-5" />
            <span className="font-label-md">Visible en la página pública</span>
          </label>
          <div className="col-span-full flex gap-3">
            <button type="submit" disabled={saving} className="px-lg py-3 bg-primary text-on-primary rounded-lg font-label-md font-bold disabled:opacity-50">
              {saving ? 'Guardando…' : editing ? 'Actualizar' : 'Crear membresía'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="px-lg py-3 border border-outline-variant rounded-lg">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {tab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
          {plans.length === 0 && !showForm && (
            <div className="col-span-full bg-surface-container-lowest p-xl rounded-xl border border-outline-variant text-on-surface-variant">
              Aún no hay membresías. Crea la primera para que aparezca el checkout en tu página.
            </div>
          )}
          {plans.map((plan) => (
            <div key={plan.id} className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-headline-md text-on-surface">{plan.name}</h3>
                  <p className="font-headline-lg text-primary mt-1">
                    {money(plan.price, plan.currency)}
                    <span className="font-body-sm text-on-surface-variant"> / {intervalLabel(plan.interval).toLowerCase()}</span>
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${plan.isActive ? 'bg-secondary-container/30 text-on-secondary-container' : 'bg-error-container/30 text-on-error-container'}`}>
                  {plan.isActive ? 'Publicada' : 'Oculta'}
                </span>
              </div>
              {plan.description && <p className="font-body-sm text-on-surface-variant mb-3">{plan.description}</p>}
              <ul className="space-y-1 mb-4">
                {(plan.benefits || []).map((b) => (
                  <li key={b} className="font-body-sm text-on-surface flex gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary">check</span>
                    {b}
                  </li>
                ))}
              </ul>
              <p className="font-label-sm text-on-surface-variant mb-3">{plan._count?.purchases || 0} compras</p>
              <div className="flex gap-2">
                <button onClick={() => openEdit(plan)} className="px-3 py-2 rounded-lg border border-outline-variant font-label-sm">Editar</button>
                {plan.isActive && (
                  <button onClick={() => deactivate(plan)} className="px-3 py-2 rounded-lg text-error font-label-sm">Desactivar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'sales' && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
          {purchases.length === 0 ? (
            <p className="p-xl text-on-surface-variant">Todavía no hay compras.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                    <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase">Cliente</th>
                    <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase">Membresía</th>
                    <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase">Estado</th>
                    <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {purchases.map((p) => (
                    <tr key={p.id}>
                      <td className="px-lg py-3">
                        <p className="font-label-md text-on-surface">{p.customerName}</p>
                        <p className="font-body-sm text-on-surface-variant">{p.customerEmail}</p>
                      </td>
                      <td className="px-lg py-3 font-body-sm">{p.plan?.name}</td>
                      <td className="px-lg py-3">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-surface-container-high">{p.status}</span>
                      </td>
                      <td className="px-lg py-3 font-body-sm text-on-surface-variant">
                        {new Date(p.createdAt).toLocaleDateString('es-MX')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
