'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { getAvailableSlots, createBooking, ClientInfo, LoyaltyProgram } from '@/lib/api';
import LoyaltySection from './LoyaltySection';

interface Props {
  client: ClientInfo;
  clientSlug: string;
  loyaltyProgram?: LoyaltyProgram | null;
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function BookingPage({ client, clientSlug, loyaltyProgram }: Props) {
  const [activeTab, setActiveTab] = useState<'booking' | 'loyalty'>('booking');
  const [step, setStep] = useState<'service' | 'staff' | 'datetime' | 'confirm' | 'success'>('service');
  const [selectedService, setSelectedService] = useState<ClientInfo['services'][0] | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<NonNullable<ClientInfo['staff']>[0] | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [form, setForm] = useState({ customerName: '', customerEmail: '', customerPhone: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadSlots = useCallback(async () => {
    if (!selectedService) return;
    setLoadingSlots(true);
    try {
      const data = await getAvailableSlots(clientSlug, selectedService.id, format(selectedDate, 'yyyy-MM-dd'));
      setSlots(data.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [clientSlug, selectedService, selectedDate]);

  useEffect(() => {
    if (step === 'datetime' && selectedService) {
      loadSlots();
    }
  }, [step, selectedService, selectedDate, loadSlots]);

  const goToStep = (newStep: typeof step) => {
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
        staffId: selectedStaff?.id,
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

  const staffForService = (client.staff || []).filter(
    (s) => !s.serviceIds.length || (selectedService && s.serviceIds.includes(selectedService.id))
  );
  const hasStaffStep = staffForService.length > 0;

  const stepNames: Array<'service' | 'staff' | 'datetime' | 'confirm'> = hasStaffStep
    ? ['service', 'staff', 'datetime', 'confirm']
    : ['service', 'datetime', 'confirm'];
  const stepLabels = hasStaffStep
    ? ['Servicio', 'Personal', 'Hora', 'Detalles']
    : ['Servicio', 'Hora', 'Detalles'];

  function selectService(service: ClientInfo['services'][0]) {
    setSelectedService(service);
    setSelectedStaff(null);
    setSelectedSlot(null);
    const available = (client.staff || []).filter(
      (s) => !s.serviceIds.length || s.serviceIds.includes(service.id)
    );
    goToStep(available.length > 0 ? 'staff' : 'datetime');
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center p-xl bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant max-w-md">
          <div className="w-16 h-16 bg-secondary-container rounded-full flex items-center justify-center mx-auto mb-lg">
            <span className="material-symbols-outlined text-3xl text-on-secondary-container">check_circle</span>
          </div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-sm">¡Reserva Confirmada!</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
            {client.bookingSuccessText || (
              <>
                Tu cita de <strong>{selectedService?.name}</strong>
                {selectedStaff ? <> con <strong>{selectedStaff.name}</strong></> : null}
                {' '}el <strong>{format(selectedDate, "d 'de' MMMM, yyyy")}</strong> a las <strong>{selectedSlot}</strong> ha sido reservada.
              </>
            )}
          </p>

          {loyaltyProgram && (
            <div
              className="mb-xl p-4 rounded-xl border text-left flex items-start gap-3"
              style={{ backgroundColor: (loyaltyProgram.stampColor || client.primaryColor) + '15', borderColor: (loyaltyProgram.stampColor || client.primaryColor) + '40' }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-on-primary"
                style={{ backgroundColor: loyaltyProgram.stampColor || client.primaryColor }}
              >
                <span className="material-symbols-outlined">{loyaltyProgram.stampIcon}</span>
              </div>
              <div>
                <p className="font-medium text-on-surface text-sm mb-1">¡Gana un sello de fidelidad!</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Cuando completes tu visita, recibirás un sello en <strong>{loyaltyProgram.name}</strong>.
                  {form.customerPhone ? ' Consulta tu tarjeta con tu teléfono.' : ' Usa tu teléfono para consultar tu tarjeta.'}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {loyaltyProgram && (
              <button
                onClick={() => { setActiveTab('loyalty'); setStep('service'); setSelectedService(null); setSelectedSlot(null); }}
                className="w-full px-lg py-3 text-on-primary rounded-lg font-label-md text-label-md font-bold shadow-lg hover:opacity-90 transition-all"
                style={{ backgroundColor: client.primaryColor }}
              >
                Ver Programa de Fidelidad
              </button>
            )}
            <button onClick={() => { setStep('service'); setSelectedService(null); setSelectedSlot(null); setForm({ customerName: '', customerEmail: '', customerPhone: '', notes: '' }); }}
              className="px-lg py-3 border border-primary text-primary rounded-lg font-label-md text-label-md font-bold hover:bg-primary/5 transition-all">
              Reservar Otra Cita
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {client.coverImage && step === 'service' && activeTab === 'booking' && (
        <div
          className="w-full h-40 sm:h-52 bg-center bg-cover"
          style={{ backgroundImage: `url(${client.coverImage})` }}
        />
      )}

      <header className="sticky top-0 z-40 w-full border-b border-outline-variant bg-surface/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-on-primary overflow-hidden shrink-0" style={{ backgroundColor: client.primaryColor }}>
              {client.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={client.logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-lg">spa</span>
              )}
            </div>
            <div className="min-w-0">
              <span className="font-headline-md text-on-surface block truncate">{client.name}</span>
              {client.tagline && (
                <span className="font-body-sm text-on-surface-variant block truncate text-xs">{client.tagline}</span>
              )}
            </div>
          </div>
          {loyaltyProgram && (
            <nav className="flex items-center gap-1 bg-surface-container-low rounded-lg p-1">
              <button
                onClick={() => setActiveTab('booking')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'booking'
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Reservar
              </button>
              <button
                onClick={() => setActiveTab('loyalty')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'loyalty'
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">loyalty</span>
                Fidelidad
              </button>
            </nav>
          )}
        </div>
      </header>

      {activeTab === 'loyalty' && loyaltyProgram ? (
        <>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <LoyaltySection
            clientId={client.id}
            clientName={client.name}
            primaryColor={client.primaryColor}
            program={loyaltyProgram}
          />
        </main>
        <footer className="mt-12 bg-surface-container-lowest border-t border-outline-variant py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: client.primaryColor + '30', color: client.primaryColor }}>
                <span className="material-symbols-outlined text-sm">spa</span>
              </div>
              <span className="font-headline-md text-on-surface text-lg">{client.name}</span>
            </div>
          </div>
        </footer>
        </>
      ) : (
      <>
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
                      {i < stepLabels.length - 1 && <div className="w-12 h-px bg-outline-variant" />}
                    </div>
                  );
                })}
              </div>
            </nav>

            {step === 'service' && (
              <section>
                <h1 className="font-headline-lg text-on-surface mb-2">
                  {client.tagline || 'Reserva Tu Experiencia'}
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
                  {client.bookingIntroText ||
                    (client.about
                      ? client.about.length > 180
                        ? `${client.about.slice(0, 180)}…`
                        : client.about
                      : 'Selecciona un servicio para comenzar tu reserva.')}
                </p>
                {(client.address || client.phone || client.email) && (
                  <div className="flex flex-wrap gap-4 mb-lg font-body-sm text-on-surface-variant">
                    {client.address && (
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">location_on</span>
                        {client.address}
                      </span>
                    )}
                    {client.phone && (
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">call</span>
                        {client.phone}
                      </span>
                    )}
                    {client.email && (
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">mail</span>
                        {client.email}
                      </span>
                    )}
                  </div>
                )}

                {(() => {
                  const renderServiceCard = (service: ClientInfo['services'][0]) => (
                    <button
                      key={service.id}
                      onClick={() => selectService(service)}
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
                  );

                  const categories = client.categories || [];
                  if (categories.length === 0) {
                    return (
                      <div className="grid sm:grid-cols-2 gap-4">
                        {client.services.map(renderServiceCard)}
                      </div>
                    );
                  }

                  const usedIds = new Set<string>();
                  const sections: { title: string; color: string; services: ClientInfo['services'] }[] = [];

                  for (const cat of categories) {
                    for (const child of cat.children || []) {
                      const childServices = client.services.filter((s) => s.categoryId === child.id);
                      childServices.forEach((s) => usedIds.add(s.id));
                      if (childServices.length > 0) {
                        sections.push({
                          title: `${cat.name} › ${child.name}`,
                          color: child.color || cat.color,
                          services: childServices,
                        });
                      }
                    }
                    const onParent = client.services.filter((s) => s.categoryId === cat.id);
                    onParent.forEach((s) => usedIds.add(s.id));
                    if (onParent.length > 0) {
                      sections.push({ title: cat.name, color: cat.color, services: onParent });
                    }
                  }

                  const uncategorized = client.services.filter((s) => !usedIds.has(s.id));
                  if (uncategorized.length > 0) {
                    sections.push({ title: 'Otros servicios', color: client.primaryColor, services: uncategorized });
                  }

                  return (
                    <div className="space-y-xl">
                      {sections.map((section) => (
                        <div key={section.title}>
                          <h2 className="font-headline-md text-on-surface mb-md flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: section.color }} />
                            {section.title}
                          </h2>
                          <div className="grid sm:grid-cols-2 gap-4">
                            {section.services.map(renderServiceCard)}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </section>
            )}

            {step === 'staff' && selectedService && (
              <section>
                <h1 className="font-headline-lg text-on-surface mb-2">¿Quién te atiende?</h1>
                <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
                  Elige a la persona para tu cita de {selectedService.name}.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {staffForService.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => {
                        setSelectedStaff(member);
                        goToStep('datetime');
                      }}
                      className="p-6 rounded-xl border border-outline-variant bg-surface-container-lowest hover:border-primary-container hover:shadow-lg transition-all text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-white overflow-hidden shrink-0"
                          style={{ backgroundColor: member.color }}
                        >
                          {member.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-lg">{member.name.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <h3 className="font-headline-md text-on-surface">{member.name}</h3>
                          {member.title && (
                            <p className="text-sm text-on-surface-variant">{member.title}</p>
                          )}
                          {member.bio && (
                            <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{member.bio}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="pt-lg flex justify-start">
                  <button
                    onClick={() => {
                      setSelectedService(null);
                      setSelectedStaff(null);
                      setStep('service');
                    }}
                    className="text-on-surface-variant hover:text-primary font-label-md flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span> Volver a servicios
                  </button>
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
                  <button
                    onClick={() => {
                      setSelectedSlot(null);
                      setStep(hasStaffStep ? 'staff' : 'service');
                    }}
                    className="text-on-surface-variant hover:text-primary font-label-md text-label-md flex items-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    {hasStaffStep ? 'Volver a personal' : 'Volver a servicios'}
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
                  <div className="pt-lg border-t border-outline-variant flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">calendar_today</span> {format(selectedDate, "d 'de' MMMM, yyyy")}</span>
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">schedule</span> {selectedSlot}</span>
                    {selectedStaff && (
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">badge</span> {selectedStaff.name}
                      </span>
                    )}
                  </div>
                </div>

                {loyaltyProgram && (
                  <div
                    className="mb-xl p-4 rounded-xl border flex items-start gap-3"
                    style={{ backgroundColor: (loyaltyProgram.stampColor || client.primaryColor) + '12', borderColor: (loyaltyProgram.stampColor || client.primaryColor) + '35' }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-on-primary"
                      style={{ backgroundColor: loyaltyProgram.stampColor || client.primaryColor }}
                    >
                      <span className="material-symbols-outlined">{loyaltyProgram.stampIcon}</span>
                    </div>
                    <div>
                      <p className="font-medium text-on-surface text-sm mb-1">
                        Sello de fidelidad al completar tu visita
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Al asistir a tu cita, recibirás un sello en <strong>{loyaltyProgram.name}</strong>.
                        Necesitas <strong>{loyaltyProgram.stampsToReward} sellos</strong> para desbloquear recompensas.
                        {!form.customerPhone && ' Agrega tu teléfono para vincular tu tarjeta.'}
                      </p>
                    </div>
                  </div>
                )}

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
                    <label className="font-label-md text-label-md text-on-surface mb-xs block">
                      Correo Electrónico{client.bookingRequireEmail ? ' *' : ''}
                    </label>
                    <input type="email" placeholder="tu@correo.com" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      required={!!client.bookingRequireEmail} />
                  </div>
                  <div>
                    <label className="font-label-md text-label-md text-on-surface mb-xs block">
                      Teléfono{client.bookingRequirePhone ? ' *' : ''}
                    </label>
                    <input type="tel" placeholder="+1 (555) 000-0000" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      required={!!client.bookingRequirePhone} />
                  </div>
                  {client.bookingShowNotes !== false && (
                    <div>
                      <label className="font-label-md text-label-md text-on-surface mb-xs block">Notas</label>
                      <textarea placeholder="Algún requerimiento especial o nota..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" rows={3} />
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-xl">
                  <button onClick={() => setStep('datetime')} className="px-lg py-3 border border-outline-variant text-on-surface rounded-lg font-label-md text-label-md hover:bg-surface-container-low transition-all">
                    Volver
                  </button>
                  <button
                    onClick={handleBooking}
                    disabled={
                      !form.customerName ||
                      submitting ||
                      (!!client.bookingRequirePhone && !form.customerPhone.trim()) ||
                      (!!client.bookingRequireEmail && !form.customerEmail.trim())
                    }
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

              {loyaltyProgram && (
                <button
                  onClick={() => setActiveTab('loyalty')}
                  className="w-full rounded-2xl p-lg border border-outline-variant bg-surface-container-lowest text-left hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-on-primary"
                      style={{ backgroundColor: loyaltyProgram.stampColor || client.primaryColor }}
                    >
                      <span className="material-symbols-outlined">{loyaltyProgram.stampIcon}</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-on-surface">{loyaltyProgram.name}</h3>
                      <p className="text-xs text-on-surface-variant">Programa de fidelidad</p>
                    </div>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Acumula sellos con cada visita y desbloquea recompensas.
                  </p>
                </button>
              )}
            </div>
          </aside>
        </div>
      </main>

      <footer className="mt-12 bg-surface-container-lowest border-t border-outline-variant py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center overflow-hidden" style={{ backgroundColor: client.primaryColor + '30', color: client.primaryColor }}>
              {client.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={client.logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-sm">spa</span>
              )}
            </div>
            <div>
              <span className="font-headline-md text-on-surface text-lg block">{client.name}</span>
              {client.address && (
                <span className="font-body-sm text-on-surface-variant text-xs">{client.address}</span>
              )}
            </div>
          </div>
          <div className="flex gap-4 text-sm font-medium text-on-surface-variant">
            {client.instagram && (
              <a
                className="hover:text-primary transition-colors"
                href={client.instagram.startsWith('http') ? client.instagram : `https://instagram.com/${client.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
              </a>
            )}
            {client.facebook && (
              <a className="hover:text-primary transition-colors" href={client.facebook} target="_blank" rel="noopener noreferrer">
                Facebook
              </a>
            )}
            {client.whatsappPhone && (
              <a
                className="hover:text-primary transition-colors"
                href={`https://wa.me/${client.whatsappPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            )}
            {client.phone && !client.whatsappPhone && (
              <a className="hover:text-primary transition-colors" href={`tel:${client.phone}`}>
                Contacto
              </a>
            )}
          </div>
        </div>
      </footer>
      </>
      )}
    </div>
  );
}
