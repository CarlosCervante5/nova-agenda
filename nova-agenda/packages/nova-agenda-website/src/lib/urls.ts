function getAdminBase() {
  const configured = process.env.NEXT_PUBLIC_ADMIN_URL;
  if (configured) return configured.replace(/\/$/, '');
  // En desarrollo, fallback a localhost
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3002';
  // En producción, error si no está configurado
  throw new Error('NEXT_PUBLIC_ADMIN_URL must be set in production');
}

export function adminUrl(path: string, query?: Record<string, string>) {
  const base = getAdminBase();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${normalizedPath}`;
  if (!query || !Object.keys(query).length) return url;
  return `${url}?${new URLSearchParams(query).toString()}`;
}

export function getAdminBaseUrl() {
  return getAdminBase();
}
