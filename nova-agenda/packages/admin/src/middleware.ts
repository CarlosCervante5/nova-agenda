import { NextRequest, NextResponse } from 'next/server';
import { resolveApiBaseUrl } from '@/lib/api-base-url';

export function middleware(request: NextRequest) {
  const apiBase = resolveApiBaseUrl();
  const path = request.nextUrl.pathname + request.nextUrl.search;
  return NextResponse.rewrite(new URL(path, `${apiBase}/`));
}

export const config = {
  matcher: '/api/:path*',
};
