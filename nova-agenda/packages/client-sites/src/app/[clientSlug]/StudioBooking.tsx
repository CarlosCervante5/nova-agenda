'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  bookStudioClass,
  cancelStudioClass,
  confirmStudioClass,
  createMembershipCheckout,
  getStudioAccount,
  getStudioDay,
  joinStudioWaitlist,
  rescheduleStudioClass,
  ClientInfo,
  MembershipPlan,
  StudioAccount,
  StudioClass,
} from '@/lib/api';
import StudioPolicies from './StudioPolicies';

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const SESSION_KEY = (slug: string) => `studio-session-${slug}`;
const PENDING_KEY = (slug: string) => `studio-pending-class-${slug}`;

type SessionForm = { customerName: string; customerEmail: string; customerPhone: string };

function money(price: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price);
}

function classDays(services: ClientInfo['services'], month: Date) {
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const marked = new Set<string>();
  for (const day of days) {
    const dow = day.getDay();
    const has = services.some((service) =>
      service.kind !== 'access' &&
      !/clase de prueba|clase suelta/i.test(service.name) &&
      (service.kind === 'class' || service.useCustomHours) &&
      service.workingHours?.some((h) => h.dayOfWeek === dow && h.isOpen)
    );
    if (has) marked.add(format(day, 'yyyy-MM-dd'));
  }
  return marked;
}

export default function StudioBooking({
  client,
  clientSlug,
  plans,
  classStatus,
  classSessionId,
}: {
  client: ClientInfo;
  clientSlug: string;
  plans: MembershipPlan[];
  classStatus?: 'success' | 'canceled' | null;
  classSessionId?: string | null;
}) {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [classes, setClasses] = useState<StudioClass[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const [selected, setSelected] = useState<StudioClass | null>(null);
  const [form, setForm] = useState<SessionForm>({ customerName: '', customerEmail: '', customerPhone: '' });
  const [account, setAccount] = useState<StudioAccount | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);

  const markedDays = useMemo(
    () => classDays(client.services.filter((s) => s.kind !== 'access'), month),
    [client.services, month]
  );

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY(clientSlug));
      if (raw) setForm(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [clientSlug]);

  useEffect(() => {
    if (classStatus === 'success' && classSessionId) {
      confirmStudioClass(clientSlug, classSessionId)
        .then(() => setSuccess('Pago confirmado. Tu lugar ya está reservado.'))
        .catch(() => setSuccess('Estamos confirmando tu pago. Si ya se cobró, tu lugar quedará en unos segundos.'));
    }
    if (classStatus === 'canceled') setError('El pago se canceló. Puedes intentar de nuevo o pagar en recepción.');
  }, [classStatus, classSessionId, clientSlug]);

  useEffect(() => {
    let cancelled = false;
    setLoadingDay(true);
    getStudioDay(clientSlug, selectedDate)
      .then((data) => {
        if (!cancelled) setClasses(data.classes);
      })
      .catch(() => {
        if (!cancelled) setClasses([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingDay(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientSlug, selectedDate]);

  useEffect(() => {
    if (!form.customerPhone && !form.customerEmail) return;
    const t = setTimeout(() => {
      getStudioAccount(clientSlug, { phone: form.customerPhone, email: form.customerEmail })
        .then(setAccount)
        .catch(() => setAccount(null));
    }, 400);
    return () => clearTimeout(t);
  }, [clientSlug, form.customerPhone, form.customerEmail]);

  function persistForm(next: SessionForm) {
    setForm(next);
    localStorage.setItem(SESSION_KEY(clientSlug), JSON.stringify(next));
  }

  async function handleBook(method: 'CREDIT' | 'RECEPTION' | 'STRIPE' | 'TRIAL') {
    if (!selected) return;
    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      setError('Nombre y teléfono son obligatorios.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const result = await bookStudioClass(clientSlug, {
        serviceId: selected.serviceId,
        date: selectedDate,
        startTime: selected.startTime,
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim() || undefined,
        customerPhone: form.customerPhone.trim(),
        method,
        promoCode: method === 'TRIAL' ? promoCode : undefined,
        returnUrl: window.location.origin + window.location.pathname,
      });
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setSuccess(
        method === 'CREDIT'
          ? `Listo. Usamos 1 crédito para ${selected.name}.`
          : `Lugar reservado. Paga en recepción de ${client.name}.`
      );
      setSelected(null);
      const refreshed = await getStudioDay(clientSlug, selectedDate);
      setClasses(refreshed.classes);
      const acc = await getStudioAccount(clientSlug, { phone: form.customerPhone, email: form.customerEmail });
      setAccount(acc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reservar');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMembership(plan: MembershipPlan) {
    if (!form.customerName.trim() || !form.customerEmail.trim()) {
      setError('Para la membresía necesitamos nombre y correo.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (selected) {
        sessionStorage.setItem(PENDING_KEY(clientSlug), JSON.stringify({
          serviceId: selected.serviceId,
          date: selectedDate,
          startTime: selected.startTime,
        }));
      }
      const { url } = await createMembershipCheckout({
        clientSlug,
        planId: plan.id,
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim(),
        customerPhone: form.customerPhone.trim() || undefined,
        returnUrl: window.location.origin + window.location.pathname,
      });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el pago');
      setSubmitting(false);
    }
  }

  async function handleWaitlist() {
    if (!selected) return;
    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      setError('Nombre y teléfono son obligatorios para la lista de espera.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await joinStudioWaitlist(clientSlug, {
        serviceId: selected.serviceId,
        date: selectedDate,
        startTime: selected.startTime,
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim() || undefined,
        customerPhone: form.customerPhone.trim(),
      });
      setSuccess('Te anotamos en lista de espera. Si se libera un lugar y tienes crédito, entras sola.');
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo anotar');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(bookingId: string) {
    if (!confirm('¿Cancelar esta clase?')) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await cancelStudioClass(clientSlug, {
        bookingId,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail,
      });
      setSuccess(result.message);
      const acc = await getStudioAccount(clientSlug, { phone: form.customerPhone, email: form.customerEmail });
      setAccount(acc);
      const refreshed = await getStudioDay(clientSlug, selectedDate);
      setClasses(refreshed.classes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReschedule() {
    if (!selected || !rescheduleId) return;
    setSubmitting(true);
    setError('');
    try {
      await rescheduleStudioClass(clientSlug, {
        bookingId: rescheduleId,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail,
        serviceId: selected.serviceId,
        date: selectedDate,
        startTime: selected.startTime,
      });
      setSuccess('Cambiamos tu horario.');
      setRescheduleId(null);
      setSelected(null);
      const acc = await getStudioAccount(clientSlug, { phone: form.customerPhone, email: form.customerEmail });
      setAccount(acc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedDateLabel = format(new Date(selectedDate + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es });

  return (
    <div className="space-y-10">
      <div className="text-center">
        <h2 className="font-headline-lg text-3xl sm:text-4xl text-on-surface mb-3">Reservar mi clase</h2>
        <p className="font-body-md text-on-surface-variant max-w-2xl mx-auto">
          Elige un día, revisa las clases y confirma tu lugar con membresía, clase suelta o pago en recepción.
        </p>
      </div>

      <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label className="font-label-md text-on-surface mb-1 block">Tu sesión</label>
            <p className="font-body-sm text-on-surface-variant mb-3">
              Con tu teléfono vemos tus créditos y reservas.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              <input
                placeholder="Nombre"
                value={form.customerName}
                onChange={(e) => persistForm({ ...form, customerName: e.target.value })}
                className="px-4 py-3 bg-surface-bright border border-outline-variant rounded-xl outline-none focus:border-primary"
              />
              <input
                type="tel"
                placeholder="Teléfono"
                value={form.customerPhone}
                onChange={(e) => persistForm({ ...form, customerPhone: e.target.value })}
                className="px-4 py-3 bg-surface-bright border border-outline-variant rounded-xl outline-none focus:border-primary"
              />
              <input
                type="email"
                placeholder="Correo"
                value={form.customerEmail}
                onChange={(e) => persistForm({ ...form, customerEmail: e.target.value })}
                className="px-4 py-3 bg-surface-bright border border-outline-variant rounded-xl outline-none focus:border-primary"
              />
            </div>
          </div>
          {account && (account.creditsTotal > 0 || account.bookings.length > 0) && (
            <div className="rounded-xl px-4 py-3 min-w-[200px]" style={{ backgroundColor: client.primaryColor + '18' }}>
              <p className="text-xs text-on-surface-variant">{account.planName || 'Créditos'}</p>
              <p className="font-headline-md text-on-surface">{account.creditsLeft} de {account.creditsTotal}</p>
            </div>
          )}
        </div>
        {account && account.bookings.length > 0 && (
          <div className="mt-4 space-y-2">
            {account.bookings.map((booking) => (
              <div key={booking.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant px-4 py-3">
                <div>
                  <p className="font-label-md text-on-surface">{booking.serviceName}</p>
                  <p className="text-xs text-on-surface-variant">
                    {booking.date} · {booking.startTime}
                    {booking.paymentStatus === 'PENDING_RECEPTION' ? ' · Pago en recepción' : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {booking.canReschedule && (
                    <button
                      type="button"
                      onClick={() => { setRescheduleId(booking.id); setSuccess('Elige otra clase del calendario para moverte.'); }}
                      className="px-3 py-1.5 text-xs rounded-lg border border-outline-variant"
                    >
                      Cambiar
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleCancel(booking.id)}
                    className="px-3 py-1.5 text-xs rounded-lg text-error"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && (
        <div className="p-4 bg-error-container text-on-error-container rounded-xl">{error}</div>
      )}
      {success && (
        <div className="p-4 rounded-xl border border-secondary-container bg-secondary-container/20 text-on-surface">{success}</div>
      )}

      <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setMonth(addMonths(month, -1))} className="p-2 rounded-full hover:bg-surface-container-high">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <h3 className="font-headline-md text-on-surface capitalize">{format(month, 'MMMM yyyy', { locale: es })}</h3>
          <button onClick={() => setMonth(addMonths(month, 1))} className="p-2 rounded-full hover:bg-surface-container-high">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[10px] sm:text-xs font-label-md text-on-surface-variant py-1">{d}</div>
          ))}
          {calendarDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const inMonth = isSameMonth(day, month);
            const hasClass = markedDays.has(key);
            const isSelected = key === selectedDate;
            const isPast = key < format(today, 'yyyy-MM-dd');
            return (
              <button
                key={key}
                disabled={!inMonth || !hasClass || isPast}
                onClick={() => { setSelectedDate(key); setSelected(null); }}
                className={`aspect-square rounded-xl text-sm transition-all ${
                  isSelected ? 'text-on-primary shadow-md' :
                  !inMonth ? 'text-on-surface-variant/20' :
                  isPast || !hasClass ? 'text-on-surface-variant/35 cursor-not-allowed' :
                  'bg-surface-container-low hover:bg-surface-container border border-outline-variant'
                }`}
                style={isSelected ? { backgroundColor: client.primaryColor } : undefined}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="font-headline-md text-on-surface mb-4 capitalize">{selectedDateLabel}</h3>
        {loadingDay ? (
          <p className="font-body-sm text-on-surface-variant">Cargando clases…</p>
        ) : classes.length === 0 ? (
          <p className="font-body-sm text-on-surface-variant">No hay clases este día.</p>
        ) : (
          <div className="space-y-3">
            {classes.map((item) => (
              <div key={`${item.serviceId}-${item.startTime}`} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-on-primary shrink-0" style={{ backgroundColor: item.color }}>
                  <span className="material-symbols-outlined">self_improvement</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-headline-md text-on-surface">{item.name}</p>
                  <p className="text-sm text-on-surface-variant">
                    {item.startTime} · {item.duration} min
                    {item.category ? ` · ${item.category.name}` : ''}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    {item.full ? 'Llena' : `${item.remaining} lugares`} · {item.capacity} cupos
                  </p>
                </div>
                {item.past ? (
                  <span className="text-sm text-on-surface-variant">Ya pasó</span>
                ) : item.full ? (
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className="px-4 py-2 rounded-xl border border-outline-variant font-label-md"
                  >
                    Lista de espera
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setSelected(item); setError(''); }}
                    className="px-5 py-2.5 rounded-xl text-on-primary font-bold shadow-md"
                    style={{ backgroundColor: client.primaryColor }}
                  >
                    {rescheduleId ? 'Mover aquí' : 'Reservar'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-outline-variant shadow-xl my-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-headline-md text-on-surface">{selected.name}</h3>
                <p className="font-body-sm text-on-surface-variant">
                  {selectedDateLabel} · {selected.startTime} · {selected.duration} min
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {selected.description && (
              <p className="font-body-sm text-on-surface-variant mb-4">{selected.description}</p>
            )}
            {error && <div className="p-3 mb-4 rounded-lg bg-error-container text-on-error-container text-sm">{error}</div>}

            {rescheduleId ? (
              <button
                type="button"
                disabled={submitting || selected.full}
                onClick={handleReschedule}
                className="w-full py-3 rounded-xl text-on-primary font-bold mb-4"
                style={{ backgroundColor: client.primaryColor }}
              >
                Confirmar cambio de horario
              </button>
            ) : selected.full ? (
              <button
                type="button"
                disabled={submitting}
                onClick={handleWaitlist}
                className="w-full py-3 rounded-xl text-on-primary font-bold mb-4"
                style={{ backgroundColor: client.primaryColor }}
              >
                Anotarme en lista de espera
              </button>
            ) : (
              <>
                {account && account.creditsLeft > 0 && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleBook('CREDIT')}
                    className="w-full py-3 rounded-xl text-on-primary font-bold mb-4"
                    style={{ backgroundColor: client.primaryColor }}
                  >
                    Reservar con 1 crédito ({account.creditsLeft} disponibles)
                  </button>
                )}

                <p className="font-label-md text-on-surface mb-2">Membresías</p>
                <div className="space-y-2 mb-5">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => handleMembership(plan)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-outline-variant hover:border-primary text-left"
                    >
                      <div>
                        <p className="font-label-md text-on-surface">{plan.name}</p>
                        <p className="text-xs text-on-surface-variant">
                          {plan.classesPerPeriod ? `${plan.classesPerPeriod} clases / mes` : plan.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-label-md">{money(plan.price)}</span>
                        <span className="material-symbols-outlined" style={{ color: client.primaryColor }}>shopping_cart</span>
                      </div>
                    </button>
                  ))}
                </div>

                <p className="font-label-md text-on-surface mb-2">Clase suelta</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleBook('STRIPE')}
                    className="py-3 rounded-xl border border-outline-variant font-label-md"
                  >
                    Pagar {money(selected.price)}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleBook('RECEPTION')}
                    className="py-3 rounded-xl border border-outline-variant font-label-md"
                  >
                    Pagar en recepción
                  </button>
                </div>

                {!account?.trialUsed && (
                  <div className="mb-4">
                    <p className="font-label-md text-on-surface mb-2">Primera visita · $90</p>
                    <div className="flex gap-2">
                      <input
                        placeholder="Código"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        className="flex-1 px-4 py-3 bg-surface-bright border border-outline-variant rounded-xl outline-none"
                      />
                      <button
                        type="button"
                        disabled={submitting || !promoCode}
                        onClick={() => handleBook('TRIAL')}
                        className="px-4 py-3 rounded-xl text-on-primary font-bold"
                        style={{ backgroundColor: client.primaryColor }}
                      >
                        Usar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <StudioPolicies primaryColor={client.primaryColor} />
          </div>
        </div>
      )}
    </div>
  );
}
