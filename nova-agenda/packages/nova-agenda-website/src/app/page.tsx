'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-on-background overflow-x-hidden">
      {/* TopNavBar */}
      <header className="bg-surface sticky top-0 z-50 border-b border-outline-variant shadow-sm flex justify-between items-center w-full px-4 md:px-16 h-14 md:h-16">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-on-primary shadow-sm shadow-primary/20">
              <span className="material-symbols-outlined">spa</span>
            </div>
            <span className="font-headline-md text-headline-md font-bold text-primary">Nova Agenda</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#features">Características</a>
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#pricing">Precios</a>
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#testimonials">Testimonios</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="hidden sm:block font-label-md text-label-md text-primary hover:underline px-4 py-2 transition-all active:scale-95">Iniciar Sesión</Link>
          <button className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-label-md text-label-md font-bold shadow-sm hover:opacity-90 transition-all active:scale-95">Comenzar Gratis</button>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative py-12 lg:py-20 overflow-hidden">
          <div className="container mx-auto px-4 md:px-16 relative z-10 grid lg:grid-cols-2 gap-xl items-center">
            <div className="max-w-2xl">
              <span className="inline-block py-1 px-3 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-sm text-label-sm mb-md uppercase tracking-wider">El Futuro del Bienestar</span>
              <h1 className="font-headline-xl text-headline-xl text-on-background mb-lg leading-tight">
                Impulsa tu <span className="text-primary">negocio de belleza</span> con inteligencia.
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-xl">
                La plataforma todo-en-uno diseñada para salones y clínicas premium. Gestiona citas, clientes y crecimiento con elegancia sin esfuerzo.
              </p>
              <div className="flex flex-col sm:flex-row gap-md">
                <button className="bg-primary text-on-primary px-8 py-4 rounded-lg font-label-md text-label-md font-bold shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                  Prueba Gratis
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
                <button className="bg-white border border-outline text-on-surface px-8 py-4 rounded-lg font-label-md text-label-md font-bold hover:bg-surface-container-low transition-all active:scale-95 flex items-center justify-center gap-2">
                  Ver Demo
                  <span className="material-symbols-outlined">play_circle</span>
                </button>
              </div>
              <div className="mt-xl flex items-center gap-4 opacity-70">
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-primary-container" />
                  ))}
                </div>
                <p className="font-body-sm text-body-sm">Más de 5,000 clínicas de belleza premium confían en nosotros</p>
              </div>
            </div>
            <div className="hidden lg:block relative">
              <div className="glass-card p-4 rounded-xl shadow-2xl relative z-20 overflow-hidden">
                <Image src="/mockups/dashboard-preview.svg" alt="Vista previa del dashboard" width={600} height={400} className="rounded-lg shadow-inner border border-outline-variant" />
              </div>
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-primary opacity-10 rounded-full blur-3xl" />
              <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-secondary-fixed opacity-15 rounded-full blur-3xl" />
            </div>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section className="py-xl bg-surface-container-low" id="features">
          <div className="container mx-auto px-4 md:px-16">
            <div className="text-center max-w-3xl mx-auto mb-xl">
              <h2 className="font-headline-lg text-headline-lg text-on-background mb-md">Todo lo que necesitas para crecer</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">Deja de usar múltiples herramientas. Nova Agenda unifica todo tu negocio de belleza en un solo flujo de trabajo elegante.</p>
            </div>
            <div className="grid md:grid-cols-12 gap-lg">
              {/* Smart Agenda */}
              <div className="md:col-span-8 bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant bento-hover flex flex-col justify-between min-h-[400px]">
                <div>
                  <div className="w-12 h-12 bg-primary-fixed text-primary rounded-lg flex items-center justify-center mb-md">
                    <span className="material-symbols-outlined text-2xl">calendar_month</span>
                  </div>
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">Agenda Inteligente</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-lg">Programación automatizada que entiende tu ritmo. Reduce inasistencias con recordatorios impulsados por IA y gestión de lista de espera.</p>
                </div>
                <div className="rounded-lg overflow-hidden border border-outline-variant">
                  <Image src="/mockups/calendar-preview.svg" alt="Vista previa del calendario" width={600} height={300} className="w-full h-64 object-cover" />
                </div>
              </div>
              {/* CRM Integration */}
              <div className="md:col-span-4 bg-primary-container text-on-primary-container p-lg rounded-xl shadow-sm bento-hover flex flex-col">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-md">
                  <span className="material-symbols-outlined text-2xl text-on-primary">group</span>
                </div>
                <h3 className="font-headline-md text-headline-md mb-sm text-on-primary-container">Integración CRM</h3>
                <p className="font-body-md text-body-md text-on-primary-container/80 mb-xl">Conoce a tus clientes mejor que nunca. Rastrea historial, preferencias y programas de lealtad automatizados en un solo lugar.</p>
                <div className="mt-auto bg-white/10 p-4 rounded-lg border border-white/20">
                  <Image src="/mockups/crm-preview.svg" alt="Vista previa del CRM" width={300} height={150} className="w-full rounded" />
                </div>
              </div>
              {/* Web Builder */}
              <div className="md:col-span-4 bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant bento-hover">
                <div className="w-12 h-12 bg-secondary-container text-on-secondary-container rounded-lg flex items-center justify-center mb-md">
                  <span className="material-symbols-outlined text-2xl">language</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">Constructor Web</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">Crea un sitio de reservas impresionante que refleje tu marca en minutos. Sin necesidad de programar.</p>
              </div>
              {/* Analytics */}
              <div className="md:col-span-4 bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant bento-hover">
                <div className="w-12 h-12 bg-primary-fixed text-primary rounded-lg flex items-center justify-center mb-md">
                  <span className="material-symbols-outlined text-2xl">trending_up</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">Informes de Crecimiento</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">Reportes en tiempo real sobre ingresos, rendimiento del personal y rotación de inventario para mejores decisiones.</p>
              </div>
              {/* Marketing Tools */}
              <div className="md:col-span-4 bg-secondary-container text-on-secondary-container p-lg rounded-xl shadow-sm bento-hover">
                <div className="w-12 h-12 bg-white/40 rounded-lg flex items-center justify-center mb-md">
                  <span className="material-symbols-outlined text-2xl text-secondary">campaign</span>
                </div>
                <h3 className="font-headline-md text-headline-md mb-sm text-on-secondary-container">Marketing Inteligente</h3>
                <p className="font-body-md text-body-md text-on-secondary-container/80 mb-xl">Campañas automatizadas por email y SMS que mantienen tus sillas llenas y tus clientes regresando.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Mockup Gallery */}
        <section className="py-xl">
          <div className="container mx-auto px-4 md:px-16">
            <div className="text-center max-w-3xl mx-auto mb-xl">
              <h2 className="font-headline-lg text-headline-lg text-on-background mb-md">Diseñado para impresionar</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">Interfaces elegantes que tus clientes amarán usar para reservar citas.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-lg">
              <div className="glass-card rounded-xl overflow-hidden shadow-sm bento-hover">
                <Image src="/mockups/calendar-preview.svg" alt="Calendario de citas" width={600} height={400} className="w-full" />
                <div className="p-lg">
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">Calendario Visual</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Vista semanal con citas color-coded, disponibilidad del personal y indicadores de tiempo en tiempo real.</p>
                </div>
              </div>
              <div className="glass-card rounded-xl overflow-hidden shadow-sm bento-hover">
                <Image src="/mockups/booking-preview.svg" alt="Página de reservas" width={600} height={400} className="w-full" />
                <div className="p-lg">
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">Reservas en Línea</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Flujo de reservas de 3 pasos con selección de servicio, calendario y formulario de confirmación.</p>
                </div>
              </div>
              <div className="glass-card rounded-xl overflow-hidden shadow-sm bento-hover">
                <Image src="/mockups/form-builder-preview.svg" alt="Constructor de formularios" width={600} height={400} className="w-full" />
                <div className="p-lg">
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">Constructor de Formularios</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Crea formularios de intake personalizados con drag-and-drop para tus clientes.</p>
                </div>
              </div>
              <div className="glass-card rounded-xl overflow-hidden shadow-sm bento-hover">
                <Image src="/mockups/crm-preview.svg" alt="CRM de clientes" width={600} height={400} className="w-full" />
                <div className="p-lg">
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">CRM Integrado</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Gestiona el perfil completo de cada cliente, historial de citas y preferencias.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-xl bg-surface-container-low" id="pricing">
          <div className="container mx-auto px-4 md:px-16">
            <div className="text-center max-w-3xl mx-auto mb-xl">
              <h2 className="font-headline-lg text-headline-lg text-on-background mb-md">Planes para cada escala</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">Elige el plan perfecto para tu negocio. Precios transparentes, sin costos ocultos.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-lg max-w-6xl mx-auto">
              {/* Freemium */}
              <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant flex flex-col transition-all hover:border-primary">
                <span className="font-label-md text-label-md text-on-surface-variant mb-md uppercase tracking-widest">Gratuito</span>
                <div className="mb-lg">
                  <span className="font-headline-xl text-headline-xl text-on-background">$0</span>
                  <span className="text-on-surface-variant">/siempre</span>
                </div>
                <ul className="space-y-4 mb-xl flex-grow">
                  {['Agenda de Citas Inteligente', 'Hasta 3 servicios', 'Hasta 50 citas/mes', 'Gestión básica de clientes'].map(f => (
                    <li key={f} className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                      <span className="font-body-sm text-body-sm">{f}</span>
                    </li>
                  ))}
                </ul>
                <button className="w-full py-3 rounded-lg border border-outline text-primary font-label-md text-label-md font-bold hover:bg-surface-container-low transition-all">Comenzar Gratis</button>
              </div>
              {/* Professional (Featured) */}
              <div className="bg-primary-container p-xl rounded-xl border-2 border-primary flex flex-col relative scale-105 z-10 shadow-xl">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-on-primary px-4 py-1 rounded-full font-label-sm text-label-sm uppercase font-bold">Más Popular</div>
                <span className="font-label-md text-label-md text-on-primary-container mb-md uppercase tracking-widest">Profesional</span>
                <div className="mb-lg">
                  <span className="font-headline-xl text-headline-xl text-on-primary-fixed">$49</span>
                  <span className="text-on-primary-container">/mes</span>
                </div>
                <ul className="space-y-4 mb-xl flex-grow">
                  {['Todo lo del plan Gratuito', 'Página web personalizada', 'Dominio propio', 'Recordatorios SMS', 'Hasta 20 servicios'].map(f => (
                    <li key={f} className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-on-primary-fixed-variant text-lg">check_circle</span>
                      <span className="font-body-sm text-body-sm text-on-primary-fixed">{f}</span>
                    </li>
                  ))}
                </ul>
                <button className="w-full py-4 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-bold hover:opacity-90 transition-all">Seleccionar Profesional</button>
              </div>
              {/* Business */}
              <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant flex flex-col transition-all hover:border-primary">
                <span className="font-label-md text-label-md text-on-surface-variant mb-md uppercase tracking-widest">Business</span>
                <div className="mb-lg">
                  <span className="font-headline-xl text-headline-xl text-on-background">$99</span>
                  <span className="text-on-surface-variant">/mes</span>
                </div>
                <ul className="space-y-4 mb-xl flex-grow">
                  {['Todo lo del plan Profesional', 'WhatsApp con IA integrada', 'Chatbot automático 24/7', 'Agendado por WhatsApp', 'Servicios ilimitados'].map(f => (
                    <li key={f} className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                      <span className="font-body-sm text-body-sm">{f}</span>
                    </li>
                  ))}
                </ul>
                <button className="w-full py-3 rounded-lg border border-outline text-primary font-label-md text-label-md font-bold hover:bg-surface-container-low transition-all">Seleccionar Business</button>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-xl">
          <div className="container mx-auto px-4 md:px-16">
            <div className="bg-primary p-xl rounded-3xl relative overflow-hidden flex flex-col items-center text-center">
              <div className="relative z-10 max-w-2xl">
                <h2 className="font-headline-xl text-headline-xl text-on-primary mb-md">¿Listo para elevar tu negocio de bienestar?</h2>
                <p className="font-body-lg text-body-lg text-primary-fixed mb-xl">Únete a miles de salones y clínicas que usan Nova Agenda para optimizar operaciones y deleitar a sus clientes.</p>
                <div className="flex flex-col sm:flex-row gap-md justify-center">
                  <button className="bg-surface-container-lowest text-primary px-8 py-4 rounded-lg font-label-md text-label-md font-bold shadow-lg hover:bg-surface-bright transition-all active:scale-95">Crear Cuenta Gratis</button>
                  <button className="bg-transparent border-2 border-primary-fixed text-primary-fixed px-8 py-4 rounded-lg font-label-md text-label-md font-bold hover:bg-white/10 transition-all active:scale-95">Agendar una Demo</button>
                </div>
                <p className="font-body-sm text-body-sm text-on-primary mt-lg opacity-80">Sin tarjeta de crédito. 14 días de prueba gratis.</p>
              </div>
              <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-secondary/20 rounded-full blur-3xl" />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-highest border-t border-outline-variant mt-xl">
        <div className="container mx-auto px-4 md:px-16 py-xl flex flex-col md:flex-row justify-between gap-xl">
          <div className="max-w-sm">
            <div className="flex items-center gap-3 mb-md">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-on-primary shadow-sm">
                <span className="material-symbols-outlined">spa</span>
              </div>
              <span className="font-label-md text-label-md font-bold text-primary">Nova Agenda</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-lg">Un ecosistema de gestión premium para la industria moderna del bienestar. Diseñado con cuidado.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-xl">
            <div className="flex flex-col gap-4">
              <h4 className="font-label-md text-label-md text-primary">Producto</h4>
              {['Características', 'Integraciones', 'Precios', 'API Docs'].map(l => (
                <a key={l} className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">{l}</a>
              ))}
            </div>
            <div className="flex flex-col gap-4">
              <h4 className="font-label-md text-label-md text-primary">Soporte</h4>
              {['Centro de Ayuda', 'Comunidad', 'Estado', 'Contacto'].map(l => (
                <a key={l} className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">{l}</a>
              ))}
            </div>
            <div className="flex flex-col gap-4">
              <h4 className="font-label-md text-label-md text-primary">Legal</h4>
              {['Política de Privacidad', 'Términos de Servicio'].map(l => (
                <a key={l} className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">{l}</a>
              ))}
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 md:px-16 py-lg border-t border-outline-variant flex flex-col md:flex-row justify-between items-center gap-md">
          <p className="font-body-sm text-body-sm text-on-surface-variant">&copy; {new Date().getFullYear()} Nova Agenda. Todos los derechos reservados.</p>
          <div className="flex gap-6">
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Cookies</a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Seguridad</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
