/** URL base del portal público de reservas (client-sites) */
export function getClientPortalBaseUrl() {
  const base = (
    process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ||
    (typeof window !== 'undefined' ? '' : 'http://localhost:3004')
  ).replace(/\/$/, '');

  return base || (typeof window === 'undefined' ? 'http://localhost:3004' : '');
}

export function getBookingFormUrl(slug: string) {
  const base = getClientPortalBaseUrl();
  if (!base) return `/${slug}`;
  return `${base}/${slug}`;
}
