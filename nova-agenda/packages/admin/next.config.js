/** @type {import('next').NextConfig} */
const { resolveApiBaseUrl } = require('./api-base-url.js');

const nextConfig = {
  // Fallback en build; en runtime el middleware usa resolveApiBaseUrl() con env de Railway.
  async rewrites() {
    const apiUrl = resolveApiBaseUrl();
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

module.exports = nextConfig;
