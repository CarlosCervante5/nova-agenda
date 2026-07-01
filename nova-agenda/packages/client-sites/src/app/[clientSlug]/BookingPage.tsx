'use client';

import { useState } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { getAvailableSlots, createBooking, ClientInfo } from '@/lib/api';

interface Props {
  client: ClientInfo;
  clientSlug: string;
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function BookingPage({ client, clientSlug }: Props) {
  const [step, setStep] = useState<'service' | 'datetime' | 'confirm' | 'success'>('service');
  const [selectedService, setSelectedService] = useState<ClientInfo['services'][0] | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [form, setForm] = useState({ customerName: '', customerEmail: '', customerPhone: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadSlots = async () => {
    if (!selectedService) return;
    setLoadingSlots(true);
    try {
      const data = await getAvailableSlots(clientSlug, selectedService.id, format(selectedDate, 'yyyy-MM-dd'));
      setSlots(data.slots || []);
    } catch { setSlots([]); }
    setLoadingSlots(false);
  };

  const goToStep = (newStep: typeof step) => {
    if (newStep === 'datetime') {
      loadSlots();
    }
    setStep(newStep);
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dayOfWeek = date.getDay();
    const hours = client.workingHours.find((wh) => wh.dayOfWeek === dayOfWeek);
    return { date, dayOfWeek, isOpen: hours?.isOpen ?? false };
  });

  async function handleBooking() {
    if (!selectedService || !selectedSlot) return;
    setSubmitting(true);
    setError('');
    try {
      await createBooking({
        clientSlug,
        serviceId: selectedService.id,
        customerName: form.customerName,
        customerEmail: form.customerEmail || undefined,
        customerPhone: form.customerPhone || undefined,
        date: format(selectedDate, 'yyyy-MM-dd'),
        startTime: selectedSlot,
        notes: form.notes || undefined,
      });
      setStep('success');
    } catch (err: any) { setError(err.message); }
    setSubmitting(false);
  }

  const stepNames = ['service', 'datetime', 'confirm'] as const;
  const stepLabels = ['Servicio', 'Hora', 'Detalles'];

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center p-xl bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant max-w-md">
          <div className="w-16 h-16 bg-secondary-container rounded-full flex items-center justify-center mx-auto mb-lg">
            <span className="material-symbols-outlined text-3xl text-on-secondary-container">check_circle</span>
          </div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-sm">¡Reserva Confirmada!</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-xl">
            Tu cita de <strong>{selectedService?.name}</strong> el{' '}
            <strong>{format(selectedDate, "d 'de' MMMM, yyyy")}</strong> a las <strong>{selectedSlot}</strong> ha sido reservada.
          </p>
          <button onClick={() => { setStep('service'); setSelectedService(null); setSelectedSlot(null); setForm({ customerName: '', customerEmail: '', customerPhone: '', notes: '' }); }}
            className="px-lg py-3 border border-primary text-primary rounded-lg font-label-md text-label-md font-bold hover:bg-primary/5 transition-all">
            Reservar Otra Cita
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-outline-variant bg-surface/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-on-primary" style={{ backgroundColor: client.primaryColor }}>
              <span className="material-symbols-outlined text-lg">spa</span>
            </div>
            <span className="font-headline-md text-on-surface">{client.name}</span>
          </div>
          <button className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">help_outline</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <nav className="flex items-center justify-between mb-8 overflow-x-auto pb-4 hide-scrollbar">
              <div className="flex items-center gap-4 flex-shrink-0">
                {stepLabels.map((label, i) => {
                  const stepKey = stepNames[i];
                  const isActive = step === stepKey;
                  const isPast = stepNames.indexOf(step) > i;
                  return (
                    <div key={label} className="flex items-center gap-4">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          isActive ? 'text-on-primary' : isPast ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-highest text-on-surface'
                        }`} style={isActive ? { backgroundColor: client.primaryColor } : {}}>
                          {isPast ? <span className="material-symbols-outlined text-sm">check</span> : i + 1}
                        </span>
                        <span className={`text-xs font-medium ${isActive ? 'text-primary' : isPast ? 'text-secondary' : 'text-on-surface-variant'}`}>{label}</span>
                      </div>
                      {i < 2 && <div className="w-12 h-px bg-outline-variant" />}
                    </div>
                  );
                })}
              </div>
            </nav>

            {step === 'service' && (
              <section>
                <h1 className="font-headline-lg text-on-surface mb-2">Reserva Tu Experiencia</h1>
                <p className="font-body-md text-body-md text-on-surface-variant mb-lg">Selecciona un servicio para comenzar tu reserva.</p>

                <div className="grid sm:grid-cols-2 gap-4">
                  {client.services.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => { setSelectedService(service); goToStep('datetime'); }}
                      className="group relative p-6 rounded-xl border border-outline-variant bg-surface-container-lowest hover:border-primary-container hover:shadow-lg transition-all cursor-pointer text-left"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <span className="p-2 rounded-lg" style={{ backgroundColor: service.color + '20', color: service.color }}>
                          <span className="material-symbols-outlined">spa</span>
                        </span>
                        <span className="text-sm font-label-md text-on-surface-variant">{service.price ? `$${service.price}` : 'Gratis'}</span>
                      </div>
                      <h3 className="font-headline-md text-on-surface mb-1">{service.name}</h3>
                      {service.description && <p className="text-sm text-on-surface-variant line-clamp-2 mb-4">{service.description}</p>}
                      <div className="flex items-center gap-4 text-xs font-medium text-on-surface-variant mt-4">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">schedule</span> {service.duration} min
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {step === 'datetime' && (
              <section>
                <h1 className="font-headline-lg text-on-surface mb-2">Elige Fecha y Hora</h1>
                <p className="font-body-md text-body-md text-on-surface-variant mb-lg">Selecciona tu franja horaria preferida.</p>

                <div className="flex items-center justify-between mb-lg">
                  <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <span className="font-label-md text-label-md text-on-surface">
                    {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                  </span>
                  <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-xl">
                  {weekDays.map(({ date, isOpen }) => {
                    const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                    const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    return (
                      <button key={date.toISOString()} disabled={!isOpen}
                        onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                        className={`p-3 rounded-xl text-center transition-all ${
                          isSelected ? 'text-on-primary shadow-lg' :
                          isOpen ? 'bg-surface-container-lowest hover:bg-surface-container border border-outline-variant' :
                          'bg-surface-container-highest text-on-surface-variant/40 cursor-not-allowed'
                        }`}
                        style={isSelected ? { backgroundColor: client.primaryColor } : {}}>
                        <p className="text-xs text-on-surface-variant uppercase">{DAY_NAMES[date.getDay()]}</p>
                        <p className="text-lg font-headline-md mt-1">{date.getDate()}</p>
                      </button>
                    );
                  })}
                </div>

                <h3 className="font-headline-md text-headline-md text-on-surface mb-md">Horarios Disponibles</h3>
                {loadingSlots ? (
                  <div className="flex items-center gap-3 text-on-surface-variant">
                    <div className="animate-spin h-5 w-5 border-2 border-primary-container border-t-primary rounded-full" />
                    <span className="font-body-sm text-body-sm">Cargando horarios disponibles...</span>
                  </div>
                ) : slots.length === 0 ? (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">No hay horarios disponibles para esta fecha</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {slots.map((slot) => (
                      <button key={slot} onClick={() => { setSelectedSlot(slot); goToStep('confirm'); }}
                        className={`py-3 px-2 rounded-lg text-sm font-label-md border transition-all ${
                          selectedSlot === slot ? 'text-on-primary border-transparent shadow-md' :
                          'bg-surface-container-lowest border-outline-variant hover:border-primary-container'
                        }`}
                        style={selectedSlot === slot ? { backgroundColor: client.primaryColor } : {}}>
                        {slot}
                      </button>
                    ))}
                  </div>
                )}

                <div className="pt-lg flex justify-start">
                  <button onClick={() => setStep('service')} className="text-on-surface-variant hover:text-primary font-label-md text-label-md flex items-center gap-1 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span> Volver a servicios
                  </button>
                </div>
              </section>
            )}

            {step === 'confirm' && (
              <section>
                <h1 className="font-headline-lg text-on-surface mb-2">Confirma Tu Reserva</h1>
                <p className="font-body-md text-body-md text-on-surface-variant mb-lg">Revisa los detalles de tu reserva y completa tu cita.</p>

                <div className="bg-surface-container-low rounded-2xl p-lg border border-outline-variant mb-xl">
                  <div className="flex gap-4 items-center mb-lg">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-on-primary" style={{ backgroundColor: selectedService?.color || client.primaryColor }}>
                      <span className="material-symbols-outlined text-2xl">spa</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-headline-md text-on-surface">{selectedService?.name}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">{selectedService?.duration} minutos</p>
                    </div>
                    <p className="font-headline-md text-on-surface">{selectedService?.price ? `$${selectedService.price}` : 'Gratis'}</p>
                  </div>
                  <div className="pt-lg border-t border-outline-variant flex items-center gap-4 text-sm text-on-surface-variant">
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">calendar_today</span> {format(selectedDate, "d 'de' MMMM, yyyy")}</span>
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">schedule</span> {selectedSlot}</span>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-error-container text-on-error-container rounded-lg flex items-center gap-3 mb-lg">
                    <span className="material-symbols-outlined">error</span>
                    <p className="font-body-sm text-body-sm">{error}</p>
                  </div>
                )}

                <div className="space-y-lg">
                  <div>
                    <label className="font-label-md text-label-md text-on-surface mb-xs block">Nombre Completo *</label>
                    <input placeholder="Ingresa tu nombre completo" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" required />
                  </div>
                  <div>
                    <label className="font-label-md text-label-md text-on-surface mb-xs block">Correo Electrónico</label>
                    <input type="email" placeholder="tu@correo.com" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="font-label-md text-label-md text-on-surface mb-xs block">Teléfono</label>
                    <input type="tel" placeholder="+1 (555) 000-0000" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="font-label-md text-label-md text-on-surface mb-xs block">Notas</label>
                    <textarea placeholder="Algún requerimiento especial o nota..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" rows={3} />
                  </div>
                </div>

                <div className="flex gap-3 mt-xl">
                  <button onClick={() => setStep('datetime')} className="px-lg py-3 border border-outline-variant text-on-surface rounded-lg font-label-md text-label-md hover:bg-surface-container-low transition-all">
                    Volver
                  </button>
                  <button onClick={handleBooking} disabled={!form.customerName || submitting}
                    className="flex-1 py-3 text-on-primary rounded-xl font-semibold shadow-lg disabled:opacity-50 transition-all active:scale-[0.98]"
                    style={{ backgroundColor: client.primaryColor }}>
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-on-primary border-t-transparent rounded-full" />
                        Reservando...
                      </span>
                    ) : 'Confirmar Reserva'}
                  </button>
                </div>
              </section>
            )}
          </div>

          <aside className="lg:col-span-4">
            <div className="sticky top-24 space-y-6">
              {selectedService && (
                <div className="bg-surface-container-low rounded-2xl p-lg border border-outline-variant">
                  <h2 className="font-headline-md text-on-surface mb-lg">Resumen de Reserva</h2>
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center text-on-primary" style={{ backgroundColor: selectedService.color }}>
                      <span className="material-symbols-outlined">spa</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-on-surface">{selectedService.name}</p>
                      <p className="text-xs text-on-surface-variant">{selectedService.duration} minutos</p>
                    </div>
                    <p className="font-medium text-on-surface">{selectedService.price ? `$${selectedService.price}` : 'Gratis'}</p>
                  </div>
                  {selectedDate && selectedSlot && (
                    <div className="mt-lg pt-lg border-t border-outline-variant space-y-2">
                      <div className="flex justify-between text-sm text-on-surface-variant">
                        <span>Fecha</span><span>{format(selectedDate, "d 'de' MMM")}</span>
                      </div>
                      <div className="flex justify-between text-sm text-on-surface-variant">
                        <span>Hora</span><span>{selectedSlot}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl p-lg border border-primary-container" style={{ backgroundColor: client.primaryColor + '10' }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="material-symbols-outlined text-on-primary-container">info</span>
                  <h3 className="font-medium text-on-primary-container">Cancelación Flexible</h3>
                </div>
                <p className="font-body-sm text-body-sm leading-relaxed text-on-primary-fixed-variant">
                  ¿Necesitas cambiar? Cancela gratis hasta 24 horas antes de tu cita.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="mt-12 bg-surface-container-lowest border-t border-outline-variant py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: client.primaryColor + '30', color: client.primaryColor }}>
              <span className="material-symbols-outlined text-sm">spa</span>
            </div>
            <span className="font-headline-md text-on-surface text-lg">{client.name}</span>
          </div>
          <div className="flex gap-8 text-sm font-medium text-on-surface-variant">
            <a className="hover:text-primary transition-colors" href="#">Política de Privacidad</a>
            <a className="hover:text-primary transition-colors" href="#">Términos de Servicio</a>
            <a className="hover:text-primary transition-colors" href="#">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
