'use client';

import { useEffect, useState } from 'react';
import {
  checkLoyaltyCard,
  createLoyaltyCard,
  getLoyaltyCard,
  LoyaltyCard,
  LoyaltyProgram,
} from '@/lib/api';

interface Props {
  clientId: string;
  clientName: string;
  primaryColor: string;
  program: LoyaltyProgram;
}

type View = 'lookup' | 'enroll' | 'card';

export default function LoyaltySection({ clientId, clientName, primaryColor, program }: Props) {
  const [view, setView] = useState<View>('lookup');
  const [phone, setPhone] = useState('');
  const [form, setForm] = useState({ customerName: '', customerEmail: '', customerPhone: '' });
  const [card, setCard] = useState<LoyaltyCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedCardId = sessionStorage.getItem(`loyalty-card-${clientId}`);
    if (savedCardId) {
      getLoyaltyCard(savedCardId).then((saved) => {
        if (saved) {
          setCard(saved);
          setView('card');
        }
      });
    }
  }, [clientId]);

  const loadFullCard = async (cardId: string) => {
    const fullCard = await getLoyaltyCard(cardId);
    if (fullCard) {
      setCard(fullCard);
      sessionStorage.setItem(`loyalty-card-${clientId}`, cardId);
      setView('card');
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    setLoading(true);
    setError('');
    try {
      const found = await checkLoyaltyCard(clientId, phone.trim());
      if (found) {
        await loadFullCard(found.id);
      } else {
        setForm({ customerName: '', customerEmail: '', customerPhone: phone.trim() });
        setView('enroll');
      }
    } catch {
      setError('No se pudo consultar la tarjeta. Intenta de nuevo.');
    }
    setLoading(false);
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName.trim() || !form.customerPhone.trim()) return;

    setLoading(true);
    setError('');
    try {
      const newCard = await createLoyaltyCard({
        clientId,
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim() || undefined,
        customerPhone: form.customerPhone.trim(),
      });
      await loadFullCard(newCard.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la tarjeta.');
    }
    setLoading(false);
  };

  const earned = card?.stampsEarned || 0;
  const visits = card?.visitsCount ?? earned;
  const stampsToShow = Math.max(program.stampsToReward, earned);
  const visitHistory = card?.stamps || [];
  const progress = Math.min((earned / program.stampsToReward) * 100, 100);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-xl">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-md text-on-primary shadow-lg"
          style={{ backgroundColor: program.stampColor || primaryColor }}
        >
          <span className="material-symbols-outlined text-3xl">{program.stampIcon}</span>
        </div>
        <h1 className="font-headline-lg text-on-surface mb-2">{program.name}</h1>
        {program.description && (
          <p className="font-body-md text-body-md text-on-surface-variant">{program.description}</p>
        )}
      </div>

      {view === 'lookup' && (
        <div className="bg-surface-container-lowest rounded-2xl p-xl border border-outline-variant shadow-sm">
          <h2 className="font-headline-md text-on-surface mb-sm">Consulta tu tarjeta</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-lg">
            Ingresa tu teléfono para ver tus sellos o unirte al programa de {clientName}.
          </p>

          {error && (
            <div className="p-4 bg-error-container text-on-error-container rounded-lg flex items-center gap-3 mb-lg">
              <span className="material-symbols-outlined">error</span>
              <p className="font-body-sm text-body-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleLookup} className="space-y-lg">
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Teléfono *</label>
              <input
                type="tel"
                placeholder="+52 55 1234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !phone.trim()}
              className="w-full py-3 text-on-primary rounded-xl font-semibold shadow-lg disabled:opacity-50 transition-all active:scale-[0.98]"
              style={{ backgroundColor: primaryColor }}
            >
              {loading ? 'Consultando...' : 'Consultar Tarjeta'}
            </button>
          </form>

          {program.welcomeMessage && (
            <p className="mt-lg pt-lg border-t border-outline-variant font-body-sm text-body-sm text-on-surface-variant text-center">
              {program.welcomeMessage}
            </p>
          )}
        </div>
      )}

      {view === 'enroll' && (
        <div className="bg-surface-container-lowest rounded-2xl p-xl border border-outline-variant shadow-sm">
          <h2 className="font-headline-md text-on-surface mb-sm">Únete al programa</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-lg">
            No encontramos una tarjeta con ese teléfono. Completa tus datos para registrarte.
          </p>

          {error && (
            <div className="p-4 bg-error-container text-on-error-container rounded-lg flex items-center gap-3 mb-lg">
              <span className="material-symbols-outlined">error</span>
              <p className="font-body-sm text-body-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleEnroll} className="space-y-lg">
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Nombre Completo *</label>
              <input
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                required
              />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Correo Electrónico</label>
              <input
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Teléfono *</label>
              <input
                type="tel"
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setView('lookup'); setError(''); }}
                className="px-lg py-3 border border-outline-variant text-on-surface rounded-lg font-label-md text-label-md hover:bg-surface-container-low transition-all"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 text-on-primary rounded-xl font-semibold shadow-lg disabled:opacity-50 transition-all"
                style={{ backgroundColor: primaryColor }}
              >
                {loading ? 'Registrando...' : 'Crear Mi Tarjeta'}
              </button>
            </div>
          </form>
        </div>
      )}

      {view === 'card' && card && (
        <div className="space-y-lg">
          <div
            className="rounded-2xl p-xl border border-outline-variant shadow-lg overflow-hidden"
            style={{ backgroundColor: program.backgroundColor, color: program.textColor }}
          >
            <div className="flex items-center justify-between mb-lg">
              <div>
                <p className="font-label-sm text-label-sm opacity-70">Tarjeta de</p>
                <p className="font-headline-md">{card.customerName}</p>
              </div>
              {card.isCompleted && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-secondary-container text-on-secondary-container">
                  ¡Completada!
                </span>
              )}
            </div>

            <div className="mb-md">
              <div className="flex justify-between text-sm mb-2 opacity-80">
                <span>{visits} {visits === 1 ? 'visita' : 'visitas'} · {earned} de {program.stampsToReward} sellos</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, backgroundColor: program.stampColor || primaryColor }}
                />
              </div>
            </div>

            <div className="grid grid-cols-5 gap-3">
              {Array.from({ length: stampsToShow }).map((_, i) => {
                const filled = i < earned;
                return (
                  <div
                    key={i}
                    className={`aspect-square rounded-xl flex items-center justify-center border-2 transition-all ${
                      filled ? 'border-transparent shadow-md scale-105' : 'border-dashed opacity-40'
                    }`}
                    style={filled ? { backgroundColor: program.stampColor || primaryColor, color: '#fff' } : {}}
                  >
                    {filled && (
                      <span className="material-symbols-outlined text-xl">{program.stampIcon}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {card.isCompleted && program.rewardMessage && (
              <p className="mt-lg pt-lg border-t border-black/10 text-sm text-center font-medium">
                {program.rewardMessage}
              </p>
            )}
          </div>

          {visitHistory.length > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl p-xl border border-outline-variant">
              <h3 className="font-headline-md text-on-surface mb-md flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">history</span>
                Historial de visitas
              </h3>
              <div className="space-y-2">
                {visitHistory.map((stamp, index) => (
                  <div
                    key={stamp.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-on-primary"
                        style={{ backgroundColor: program.stampColor || primaryColor }}
                      >
                        <span className="material-symbols-outlined text-sm">{program.stampIcon}</span>
                      </div>
                      <span className="font-medium text-on-surface text-sm">
                        Visita #{visitHistory.length - index}
                      </span>
                    </div>
                    <span className="text-xs text-on-surface-variant">
                      {new Date(stamp.createdAt).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {program.rewards.length > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl p-xl border border-outline-variant">
              <h3 className="font-headline-md text-on-surface mb-md flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">redeem</span>
                Recompensas
              </h3>
              <div className="space-y-3">
                {program.rewards.map((reward) => {
                  const unlocked = earned >= reward.stampsRequired;
                  return (
                    <div
                      key={reward.id}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        unlocked
                          ? 'border-secondary bg-secondary-container/20'
                          : 'border-outline-variant bg-surface-container-low'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          unlocked ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg">
                          {unlocked ? 'check_circle' : 'lock'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-on-surface">{reward.name}</p>
                        {reward.description && (
                          <p className="text-sm text-on-surface-variant truncate">{reward.description}</p>
                        )}
                      </div>
                      <span className="text-xs font-bold text-on-surface-variant whitespace-nowrap">
                        {reward.stampsRequired} sellos
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setView('lookup');
              setCard(null);
              setPhone('');
              sessionStorage.removeItem(`loyalty-card-${clientId}`);
            }}
            className="w-full py-3 border border-outline-variant text-on-surface rounded-xl font-label-md text-label-md hover:bg-surface-container-low transition-all"
          >
            Consultar otra tarjeta
          </button>
        </div>
      )}
    </div>
  );
}
