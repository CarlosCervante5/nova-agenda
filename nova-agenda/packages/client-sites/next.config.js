/** @type {import('next').NextConfig} */
function resolveApiBaseUrl() {
  const configured = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  if (configured) return configured;
  return 'http://localhost:3001';
}

const nextConfig = {
  async rewrites() {
    const apiUrl = resolveApiBaseUrl();
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

module.exports = nextConfig;
