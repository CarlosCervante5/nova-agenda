const ADMIN_BASE = (process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3002').replace(/\/$/, '');

export function adminUrl(path: string, query?: Record<string, string>) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${ADMIN_BASE}${normalizedPath}`;
  if (!query || !Object.keys(query).length) return url;
  return `${url}?${new URLSearchParams(query).toString()}`;
}

export function getAdminBaseUrl() {
  return ADMIN_BASE;
}
