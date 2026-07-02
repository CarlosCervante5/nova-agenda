'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import PasswordInput from '@/components/PasswordInput';

const PLANS = {
  FREE: { name: 'Gratuito', price: 0, color: 'bg-surface-container-high text-on-surface-variant', icon: 'spa' },
  BASIC: { name: 'Profesional', price: 49, color: 'bg-primary text-on-primary', icon: 'star' },
  PRO: { name: 'Business', price: 99, color: 'bg-tertiary text-on-tertiary', icon: 'rocket_launch' },
};

function RegisterForm() {
  const searchParams = useSearchParams();
  const initialPlan = searchParams.get('plan') || 'FREE';
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState(PLANS[initialPlan as keyof typeof PLANS] ? initialPlan : 'FREE');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const selectedPlan = PLANS[plan as keyof typeof PLANS] || PLANS.FREE;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.register(businessName, ownerName, email, password, plan);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="absolute top-20 left-20 w-64 h-64 bg-primary opacity-5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-64 h-64 bg-secondary-fixed opacity-10 rounded-full blur-3xl" />

      <div className="w-full max-w-lg relative z-10">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-on-primary shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-2xl">spa</span>
            </div>
            <span className="font-headline-lg text-headline-lg font-bold text-primary">Nova Agenda</span>
          </Link>
          <h1 className="font-headline-md text-headline-md text-on-surface">Crea tu Negocio</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Comienza gratis, mejora cuando quieras</p>
        </div>

        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-lg">
            {error && (
              <div className="p-4 bg-error-container text-on-error-container rounded-lg flex items-center gap-3">
                <span className="material-symbols-outlined">error</span>
                <p className="font-body-sm text-body-sm">{error}</p>
              </div>
            )}

            {/* Plan Selector */}
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-sm block">Selecciona tu Plan</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(PLANS) as Array<keyof typeof PLANS>).map((key) => {
                  const p = PLANS[key];
                  const isSelected = plan === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPlan(key)}
                      className={`relative p-3 rounded-lg border-2 transition-all text-center ${
                        isSelected
                          ? 'border-primary bg-primary-container/20 shadow-sm'
                          : 'border-outline-variant hover:border-primary/50'
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-on-primary text-sm">check</span>
                        </span>
                      )}
                      <span className={`material-symbols-outlined text-xl block mb-1 ${isSelected ? 'text-primary' : 'text-on-surface-variant'}`}>{p.icon}</span>
                      <span className={`font-label-sm text-label-sm block ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{p.name}</span>
                      <span className={`font-headline-md text-headline-md block ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
                        {p.price === 0 ? 'Gratis' : `$${p.price}`}
                      </span>
                      {p.price > 0 && <span className="font-body-sm text-body-sm text-on-surface-variant">/mes</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Nombre del Negocio</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="Ej: Spa Bellesa"
                required
              />
            </div>

            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Tu Nombre</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="Nombre completo"
                required
              />
            </div>

            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Correo Electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="tu@negocio.com"
                required
              />
            </div>

            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Contraseña</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 rounded-lg font-label-md text-label-md font-bold shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${
                selectedPlan.price > 0
                  ? 'bg-primary text-on-primary shadow-primary/20 hover:opacity-90'
                  : 'bg-primary text-on-primary shadow-primary/20 hover:opacity-90'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-on-primary border-t-transparent rounded-full" />
                  Creando cuenta...
                </span>
              ) : selectedPlan.price > 0
                ? `Comenzar con ${selectedPlan.name} — $${selectedPlan.price}/mes`
                : 'Comenzar Gratis'
              }
            </button>

            <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
              {selectedPlan.price > 0 && 'Puedes cambiar a gratuito después. '}Al crear aceptas nuestros términos.
            </p>
          </form>
        </div>

        <p className="mt-6 text-center font-body-sm text-body-sm text-on-surface-variant">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-primary font-bold hover:underline">Iniciar Sesión</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background" />}>
      <RegisterForm />
    </Suspense>
  );
}
