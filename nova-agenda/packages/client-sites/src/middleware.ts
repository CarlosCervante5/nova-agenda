import { NextRequest, NextResponse } from 'next/server';

function resolveApiBaseUrl() {
  return (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
}

export function middleware(request: NextRequest) {
  const apiBase = resolveApiBaseUrl();
  const path = request.nextUrl.pathname + request.nextUrl.search;
  return NextResponse.rewrite(new URL(path, `${apiBase}/`));
}

export const config = {
  matcher: '/api/:path*',
};
