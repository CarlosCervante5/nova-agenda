import { NextRequest, NextResponse } from 'next/server';

const PRODUCTION_API_URL = 'https://nova-agenda-production.up.railway.app';

function resolveApiBaseUrl() {
  const configured = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT);
  const isLocalhost = /localhost|127\.0\.0\.1/i.test(configured);

  if (configured && !(isProduction && isLocalhost)) return configured;
  if (isProduction) return PRODUCTION_API_URL;
  return configured || 'http://localhost:3001';
}

export function middleware(request: NextRequest) {
  const apiBase = resolveApiBaseUrl();
  const path = request.nextUrl.pathname + request.nextUrl.search;
  return NextResponse.rewrite(new URL(path, `${apiBase}/`));
}

export const config = {
  matcher: '/api/:path*',
};
