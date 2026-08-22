export function isSuperAdmin(user?: { role?: string } | null) {
  return user?.role === 'SUPER_ADMIN';
}

export function homePath(user?: { role?: string } | null) {
  return isSuperAdmin(user) ? '/dashboard/clients' : '/dashboard';
}

export const PLATFORM_NAV = [
  { href: '/dashboard/clients', label: 'Negocios', icon: 'group' },
  { href: '/dashboard/settings', label: 'Configuración', icon: 'settings' },
];

export const BUSINESS_NAV = [
  { href: '/dashboard', label: 'Panel', icon: 'dashboard' },
  { href: '/dashboard/website', label: 'Mi página web', icon: 'language' },
  { href: '/dashboard/staff', label: 'Personal', icon: 'badge' },
  { href: '/dashboard/booking', label: 'Agenda pública', icon: 'event_available' },
  { href: '/dashboard/services', label: 'Servicios', icon: 'inventory_2' },
  { href: '/dashboard/loyalty', label: 'Fidelidad', icon: 'loyalty' },
  { href: '/dashboard/memberships', label: 'Membresías', icon: 'card_membership' },
  { href: '/dashboard/whatsapp', label: 'WhatsApp', icon: 'chat' },
  { href: '/dashboard/billing', label: 'Facturación', icon: 'payments' },
  { href: '/dashboard/settings', label: 'Configuración', icon: 'settings' },
];

const BUSINESS_ONLY_PREFIXES = [
  '/dashboard/website',
  '/dashboard/staff',
  '/dashboard/booking',
  '/dashboard/services',
  '/dashboard/loyalty',
  '/dashboard/memberships',
  '/dashboard/whatsapp',
  '/dashboard/billing',
  '/dashboard/pos',
];

export function isBusinessOnlyPath(pathname: string) {
  if (pathname === '/dashboard') return true;
  return BUSINESS_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
