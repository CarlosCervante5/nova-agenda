'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { createBooking, ClientInfo, LoyaltyProgram, MembershipPlan } from '@/lib/api';
import { applyServiceSchedule, emptySlotsMessage, hoursForService, isDateBookable, loadSlotsOrAdvance, nextOpenDate } from '@/lib/schedule';
import LoyaltySection from './LoyaltySection';
import MembershipsSection from './MembershipsSection';

type Tab = 'home' | 'booking' | 'loyalty' | 'memberships';

interface Props {
  client: ClientInfo;
  clientSlug: string;
  loyaltyProgram?: LoyaltyProgram | null;
  membershipPlans?: MembershipPlan[];
  membershipStatus?: 'success' | 'canceled' | null;
  membershipSessionId?: string | null;
  initialTab?: Tab;
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function WebsitePage({
  client,
  clientSlug,
  loyaltyProgram,
  membershipPlans = [],
  membershipStatus = null,
  membershipSessionId = null,
  initialTab = 'home',
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadSlots = useCallback(async () => {
    if (!selectedService) return;
    setLoadingSlots(true);
    try {
      const result = await loadSlotsOrAdvance({
        clientSlug,
        client,
        service: selectedService,
        selectedDate,
      });
      if (result.advanced) {
        setSelectedDate(result.date);
        setWeekStart(startOfWeek(result.date, { weekStartsOn: 1 }));
        setSelectedSlot(null);
      }
      setSlots(result.slots);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [clientSlug, client, selectedService, selectedDate]);

  useEffect(() => {
    if (step === 'datetime' && selectedService) {
      loadSlots();
    }
  }, [step, selectedService, selectedDate, loadSlots]);

  const hoursSource = hoursForService(client, selectedService);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dayOfWeek = date.getDay();
    return { date, dayOfWeek, isOpen: isDateBookable(date, hoursSource) };
  });
  const selectedDayOpen = isDateBookable(selectedDate, hoursSource);

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
    applyServiceSchedule(client, service, { setSelectedDate, setWeekStart, setSelectedSlot });
    const available = (client.staff || []).filter(
      (s) => !s.serviceIds.length || s.serviceIds.includes(service.id)
    );
    goToStep(available.length > 0 ? 'staff' : 'datetime');
    setActiveTab('booking');
  }

  function goToStep(newStep: typeof step) {
    setStep(newStep);
  }

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  const showMemberships = membershipPlans.length > 0 || Boolean(membershipStatus);
  const showTabs = Boolean(loyaltyProgram) || showMemberships;

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

  if (activeTab === 'loyalty' && loyaltyProgram) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav client={client} activeTab={activeTab} setActiveTab={setActiveTab} showTabs={showTabs} loyaltyProgram={loyaltyProgram} showMemberships={showMemberships} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} scrollToSection={scrollToSection} scrolled={scrolled} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <LoyaltySection clientId={client.id} clientName={client.name} primaryColor={client.primaryColor} program={loyaltyProgram} />
        </main>
        <SiteFooter client={client} />
      </div>
    );
  }

  if (activeTab === 'memberships') {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav client={client} activeTab={activeTab} setActiveTab={setActiveTab} showTabs={showTabs} loyaltyProgram={loyaltyProgram} showMemberships={showMemberships} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} scrollToSection={scrollToSection} scrolled={scrolled} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <MembershipsSection clientSlug={clientSlug} clientName={client.name} primaryColor={client.primaryColor} plans={membershipPlans} checkoutStatus={membershipStatus} sessionId={membershipSessionId} />
        </main>
        <SiteFooter client={client} />
      </div>
    );
  }

  if (activeTab === 'booking') {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav client={client} activeTab={activeTab} setActiveTab={setActiveTab} showTabs={showTabs} loyaltyProgram={loyaltyProgram} showMemberships={showMemberships} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} scrollToSection={scrollToSection} scrolled={scrolled} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <BookingFlow
            client={client} clientSlug={clientSlug} step={step} goToStep={goToStep}
            selectedService={selectedService} setSelectedService={setSelectedService}
            selectedStaff={selectedStaff} setSelectedStaff={setSelectedStaff}
            selectedDate={selectedDate} setSelectedDate={setSelectedDate}
            selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot}
            slots={slots} loadingSlots={loadingSlots} weekStart={weekStart} setWeekStart={setWeekStart}
            weekDays={weekDays} selectedDayOpen={selectedDayOpen} form={form} setForm={setForm}
            submitting={submitting} error={error} handleBooking={handleBooking}
            staffForService={staffForService} hasStaffStep={hasStaffStep}
            stepNames={stepNames} stepLabels={stepLabels} selectService={selectService}
            loyaltyProgram={loyaltyProgram} setActiveTab={setActiveTab}
          />
        </main>
        <SiteFooter client={client} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteNav client={client} activeTab={activeTab} setActiveTab={setActiveTab} showTabs={showTabs} loyaltyProgram={loyaltyProgram} showMemberships={showMemberships} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} scrollToSection={scrollToSection} scrolled={scrolled} />

      <section id="hero" className="relative overflow-hidden">
        {client.coverImage ? (
          <div className="absolute inset-0">
            <div className="w-full h-full bg-center bg-cover" style={{ backgroundImage: `url(${client.coverImage})` }} />
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${client.primaryColor}E6 0%, ${client.primaryColor}B3 50%, ${client.primaryColor}80 100%)` }} />
          </div>
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${client.primaryColor} 0%, ${client.primaryColor}CC 100%)` }} />
        )}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
          <div className="max-w-2xl">
            {client.logo && (
              <div className="mb-8">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/20 backdrop-blur-sm p-2">
                  <img src={client.logo} alt={client.name} className="w-full h-full object-contain" />
                </div>
              </div>
            )}
            <h1 className="font-headline-lg text-4xl sm:text-5xl lg:text-6xl text-white font-bold mb-4 leading-tight">
              {client.name}
            </h1>
            {client.tagline && (
              <p className="font-body-lg text-xl sm:text-2xl text-white/90 mb-6">{client.tagline}</p>
            )}
            {client.about && (
              <p className="font-body-md text-lg text-white/80 mb-8 max-w-xl leading-relaxed">
                {client.about.length > 200 ? `${client.about.slice(0, 200)}…` : client.about}
              </p>
            )}
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => scrollToSection('servicios')}
                className="px-8 py-4 bg-white text-on-primary rounded-xl font-label-lg text-label-lg font-bold shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
                style={{ color: client.primaryColor }}
              >
                Ver Servicios
              </button>
              <button
                onClick={() => scrollToSection('calendario')}
                className="px-8 py-4 bg-white/20 backdrop-blur-sm text-white border-2 border-white/40 rounded-xl font-label-lg text-label-lg font-bold hover:bg-white/30 transition-all"
              >
                Reservar Ahora
              </button>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </section>

      {(client.address || client.phone || client.email) && (
        <section className="py-8 border-b border-outline-variant">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap justify-center gap-6 sm:gap-10 font-body-sm text-on-surface-variant">
              {client.address && (
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">location_on</span>
                  {client.address}
                </span>
              )}
              {client.phone && (
                <a href={`tel:${client.phone}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-primary">call</span>
                  {client.phone}
                </a>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-primary">mail</span>
                  {client.email}
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      <section id="servicios" className="py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="font-headline-lg text-3xl sm:text-4xl text-on-surface mb-4">Nuestros Servicios</h2>
            <p className="font-body-md text-lg text-on-surface-variant max-w-2xl mx-auto">
              {client.bookingIntroText || 'Descubre nuestros servicios y reserva tu experiencia perfecta.'}
            </p>
          </div>
          <ServicesGrid client={client} onSelectService={selectService} />
        </div>
      </section>

      <section id="cta" className="py-16 sm:py-20" style={{ backgroundColor: client.primaryColor + '08' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-surface-container-lowest rounded-3xl p-8 sm:p-12 lg:p-16 shadow-xl border border-outline-variant">
            <span className="material-symbols-outlined text-5xl mb-6" style={{ color: client.primaryColor }}>calendar_month</span>
            <h2 className="font-headline-lg text-3xl sm:text-4xl text-on-surface mb-4">¿Listo para Reservar?</h2>
            <p className="font-body-md text-lg text-on-surface-variant mb-8 max-w-xl mx-auto">
              Agenda tu cita en solo unos clics. Selecciona tu servicio favorito y elige el horario que mejor se adapte a ti.
            </p>
            <button
              onClick={() => scrollToSection('calendario')}
              className="px-10 py-4 text-on-primary rounded-xl font-label-lg text-label-lg font-bold shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
              style={{ backgroundColor: client.primaryColor }}
            >
              Reservar Mi Cita
            </button>
          </div>
        </div>
      </section>

      <section id="calendario" className="py-16 sm:py-20 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-headline-lg text-3xl sm:text-4xl text-on-surface mb-4">Calendario de Disponibilidad</h2>
            <p className="font-body-md text-lg text-on-surface-variant">Consulta los días y horarios disponibles para tu visita.</p>
          </div>
          <PublicCalendar client={client} onSelectSlot={(service, date, slot) => {
            setSelectedService(service);
            setSelectedDate(date);
            setSelectedSlot(slot);
            setActiveTab('booking');
            goToStep('confirm');
          }} />
        </div>
      </section>

      <SiteFooter client={client} />
    </div>
  );
}

function SiteNav({
  client, activeTab, setActiveTab, showTabs, loyaltyProgram, showMemberships,
  mobileMenuOpen, setMobileMenuOpen, scrollToSection, scrolled,
}: {
  client: ClientInfo; activeTab: string; setActiveTab: (t: Tab) => void; showTabs: boolean;
  loyaltyProgram?: LoyaltyProgram | null; showMemberships: boolean;
  mobileMenuOpen: boolean; setMobileMenuOpen: (v: boolean) => void;
  scrollToSection: (id: string) => void; scrolled: boolean;
}) {
  const navigateToSection = (id: string) => {
    if (activeTab !== 'home') {
      setActiveTab('home');
      setTimeout(() => scrollToSection(id), 100);
    } else {
      scrollToSection(id);
    }
    setMobileMenuOpen(false);
  };

  const menuItems = [
    { id: 'hero', label: 'Inicio' },
    { id: 'servicios', label: 'Servicios' },
    { id: 'calendario', label: 'Calendario' },
  ];

  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${scrolled ? 'bg-surface/95 backdrop-blur-md shadow-md border-b border-outline-variant' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <button onClick={() => navigateToSection('hero')} className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-on-primary overflow-hidden shrink-0 shadow-md" style={{ backgroundColor: client.primaryColor }}>
              {client.logo ? (
                <img src={client.logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-xl">spa</span>
              )}
            </div>
            <div className="min-w-0 hidden sm:block">
              <span className="font-headline-md text-on-surface block truncate text-lg">{client.name}</span>
              {client.tagline && (
                <span className="font-body-sm text-on-surface-variant block truncate text-xs">{client.tagline}</span>
              )}
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigateToSection(item.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all"
              >
                {item.label}
              </button>
            ))}
            {showTabs && (
              <>
                {loyaltyProgram && (
                  <button onClick={() => setActiveTab('loyalty')} className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">loyalty</span> Fidelidad
                  </button>
                )}
                {showMemberships && (
                  <button onClick={() => setActiveTab('memberships')} className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">card_membership</span> Membresías
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => navigateToSection('calendario')}
              className="ml-2 px-5 py-2.5 text-on-primary rounded-lg font-label-md text-label-md font-bold shadow-md hover:shadow-lg hover:opacity-90 transition-all"
              style={{ backgroundColor: client.primaryColor }}
            >
              Reservar
            </button>
          </nav>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-surface-container-low transition-colors">
            <span className="material-symbols-outlined text-on-surface">{mobileMenuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-surface-container-lowest border-t border-outline-variant shadow-lg">
          <div className="px-4 py-4 space-y-1">
            {menuItems.map((item) => (
              <button key={item.id} onClick={() => navigateToSection(item.id)} className="block w-full text-left px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container-low font-medium transition-colors">
                {item.label}
              </button>
            ))}
            {loyaltyProgram && (
              <button onClick={() => { setActiveTab('loyalty'); setMobileMenuOpen(false); }} className="block w-full text-left px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container-low font-medium transition-colors">
                Fidelidad
              </button>
            )}
            {showMemberships && (
              <button onClick={() => { setActiveTab('memberships'); setMobileMenuOpen(false); }} className="block w-full text-left px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container-low font-medium transition-colors">
                Membresías
              </button>
            )}
            <button
              onClick={() => navigateToSection('calendario')}
              className="block w-full text-center px-4 py-3 text-on-primary rounded-lg font-bold mt-2"
              style={{ backgroundColor: client.primaryColor }}
            >
              Reservar Ahora
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function ServicesGrid({ client, onSelectService }: { client: ClientInfo; onSelectService: (s: ClientInfo['services'][0]) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 320;
    scrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const renderServiceCard = (service: ClientInfo['services'][0]) => (
    <button
      key={service.id}
      onClick={() => onSelectService(service)}
      className="group relative p-6 rounded-2xl border border-outline-variant bg-surface-container-lowest hover:border-primary-container hover:shadow-xl transition-all duration-300 cursor-pointer text-left min-w-[280px] max-w-[320px] shrink-0 snap-start"
    >
      <div className="flex justify-between items-start mb-4">
        <span className="p-3 rounded-xl" style={{ backgroundColor: service.color + '20', color: service.color }}>
          <span className="material-symbols-outlined text-2xl">spa</span>
        </span>
        <span className="text-lg font-headline-md text-on-surface font-bold">{service.price ? `$${service.price}` : 'Gratis'}</span>
      </div>
      <h3 className="font-headline-md text-on-surface text-lg mb-2">{service.name}</h3>
      {service.description && <p className="text-sm text-on-surface-variant line-clamp-2 mb-4 leading-relaxed">{service.description}</p>}
      <div className="flex items-center gap-4 text-sm font-medium text-on-surface-variant mt-4 pt-4 border-t border-outline-variant">
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base">schedule</span> {service.duration} min
        </span>
        <span className="flex items-center gap-1.5 group-hover:text-primary transition-colors ml-auto">
          Reservar <span className="material-symbols-outlined text-base">arrow_forward</span>
        </span>
      </div>
    </button>
  );

  const categories = client.categories || [];

  const buildServices = () => {
    if (categories.length === 0) {
      return [{ title: '', color: client.primaryColor, services: client.services }];
    }
    const usedIds = new Set<string>();
    const sections: { title: string; color: string; services: ClientInfo['services'] }[] = [];
    for (const cat of categories) {
      for (const child of cat.children || []) {
        const childServices = client.services.filter((s) => s.categoryId === child.id);
        childServices.forEach((s) => usedIds.add(s.id));
        if (childServices.length > 0) {
          sections.push({ title: `${cat.name} › ${child.name}`, color: child.color || cat.color, services: childServices });
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
    return sections;
  };

  const sections = buildServices();
  const allServices = sections.flatMap((s) => s.services);

  return (
    <div className="space-y-12">
      {sections.map((section) => (
        <div key={section.title || 'all'}>
          {section.title && (
            <h3 className="font-headline-md text-on-surface mb-6 flex items-center gap-3 text-xl">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: section.color }} />
              {section.title}
            </h3>
          )}
          <div className="relative group/carousel">
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 -ml-4 z-10 w-10 h-10 rounded-full bg-surface-container-lowest shadow-lg border border-outline-variant flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-on-surface">chevron_left</span>
            </button>
            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory hide-scrollbar pb-4"
            >
              {section.services.map(renderServiceCard)}
            </div>
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 -mr-4 z-10 w-10 h-10 rounded-full bg-surface-container-lowest shadow-lg border border-outline-variant flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-on-surface">chevron_right</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PublicCalendar({
  client, onSelectSlot,
}: {
  client: ClientInfo;
  onSelectSlot: (service: ClientInfo['services'][0], date: Date, slot: string) => void;
}) {
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const selectedService = client.services.find((s) => s.id === selectedServiceId) || null;
  const hoursSource = hoursForService(client, selectedService);
  const selectedDayOpen = isDateBookable(selectedDate, hoursSource);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dayOfWeek = date.getDay();
    return { date, dayOfWeek, isOpen: isDateBookable(date, hoursSource) };
  });

  useEffect(() => {
    if (!selectedService) return;
    const next = nextOpenDate(hoursForService(client, selectedService));
    setSelectedDate(next);
    setWeekStart(startOfWeek(next, { weekStartsOn: 1 }));
  }, [selectedServiceId]);

  useEffect(() => {
    if (!selectedService) return;
    let cancelled = false;
    setLoading(true);
    loadSlotsOrAdvance({
      clientSlug: client.slug,
      client,
      service: selectedService,
      selectedDate,
    })
      .then((result) => {
        if (cancelled) return;
        if (result.advanced) {
          setSelectedDate(result.date);
          setWeekStart(startOfWeek(result.date, { weekStartsOn: 1 }));
        }
        setSlots(result.slots);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedService, selectedDate, client]);

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 sm:p-8 shadow-lg">
      <div className="mb-6">
        <label className="font-label-md text-on-surface mb-2 block">Selecciona un servicio</label>
        <select
          value={selectedServiceId}
          onChange={(e) => setSelectedServiceId(e.target.value)}
          className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-xl font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        >
          <option value="">— Elige un servicio —</option>
          {client.services.map((s) => (
            <option key={s.id} value={s.id}>{s.name} — {s.duration} min {s.price ? `$${s.price}` : 'Gratis'}</option>
          ))}
        </select>
      </div>

      {selectedService && (
        <>
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <span className="font-label-md text-on-surface">
              {format(weekStart, 'MMM d')} — {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-6">
            {weekDays.map(({ date, isOpen }) => {
              const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
              const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
              return (
                <button key={date.toISOString()} disabled={!isOpen}
                  onClick={() => { setSelectedDate(date); }}
                  className={`p-2 sm:p-3 rounded-xl text-center transition-all ${
                    isSelected ? 'text-on-primary shadow-lg' :
                    isOpen ? 'bg-surface-container-low hover:bg-surface-container border border-outline-variant' :
                    'bg-surface-container-highest text-on-surface-variant/40 cursor-not-allowed'
                  }`}
                  style={isSelected ? { backgroundColor: client.primaryColor } : {}}>
                  <p className="text-[10px] sm:text-xs text-on-surface-variant uppercase">{DAY_NAMES[date.getDay()]}</p>
                  <p className="text-base sm:text-lg font-headline-md mt-0.5">{date.getDate()}</p>
                </button>
              );
            })}
          </div>

          <h4 className="font-headline-sm text-on-surface mb-3">Horarios Disponibles</h4>
          {loading ? (
            <div className="flex items-center gap-3 text-on-surface-variant py-4">
              <div className="animate-spin h-5 w-5 border-2 border-primary-container border-t-primary rounded-full" />
              <span className="font-body-sm">Cargando horarios...</span>
            </div>
          ) : slots.length === 0 ? (
            <p className="font-body-sm text-on-surface-variant py-4">{emptySlotsMessage(selectedDayOpen, selectedDate)}</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot}
                  onClick={() => onSelectSlot(selectedService, selectedDate, slot)}
                  className="py-3 px-2 rounded-lg text-sm font-label-md border border-outline-variant hover:border-primary-container hover:bg-primary-container/10 transition-all"
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BookingFlow({
  client, clientSlug, step, goToStep, selectedService, setSelectedService,
  selectedStaff, setSelectedStaff, selectedDate, setSelectedDate,
  selectedSlot, setSelectedSlot, slots, loadingSlots, weekStart, setWeekStart,
  weekDays, selectedDayOpen, form, setForm, submitting, error, handleBooking,
  staffForService, hasStaffStep, stepNames, stepLabels, selectService,
  loyaltyProgram, setActiveTab,
}: {
  client: ClientInfo; clientSlug: string; step: string; goToStep: (s: any) => void;
  selectedService: any; setSelectedService: (s: any) => void;
  selectedStaff: any; setSelectedStaff: (s: any) => void;
  selectedDate: Date; setSelectedDate: (d: Date) => void;
  selectedSlot: string | null; setSelectedSlot: (s: string | null) => void;
  slots: string[]; loadingSlots: boolean; weekStart: Date; setWeekStart: (d: Date) => void;
  weekDays: { date: Date; dayOfWeek: number; isOpen: boolean }[];
  selectedDayOpen: boolean;
  form: { customerName: string; customerEmail: string; customerPhone: string; notes: string };
  setForm: (f: any) => void; submitting: boolean; error: string; handleBooking: () => void;
  staffForService: any[]; hasStaffStep: boolean; stepNames: string[]; stepLabels: string[];
  selectService: (s: any) => void; loyaltyProgram?: LoyaltyProgram | null; setActiveTab: (t: any) => void;
}) {
  return (
    <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8">
      <div className="lg:col-span-8 space-y-8">
        <nav className="flex items-center justify-between mb-8 overflow-x-auto pb-4 hide-scrollbar">
          <div className="flex items-center gap-4 flex-shrink-0">
            {stepLabels.map((label: string, i: number) => {
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
            <h1 className="font-headline-lg text-on-surface mb-2">Selecciona tu Servicio</h1>
            <p className="font-body-md text-on-surface-variant mb-lg">
              Elige el servicio que deseas reservar.
            </p>
            <ServicesGrid client={client} onSelectService={selectService} />
          </section>
        )}

        {step === 'staff' && selectedService && (
          <section>
            <h1 className="font-headline-lg text-on-surface mb-2">¿Quién te atiende?</h1>
            <p className="font-body-md text-on-surface-variant mb-lg">Elige a la persona para tu cita de {selectedService.name}.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {staffForService.map((member: any) => (
                <button key={member.id} onClick={() => { setSelectedStaff(member); goToStep('datetime'); }}
                  className="p-6 rounded-xl border border-outline-variant bg-surface-container-lowest hover:border-primary-container hover:shadow-lg transition-all text-left">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white overflow-hidden shrink-0" style={{ backgroundColor: member.color }}>
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-bold text-lg">{member.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-headline-md text-on-surface">{member.name}</h3>
                      {member.title && <p className="text-sm text-on-surface-variant">{member.title}</p>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="pt-lg">
              <button onClick={() => { setSelectedService(null); setSelectedStaff(null); goToStep('service'); }}
                className="text-on-surface-variant hover:text-primary font-label-md flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span> Volver a servicios
              </button>
            </div>
          </section>
        )}

        {step === 'datetime' && (
          <section>
            <h1 className="font-headline-lg text-on-surface mb-2">Elige Fecha y Hora</h1>
            <p className="font-body-md text-on-surface-variant mb-lg">Selecciona tu franja horaria preferida.</p>
            <div className="flex items-center justify-between mb-lg">
              <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="font-label-md text-on-surface">
                {format(weekStart, 'MMM d')} — {format(addDays(weekStart, 6), 'MMM d, yyyy')}
              </span>
              <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-2 mb-xl">
              {weekDays.map(({ date, isOpen }) => {
                const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
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
            <h3 className="font-headline-md text-on-surface mb-md">Horarios Disponibles</h3>
            {loadingSlots ? (
              <div className="flex items-center gap-3 text-on-surface-variant">
                <div className="animate-spin h-5 w-5 border-2 border-primary-container border-t-primary rounded-full" />
                <span className="font-body-sm">Cargando horarios...</span>
              </div>
            ) : slots.length === 0 ? (
              <p className="font-body-sm text-on-surface-variant">{emptySlotsMessage(selectedDayOpen, selectedDate)}</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {slots.map((slot: string) => (
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
            <div className="pt-lg">
              <button onClick={() => { setSelectedSlot(null); goToStep(hasStaffStep ? 'staff' : 'service'); }}
                className="text-on-surface-variant hover:text-primary font-label-md flex items-center gap-1 transition-colors">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                {hasStaffStep ? 'Volver a personal' : 'Volver a servicios'}
              </button>
            </div>
          </section>
        )}

        {step === 'confirm' && (
          <section>
            <h1 className="font-headline-lg text-on-surface mb-2">Confirma Tu Reserva</h1>
            <p className="font-body-md text-on-surface-variant mb-lg">Revisa los detalles y completa tu cita.</p>
            <div className="bg-surface-container-low rounded-2xl p-lg border border-outline-variant mb-xl">
              <div className="flex gap-4 items-center mb-lg">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-on-primary" style={{ backgroundColor: selectedService?.color || client.primaryColor }}>
                  <span className="material-symbols-outlined text-2xl">spa</span>
                </div>
                <div className="flex-1">
                  <p className="font-headline-md text-on-surface">{selectedService?.name}</p>
                  <p className="font-body-sm text-on-surface-variant">{selectedService?.duration} minutos</p>
                </div>
                <p className="font-headline-md text-on-surface">{selectedService?.price ? `$${selectedService.price}` : 'Gratis'}</p>
              </div>
              <div className="pt-lg border-t border-outline-variant flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">calendar_today</span> {format(selectedDate, "d 'de' MMMM, yyyy")}</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">schedule</span> {selectedSlot}</span>
                {selectedStaff && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">badge</span> {selectedStaff.name}</span>}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-error-container text-on-error-container rounded-lg flex items-center gap-3 mb-lg">
                <span className="material-symbols-outlined">error</span>
                <p className="font-body-sm">{error}</p>
              </div>
            )}

            <div className="space-y-lg">
              <div>
                <label className="font-label-md text-on-surface mb-xs block">Nombre Completo *</label>
                <input placeholder="Ingresa tu nombre completo" value={form.customerName} onChange={(e: any) => setForm({ ...form, customerName: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" required />
              </div>
              <div>
                <label className="font-label-md text-on-surface mb-xs block">Correo Electrónico{client.bookingRequireEmail ? ' *' : ''}</label>
                <input type="email" placeholder="tu@correo.com" value={form.customerEmail} onChange={(e: any) => setForm({ ...form, customerEmail: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" required={!!client.bookingRequireEmail} />
              </div>
              <div>
                <label className="font-label-md text-on-surface mb-xs block">Teléfono{client.bookingRequirePhone ? ' *' : ''}</label>
                <input type="tel" placeholder="+1 (555) 000-0000" value={form.customerPhone} onChange={(e: any) => setForm({ ...form, customerPhone: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" required={!!client.bookingRequirePhone} />
              </div>
              {client.bookingShowNotes !== false && (
                <div>
                  <label className="font-label-md text-on-surface mb-xs block">Notas</label>
                  <textarea placeholder="Algún requerimiento especial..." value={form.notes} onChange={(e: any) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" rows={3} />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-xl">
              <button onClick={() => goToStep('datetime')} className="px-lg py-3 border border-outline-variant text-on-surface rounded-lg font-label-md hover:bg-surface-container-low transition-all">Volver</button>
              <button onClick={handleBooking} disabled={!form.customerName || submitting || (!!client.bookingRequirePhone && !form.customerPhone.trim()) || (!!client.bookingRequireEmail && !form.customerEmail.trim())}
                className="flex-1 py-3 text-on-primary rounded-xl font-semibold shadow-lg disabled:opacity-50 transition-all active:scale-[0.98]"
                style={{ backgroundColor: client.primaryColor }}>
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-on-primary border-t-transparent rounded-full" /> Reservando...
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
            <p className="font-body-sm leading-relaxed text-on-primary-fixed-variant">
              Cancela gratis hasta 24 horas antes de tu cita.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SiteFooter({ client }: { client: ClientInfo }) {
  return (
    <footer className="bg-surface-container-lowest border-t border-outline-variant py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden" style={{ backgroundColor: client.primaryColor + '30', color: client.primaryColor }}>
              {client.logo ? (
                <img src={client.logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-sm">spa</span>
              )}
            </div>
            <div>
              <span className="font-headline-md text-on-surface text-lg block">{client.name}</span>
              {client.address && <span className="font-body-sm text-on-surface-variant text-xs">{client.address}</span>}
            </div>
          </div>
          <div className="flex gap-4 text-sm font-medium text-on-surface-variant">
            {client.instagram && (
              <a className="hover:text-primary transition-colors" href={client.instagram.startsWith('http') ? client.instagram : `https://instagram.com/${client.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer">Instagram</a>
            )}
            {client.facebook && (
              <a className="hover:text-primary transition-colors" href={client.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>
            )}
            {client.whatsappPhone && (
              <a className="hover:text-primary transition-colors" href={`https://wa.me/${client.whatsappPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            )}
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-outline-variant text-center text-xs text-on-surface-variant">
          Powered by <span className="font-medium" style={{ color: client.primaryColor }}>Nova Agenda</span>
        </div>
      </div>
    </footer>
  );
}
