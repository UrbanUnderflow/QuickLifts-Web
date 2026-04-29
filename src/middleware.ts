import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MACRA_HOSTS = new Set(['eatwithmacra.ai', 'www.eatwithmacra.ai']);

export function middleware(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').toLowerCase();
  if (!MACRA_HOSTS.has(host)) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === '/' || pathname === '') {
    const url = request.nextUrl.clone();
    url.pathname = '/Macra';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/|api/|.*\\.).*)'],
};
