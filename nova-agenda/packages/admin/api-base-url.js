const PRODUCTION_API_URL = 'https://nova-agenda-production.up.railway.app';

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT);
}

function isLocalhostUrl(url) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function resolveApiBaseUrl() {
  const configured = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

  if (configured && !(isProductionRuntime() && isLocalhostUrl(configured))) {
    return configured;
  }

  if (isProductionRuntime()) {
    return PRODUCTION_API_URL;
  }

  return configured || 'http://localhost:3001';
}

module.exports = { PRODUCTION_API_URL, resolveApiBaseUrl };
