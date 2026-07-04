'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { LoyaltyCard, LoyaltyProgram } from './interface';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  program: LoyaltyProgram;
  clientId: string;
  clientPlan?: string;
}

const PLAN_LEVELS: Record<string, number> = { FREE: 0, BASIC: 1, PRO: 2 };

function StampGrid({ earned, total, stampIcon, stampColor }: { earned: number; total: number; stampIcon: string; stampColor: string }) {
  const slots = Math.max(total, earned);
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {Array.from({ length: slots }).map((_, i) => {
        const filled = i < earned;
        return (
          <div
            key={i}
            className={`aspect-square rounded-lg flex items-center justify-center border ${
              filled ? 'border-transparent' : 'border-dashed border-outline-variant opacity-40'
            }`}
            style={filled ? { backgroundColor: stampColor, color: '#fff' } : {}}
          >
            {filled && <span className="material-symbols-outlined text-sm">{stampIcon}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function LoyaltyCardsPanel({ program, clientId, clientPlan = 'FREE' }: Props) {
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerEmail: '' });

  const canRegisterByPhone = (PLAN_LEVELS[clientPlan] ?? 0) >= PLAN_LEVELS.BASIC;

  const loadCards = async () => {
    try {
      setLoading(true);
      const data = await api.getLoyaltyCards(clientId);
      setCards(data);
    } catch (error) {
      console.error('Error loading loyalty cards:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, [clientId]);

  const handleAddVisit = async (cardId: string) => {
    try {
      setAddingId(cardId);
      await api.addLoyaltyStamp(cardId);
      await loadCards();
    } catch (error) {
      console.error('Error adding visit stamp:', error);
      alert('No se pudo registrar la visita. ¿El programa está activo?');
    } finally {
      setAddingId(null);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    setMessage('');
    try {
      const card = await api.createLoyaltyCardAdmin({
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        customerEmail: form.customerEmail.trim() || undefined,
        clientId,
      });
      setMessage(
        card.alreadyExists
          ? 'Este teléfono ya tenía tarjeta. El cliente puede consultarla en el portal.'
          : 'Tarjeta creada. El cliente accede en el portal con su número de teléfono.'
      );
      setForm({ customerName: '', customerPhone: '', customerEmail: '' });
      setShowRegister(false);
      await loadCards();
      setTimeout(() => setMessage(''), 4000);
    } catch (error: unknown) {
      setMessage('Error: ' + (error instanceof Error ? error.message : 'No se pudo registrar'));
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return <div className="glass-card rounded-xl h-48 animate-pulse" />;
  }

  return (
    <div className="space-y-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Cada visita completada suma 1 sello. Con el teléfono el cliente consulta su tarjeta en el portal.
        </p>
        {canRegisterByPhone ? (
          <button
            type="button"
            onClick={() => setShowRegister(!showRegister)}
            className="px-md py-2 bg-primary text-on-primary rounded-lg font-label-sm font-bold hover:opacity-90 whitespace-nowrap"
          >
            {showRegister ? 'Cerrar' : 'Registrar por teléfono'}
          </button>
        ) : (
          <Link
            href="/dashboard/billing"
            className="px-md py-2 border border-outline-variant rounded-lg font-label-sm font-bold text-primary hover:bg-surface-container-low whitespace-nowrap"
          >
            Profesional: registrar por teléfono
          </Link>
        )}
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg font-body-sm ${
            message.startsWith('Error')
              ? 'bg-error-container text-on-error-container'
              : 'bg-secondary-container text-on-secondary-container'
          }`}
        >
          {message}
        </div>
      )}

      {canRegisterByPhone && showRegister && (
        <form
          onSubmit={handleRegister}
          className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant grid grid-cols-1 md:grid-cols-3 gap-md"
        >
          <div>
            <label className="font-label-sm text-on-surface-variant mb-1 block">Nombre *</label>
            <input
              required
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              className="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-lg font-body-sm outline-none focus:border-primary"
              placeholder="Nombre del cliente"
            />
          </div>
          <div>
            <label className="font-label-sm text-on-surface-variant mb-1 block">Teléfono *</label>
            <input
              required
              type="tel"
              value={form.customerPhone}
              onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              className="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-lg font-body-sm outline-none focus:border-primary"
              placeholder="+52 55..."
            />
            <p className="text-xs text-on-surface-variant mt-1">Con este número consulta su tarjeta en el portal</p>
          </div>
          <div>
            <label className="font-label-sm text-on-surface-variant mb-1 block">Correo (opcional)</label>
            <input
              type="email"
              value={form.customerEmail}
              onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
              className="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-lg font-body-sm outline-none focus:border-primary"
            />
          </div>
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={registering}
              className="px-lg py-2.5 bg-primary text-on-primary rounded-lg font-label-md font-bold hover:opacity-90 disabled:opacity-50"
            >
              {registering ? 'Registrando...' : 'Crear tarjeta de fidelidad'}
            </button>
          </div>
        </form>
      )}

      {cards.length === 0 ? (
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3">credit_card</span>
          <h3 className="font-headline-md text-on-surface mb-sm">Sin tarjetas aún</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {canRegisterByPhone
              ? 'Registra un cliente con su teléfono o espera a que se inscriba en el portal.'
              : 'Las tarjetas se crean en el portal público. En plan Profesional puedes registrarlas aquí por teléfono.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
          {cards.map((card) => (
            <div
              key={card.id}
              className="rounded-xl border border-outline-variant overflow-hidden shadow-sm"
              style={{ backgroundColor: program.backgroundColor, color: program.textColor }}
            >
              <div className="p-lg">
                <div className="flex items-start justify-between mb-md">
                  <div>
                    <p className="text-xs opacity-70">Tarjeta virtual</p>
                    <p className="font-headline-md">{card.customerName}</p>
                    <p className="text-sm opacity-80">{card.customerPhone || card.customerEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{card.visitsCount ?? card.stampsEarned}</p>
                    <p className="text-xs opacity-70">visitas</p>
                  </div>
                </div>

                <StampGrid
                  earned={card.stampsEarned}
                  total={program.stampsToReward}
                  stampIcon={program.stampIcon}
                  stampColor={program.stampColor}
                />

                <div className="flex items-center justify-between mt-md pt-md border-t border-black/10">
                  <div className="text-xs opacity-80">
                    {card.lastVisitAt
                      ? `Última visita: ${format(new Date(card.lastVisitAt), "d MMM yyyy", { locale: es })}`
                      : 'Sin visitas registradas'}
                  </div>
                  {card.isCompleted && (
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/20">Tarjeta completa</span>
                  )}
                </div>
              </div>

              <div className="px-lg py-md bg-black/5 border-t border-black/10 flex items-center justify-between gap-3">
                <div className="text-xs opacity-80">
                  {card.stampsEarned}/{program.stampsToReward} sellos
                </div>
                <button
                  onClick={() => handleAddVisit(card.id)}
                  disabled={addingId === card.id || card.isCompleted || !program.isActive}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/90 text-on-surface hover:bg-white disabled:opacity-50 transition-all"
                >
                  {addingId === card.id ? 'Registrando...' : '+ Registrar visita'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
