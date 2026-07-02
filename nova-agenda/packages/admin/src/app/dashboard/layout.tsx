'use client';

import { AuthProvider, useAuth } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clientPlan, setClientPlan] = useState<string>('FREE');

  useEffect(() => {
    if (user?.clientId) {
      api.getClient(user.clientId).then(c => setClientPlan(c.plan)).catch(() => {});
    }
  }, [user]);

  const navLinks = [
    { href: '/dashboard', label: 'Panel', icon: 'dashboard' },
    { href: '/dashboard/clients', label: 'Negocios', icon: 'group', roles: ['SUPER_ADMIN', 'ADMIN'] },
    { href: '/dashboard/services', label: 'Servicios', icon: 'inventory_2' },
    { href: '/dashboard/loyalty', label: 'Fidelidad', icon: 'loyalty' },
    { href: '/dashboard/whatsapp', label: 'WhatsApp', icon: 'chat', minPlan: 'PRO' },
    { href: '/dashboard/billing', label: 'Facturación', icon: 'payments' },
    { href: '/dashboard/settings', label: 'Configuración', icon: 'settings', roles: ['SUPER_ADMIN'] },
  ];

  const PLAN_LEVELS: Record<string, number> = { FREE: 0, BASIC: 1, PRO: 2 };
  const userPlanLevel = PLAN_LEVELS[clientPlan] ?? 0;

  const filteredLinks = navLinks.filter((l) => {
    if (l.roles && !l.roles.includes(user?.role || '')) return false;
    if (l.minPlan && userPlanLevel < PLAN_LEVELS[l.minPlan]) return false;
    return true;
  });

  const bottomTabs = filteredLinks.slice(0, 5);

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-surface border-b border-outline-variant flex items-center px-3 z-50">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 hover:bg-surface-container-high rounded-lg">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <div className="flex items-center gap-2 ml-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined text-sm">spa</span>
          </div>
          <span className="font-headline-md text-headline-md font-bold text-primary">Nova Agenda</span>
        </div>
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`fixed left-0 top-0 h-screen w-[280px] bg-surface-container-low border-r border-outline-variant flex flex-col py-lg z-50 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="px-lg mb-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-on-primary shadow-sm shadow-primary/20">
              <span className="material-symbols-outlined">spa</span>
            </div>
            <div>
              <h1 className="font-headline-md text-[20px] font-bold text-on-surface">Nova Agenda</h1>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Consola de Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-sm space-y-1 overflow-y-auto custom-scrollbar">
          {filteredLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-label-md text-label-md transition-all active:translate-x-1 duration-200 ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container border-l-4 border-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined">{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-sm mt-auto pt-lg border-t border-outline-variant space-y-1">
          <Link href="/" className="flex items-center gap-3 text-on-surface-variant px-4 py-3 hover:bg-surface-container-high transition-all rounded-lg font-label-md text-label-md">
            <span className="material-symbols-outlined">public</span>
            Sitio Público
          </Link>
          <button onClick={logout} className="w-full flex items-center gap-3 text-on-surface-variant px-4 py-3 hover:bg-surface-container-high transition-all rounded-lg font-label-md text-label-md">
            <span className="material-symbols-outlined text-error">logout</span>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-outline-variant flex items-center justify-around z-50 safe-bottom">
        {bottomTabs.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all ${
                isActive ? 'text-primary' : 'text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">{link.icon}</span>
              <span className="text-[10px] font-medium leading-none">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-on-primary animate-pulse">
            <span className="material-symbols-outlined text-2xl">spa</span>
          </div>
          <div className="animate-spin h-6 w-6 border-[3px] border-primary-container border-t-primary rounded-full" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:ml-[280px] min-h-screen flex flex-col">
        <header className="hidden md:flex justify-between items-center w-full px-lg h-16 sticky top-0 z-30 bg-surface border-b border-outline-variant shadow-sm backdrop-blur-md bg-opacity-90">
          <div className="flex items-center gap-4">
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Resumen</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 pl-4 border-l border-outline-variant">
              <div className="text-right">
                <p className="font-label-md text-label-md text-on-surface">{user.name}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">{user.role}</p>
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-primary-container/30 bg-primary-fixed flex items-center justify-center text-primary font-bold">
                {user.name.charAt(0)}
              </div>
            </div>
          </div>
        </header>
        <div className="p-3 pt-17 md:p-lg lg:p-xl flex-1 pb-24 md:pb-lg">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthProvider>
  );
}
