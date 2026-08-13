/** URL base del portal público de reservas (client-sites) */
export function getClientPortalBaseUrl() {
  // 1. Variable configurada en Railway (producción)
  const configured = process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL;
  if (configured) return configured.replace(/\/$/, '');

  // 2. En el navegador: usar el origin actual para preview
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // 3. Server-side sin configurar: devolver vacío
  return '';
}

export function getBookingFormUrl(slug: string) {
  const base = getClientPortalBaseUrl();
  if (!base) return `/${slug}`;
  return `${base}/${slug}`;
}
