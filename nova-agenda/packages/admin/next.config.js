/** @type {import('next').NextConfig} */
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
  return configured || 'http://localhost:3001';
}

const nextConfig = {
  async rewrites() {
    const apiUrl = resolveApiBaseUrl();
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

module.exports = nextConfig;
