'use client';

import Link from 'next/link';
import { adminUrl } from '@/lib/urls';

const links = [
  {
    label: 'Crear mi cuenta gratis',
    href: adminUrl('/register', { plan: 'FREE' }),
    icon: 'rocket_launch',
    primary: true,
  },
  {
    label: 'Conoce el plan PRO — $149/mes',
    href: '#pricing',
    icon: 'star',
    primary: false,
  },
  {
    label: 'Ver demo en vivo',
    href: '/demo',
    icon: 'play_circle',
    primary: false,
  },
  {
    label: 'Portal de reservas (ejemplo)',
    href: '/demo',
    icon: 'event_available',
    primary: false,
  },
  {
    label: 'Programa de fidelidad',
    href: '/demo?loyalty=1',
    icon: 'loyalty',
    primary: false,
  },
  {
    label: 'WhatsApp con IA (addon)',
    href: '#addon',
    icon: 'chat',
    primary: false,
  },
  {
    label: 'Iniciar sesión',
    href: adminUrl('/login'),
    icon: 'login',
    primary: false,
  },
  {
    label: 'Acceso administrador',
    href: adminUrl('/admin/login'),
    icon: 'admin_panel_settings',
    primary: false,
  },
];

export default function LinksPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-12">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary opacity-5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center text-on-primary mb-4 shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-4xl">spa</span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface text-center">Nova Agenda</h1>
        <p className="font-body-md text-body-md text-on-surface-variant text-center mt-1 mb-8">
          Gestión de citas y reservas para tu negocio
        </p>

        <div className="w-full space-y-3">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl font-label-md text-label-md font-bold transition-all active:scale-[0.97] ${
                link.primary
                  ? 'bg-primary text-on-primary shadow-lg shadow-primary/20 hover:opacity-90'
                  : 'bg-surface-container-lowest border border-outline-variant text-on-surface hover:border-primary hover:bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined text-xl">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="mt-12 w-full text-center">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            ¿Dudas? Escríbenos a{' '}
            <a href="mailto:hola@novagenda.com" className="text-primary font-bold hover:underline">
              hola@novagenda.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
