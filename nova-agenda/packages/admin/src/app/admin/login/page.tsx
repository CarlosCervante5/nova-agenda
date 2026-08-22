'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { homePath } from '@/lib/roles';
import PasswordInput from '@/components/PasswordInput';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login, setUser, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (user && user.role === 'SUPER_ADMIN') {
      router.replace(homePath(user));
    } else if (user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedUser = await login(email, password);
      if (loggedUser.role !== 'SUPER_ADMIN') {
        api.clearToken();
        setUser(null);
        setError('Acceso restringido. Esta cuenta no es administradora de la plataforma.');
        return;
      }
      router.push(homePath(loggedUser));
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-[3px] border-primary-container border-t-primary rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="absolute top-20 left-20 w-64 h-64 bg-primary opacity-5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-64 h-64 bg-secondary-fixed opacity-10 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center text-on-primary mx-auto mb-4 shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Nova Agenda</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Administración de la Plataforma</p>
        </div>

        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-lg">
            {error && (
              <div className="p-4 bg-error-container text-on-error-container rounded-lg flex items-center gap-3">
                <span className="material-symbols-outlined">error</span>
                <p className="font-body-sm text-body-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Correo Electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="admin@novaagenda.com"
                required
              />
            </div>

            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Contraseña</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-on-primary border-t-transparent rounded-full" />
                  Iniciando sesión...
                </span>
              ) : 'Iniciar Sesión'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center font-body-sm text-body-sm text-on-surface-variant">
          ¿Tienes un negocio en Nova Agenda?{' '}
          <Link href="/login" className="text-primary font-bold hover:underline">Inicia sesión aquí</Link>
        </p>
      </div>
    </div>
  );
}
