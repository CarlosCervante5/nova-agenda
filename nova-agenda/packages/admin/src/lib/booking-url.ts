/** URL base del portal público de reservas (client-sites) */
export function getClientPortalBaseUrl() {
  const base = (
    process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ||
    (typeof window !== 'undefined' ? '' : 'http://localhost:3004')
  ).replace(/\/$/, '');

  // Producción: fallback si la env no se inyectó en el build
  if (!base && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    return 'https://delightful-encouragement-production.up.railway.app';
  }

  return base || (typeof window === 'undefined' ? 'http://localhost:3004' : '');
}

export function getBookingFormUrl(slug: string) {
  const base = getClientPortalBaseUrl();
  if (!base) return `/${slug}`;
  return `${base}/${slug}`;
}
