export const PRODUCTION_API_URL = '';

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT);
}

function isLocalhostUrl(url: string) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

/** URL de la API para proxy SSR/middleware. Nunca usa localhost en producción. */
export function resolveApiBaseUrl() {
  const configured = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

  if (configured && !(isProductionRuntime() && isLocalhostUrl(configured))) {
    return configured;
  }

  if (isProductionRuntime()) {
    throw new Error('API_URL or NEXT_PUBLIC_API_URL must be set in production');
  }

  return configured || 'http://localhost:3001';
}
