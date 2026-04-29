import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MACRA_HOSTS = new Set(['eatwithmacra.ai', 'www.eatwithmacra.ai']);

export function middleware(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0];
  if (!MACRA_HOSTS.has(host)) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const nextDataRootMatch = pathname.match(/^\/_next\/data\/([^/]+)\/index\.json$/);

  if (pathname === '/' || pathname === '') {
    const url = request.nextUrl.clone();
    url.pathname = '/Macra';
    return NextResponse.rewrite(url);
  }

  if (nextDataRootMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/_next/data/${nextDataRootMatch[1]}/Macra.json`;
    return NextResponse.rewrite(url);
  }

  if (pathname === '/Macra') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/Macra', '/_next/data/:path*/index.json'],
};
