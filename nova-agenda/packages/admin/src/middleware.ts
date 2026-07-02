import { NextRequest, NextResponse } from 'next/server';

const PRODUCTION_API_URL = 'https://nova-agenda-production.up.railway.app';

function getApiBaseUrl() {
  const configured = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, '');

  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_API_URL;
  }

  return 'http://localhost:3001';
}

export function middleware(request: NextRequest) {
  const apiBase = getApiBaseUrl();
  const path = request.nextUrl.pathname + request.nextUrl.search;
  return NextResponse.rewrite(new URL(path, `${apiBase}/`));
}

export const config = {
  matcher: '/api/:path*',
};
