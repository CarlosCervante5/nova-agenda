'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { LoyaltyCard, LoyaltyProgram } from './interface';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  program: LoyaltyProgram;
  clientId: string;
}

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

export default function LoyaltyCardsPanel({ program, clientId }: Props) {
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

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

  if (loading) {
    return <div className="glass-card rounded-xl h-48 animate-pulse" />;
  }

  if (cards.length === 0) {
    return (
      <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant text-center">
        <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-3">credit_card</span>
        <h3 className="font-headline-md text-on-surface mb-sm">Sin tarjetas aún</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Las tarjetas se crean cuando un cliente se registra en el portal o al completar su primera cita.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Cada visita completada suma 1 sello. También puedes registrar visitas presenciales manualmente.
      </p>

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
    </div>
  );
}
