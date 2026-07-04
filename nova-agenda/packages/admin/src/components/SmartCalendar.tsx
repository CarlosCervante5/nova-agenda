'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { api, Booking } from '@/lib/api';
import CreateBookingModal from '@/components/CreateBookingModal';

type ViewMode = 'day' | 'week' | 'month';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);
const HOUR_HEIGHT = 56;
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
};

function bookingDateKey(booking: Booking) {
  return format(new Date(booking.date), 'yyyy-MM-dd');
}

function parseTimeMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function statusClass(status: string) {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-secondary-container text-on-secondary-container border-secondary/30';
    case 'PENDING':
      return 'bg-tertiary-fixed/30 text-on-tertiary-fixed-variant border-tertiary/30';
    case 'COMPLETED':
      return 'bg-primary-container/40 text-primary border-primary/30';
    case 'CANCELLED':
      return 'bg-error-container/50 text-on-error-container border-error/30 line-through opacity-70';
    default:
      return 'bg-surface-container-high text-on-surface-variant border-outline-variant';
  }
}

interface Props {
  onBookingUpdated?: () => void;
  clientPlan?: string;
}

export default function SmartCalendar({ onBookingUpdated, clientPlan = 'FREE' }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const range = useMemo(() => {
    if (viewMode === 'day') {
      const d = format(currentDate, 'yyyy-MM-dd');
      return { from: d, to: d };
    }
    if (viewMode === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      return { from: format(ws, 'yyyy-MM-dd'), to: format(we, 'yyyy-MM-dd') };
    }
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    return { from: format(ms, 'yyyy-MM-dd'), to: format(me, 'yyyy-MM-dd') };
  }, [currentDate, viewMode]);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBookings({ dateFrom: range.from, dateTo: range.to });
      setBookings(data.filter((b) => b.status !== 'CANCELLED'));
    } catch (error) {
      console.error('Error loading calendar bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const key = bookingDateKey(b);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [bookings]);

  function navigate(direction: 'prev' | 'next') {
    const fn =
      viewMode === 'day'
        ? direction === 'next' ? addDays : subDays
        : viewMode === 'week'
          ? direction === 'next' ? addWeeks : subWeeks
          : direction === 'next' ? addMonths : subMonths;
    setCurrentDate((d) => fn(d, 1));
  }

  function title() {
    if (viewMode === 'day') return format(currentDate, "EEEE d 'de' MMMM yyyy", { locale: es });
    if (viewMode === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(ws, 'd MMM', { locale: es })} – ${format(we, "d MMM yyyy", { locale: es })}`;
    }
    return format(currentDate, 'MMMM yyyy', { locale: es });
  }

  async function updateStatus(id: string, status: string) {
    await api.updateBookingStatus(id, status);
    setSelectedBooking(null);
    await loadBookings();
    onBookingUpdated?.();
  }

  const weekDays = useMemo(() => {
    const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [currentDate]);

  const monthDays = useMemo(() => {
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: ms, end: me });
    const pad = (ms.getDay() + 6) % 7;
    return [...Array(pad).fill(null), ...days];
  }, [currentDate]);

  return (
    <div className="glass-card rounded-xl overflow-hidden shadow-sm">
      <div className="px-lg py-md border-b border-outline-variant bg-surface-container-low flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">calendar_month</span>
            Calendario Inteligente
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant capitalize">{title()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-md py-2 bg-primary text-on-primary rounded-lg font-label-sm font-bold hover:opacity-90 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Nueva cita
          </button>
          <div className="flex bg-surface-container rounded-lg p-1">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-md text-label-sm font-label-sm transition-all ${
                  viewMode === mode ? 'bg-surface-container-lowest shadow-sm text-primary font-bold' : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {mode === 'day' ? 'Día' : mode === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate('prev')} className="p-2 rounded-lg hover:bg-surface-container-high transition-colors" aria-label="Anterior">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 rounded-lg border border-outline-variant text-label-sm font-label-sm hover:bg-surface-container-high transition-colors">
              Hoy
            </button>
            <button onClick={() => navigate('next')} className="p-2 rounded-lg hover:bg-surface-container-high transition-colors" aria-label="Siguiente">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-[420px] flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-[3px] border-primary-container border-t-primary rounded-full" />
        </div>
      ) : viewMode === 'month' ? (
        <div className="p-lg">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
              <div key={d} className="text-center font-label-sm text-label-sm text-on-surface-variant py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="min-h-[88px]" />;
              const key = format(day, 'yyyy-MM-dd');
              const dayBookings = bookingsByDay.get(key) || [];
              const inMonth = isSameMonth(day, currentDate);
              return (
                <button
                  key={key}
                  onClick={() => { setCurrentDate(day); setViewMode('day'); }}
                  className={`min-h-[88px] p-2 rounded-lg border text-left transition-all hover:border-primary/40 ${
                    isToday(day) ? 'border-primary bg-primary-container/10' : 'border-outline-variant/50 bg-surface-container-lowest/50'
                  } ${!inMonth ? 'opacity-40' : ''}`}
                >
                  <span className={`text-label-sm font-label-sm ${isToday(day) ? 'text-primary font-bold' : 'text-on-surface'}`}>
                    {format(day, 'd')}
                  </span>
                  {dayBookings.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {dayBookings.slice(0, 2).map((b) => (
                        <div key={b.id} className="text-[10px] truncate px-1 py-0.5 rounded" style={{ backgroundColor: `${b.service?.color || '#5950b6'}22`, color: b.service?.color }}>
                          {b.startTime} {b.customerName}
                        </div>
                      ))}
                      {dayBookings.length > 2 && (
                        <p className="text-[10px] text-on-surface-variant">+{dayBookings.length - 2} más</p>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <div className="min-w-[640px]">
            <div className="grid border-b border-outline-variant" style={{ gridTemplateColumns: `56px repeat(${viewMode === 'day' ? 1 : 7}, minmax(0, 1fr))` }}>
              <div className="border-r border-outline-variant" />
              {(viewMode === 'day' ? [currentDate] : weekDays).map((day) => (
                <div
                  key={day.toISOString()}
                  className={`py-3 text-center border-r border-outline-variant last:border-r-0 ${isToday(day) ? 'bg-primary-container/10' : ''}`}
                >
                  <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">{format(day, 'EEE', { locale: es })}</p>
                  <p className={`font-headline-md text-headline-md ${isToday(day) ? 'text-primary' : 'text-on-surface'}`}>{format(day, 'd')}</p>
                </div>
              ))}
            </div>
            <div className="grid relative" style={{ gridTemplateColumns: `56px repeat(${viewMode === 'day' ? 1 : 7}, minmax(0, 1fr))` }}>
              <div className="border-r border-outline-variant">
                {HOURS.map((h) => (
                  <div key={h} className="text-[10px] text-on-surface-variant pr-2 text-right border-b border-outline-variant/30" style={{ height: HOUR_HEIGHT }}>
                    {`${h.toString().padStart(2, '0')}:00`}
                  </div>
                ))}
              </div>
              {(viewMode === 'day' ? [currentDate] : weekDays).map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const dayBookings = bookingsByDay.get(key) || [];
                return (
                  <div key={key} className="relative border-r border-outline-variant last:border-r-0">
                    {HOURS.map((h) => (
                      <div key={h} className="border-b border-outline-variant/30" style={{ height: HOUR_HEIGHT }} />
                    ))}
                    {dayBookings.map((booking) => {
                      const startMin = parseTimeMinutes(booking.startTime);
                      const endMin = parseTimeMinutes(booking.endTime || booking.startTime);
                      const top = ((startMin - 8 * 60) / 60) * HOUR_HEIGHT;
                      const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 28);
                      if (top < 0 || top > HOURS.length * HOUR_HEIGHT) return null;
                      return (
                        <button
                          key={booking.id}
                          onClick={() => setSelectedBooking(booking)}
                          className={`absolute left-1 right-1 rounded-lg border px-2 py-1 text-left overflow-hidden shadow-sm hover:shadow-md transition-shadow z-10 ${statusClass(booking.status)}`}
                          style={{
                            top,
                            height,
                            borderLeftWidth: 3,
                            borderLeftColor: booking.service?.color || '#5950b6',
                          }}
                        >
                          <p className="text-[11px] font-bold truncate">{booking.customerName}</p>
                          <p className="text-[10px] truncate opacity-80">
                            {booking.service?.name}
                            {booking.staff ? ` · ${booking.staff.name}` : ''}
                          </p>
                          <p className="text-[10px] opacity-70">{booking.startTime}–{booking.endTime}</p>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedBooking && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSelectedBooking(null)}>
          <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-md p-lg border border-outline-variant" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-md">
              <div>
                <h4 className="font-headline-md text-on-surface">{selectedBooking.customerName}</h4>
                <p className="font-body-sm text-on-surface-variant">{selectedBooking.service?.name}</p>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="p-1 rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-2 mb-lg font-body-sm text-body-sm text-on-surface-variant">
              <p className="flex items-center gap-2"><span className="material-symbols-outlined text-base">calendar_today</span>{format(new Date(selectedBooking.date), "EEEE d MMM yyyy", { locale: es })}</p>
              <p className="flex items-center gap-2"><span className="material-symbols-outlined text-base">schedule</span>{selectedBooking.startTime} – {selectedBooking.endTime}</p>
              {selectedBooking.staff && (
                <p className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">badge</span>
                  {selectedBooking.staff.name}
                  {selectedBooking.staff.title ? ` · ${selectedBooking.staff.title}` : ''}
                </p>
              )}
              {selectedBooking.customerPhone && <p className="flex items-center gap-2"><span className="material-symbols-outlined text-base">call</span>{selectedBooking.customerPhone}</p>}
              <span className={`inline-block px-3 py-1 rounded-full font-label-sm ${statusClass(selectedBooking.status)}`}>
                {STATUS_LABELS[selectedBooking.status] || selectedBooking.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedBooking.status === 'PENDING' && (
                <button onClick={() => updateStatus(selectedBooking.id, 'CONFIRMED')} className="px-4 py-2 rounded-lg bg-secondary-container text-on-secondary-container font-label-sm font-bold">
                  Confirmar
                </button>
              )}
              {selectedBooking.status !== 'COMPLETED' && selectedBooking.status !== 'CANCELLED' && (
                <button onClick={() => updateStatus(selectedBooking.id, 'COMPLETED')} className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-sm font-bold">
                  Completar + Sello
                </button>
              )}
              {selectedBooking.status !== 'CANCELLED' && (
                <button onClick={() => updateStatus(selectedBooking.id, 'CANCELLED')} className="px-4 py-2 rounded-lg border border-error/30 text-error font-label-sm font-bold">
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <CreateBookingModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          loadBookings();
          onBookingUpdated?.();
        }}
        initialDate={currentDate}
        clientPlan={clientPlan}
      />
    </div>
  );
}
