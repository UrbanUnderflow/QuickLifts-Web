import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MACRA_HOSTS = new Set(['eatwithmacra.ai', 'www.eatwithmacra.ai']);
const PULSECHECK_HOSTS = new Set(['pulsecheckmind.ai', 'www.pulsecheckmind.ai']);
const PIL_HOSTS = new Set(['pulseintelligencelabs.com', 'www.pulseintelligencelabs.com']);

const PIL_PREFIX = '/PIL';

const getSinglePageHostTarget = (host: string) => {
  if (MACRA_HOSTS.has(host)) return '/Macra';
  if (PULSECHECK_HOSTS.has(host)) return '/PulseCheck';
  return null;
};

export function middleware(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0];

  // pulseintelligencelabs.com → prefix-rewrites the entire site under /PIL
  // e.g. pulseintelligencelabs.com/        → /PIL
  //      pulseintelligencelabs.com/apps    → /PIL/apps
  // Direct visits to /PIL or /PIL/* on that host get canonicalized back.
  if (PIL_HOSTS.has(host)) {
    const { pathname } = request.nextUrl;

    // _next/data JSON requests for client-side navigation must follow the same prefix.
    const nextDataMatch = pathname.match(/^\/_next\/data\/([^/]+)\/(.+)\.json$/);
    if (nextDataMatch) {
      const [, buildId, dataPath] = nextDataMatch;
      if (dataPath === 'PIL' || dataPath.startsWith('PIL/')) {
        return NextResponse.next();
      }
      const newDataPath = dataPath === 'index' ? 'PIL' : `PIL/${dataPath}`;
      const url = request.nextUrl.clone();
      url.pathname = `/_next/data/${buildId}/${newDataPath}.json`;
      return NextResponse.rewrite(url);
    }

    // Canonicalize direct visits to the underlying /PIL paths back to "/" form.
    if (pathname === PIL_PREFIX) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith(`${PIL_PREFIX}/`)) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice(PIL_PREFIX.length);
      return NextResponse.redirect(url);
    }

    // Rewrite "/" and any sub-path under /PIL/*
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? PIL_PREFIX : `${PIL_PREFIX}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // eatwithmacra.ai / pulsecheckmind.ai: single-page domain mapping (root only).
  const targetPath = getSinglePageHostTarget(host);
  if (!targetPath) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const nextDataRootMatch = pathname.match(/^\/_next\/data\/([^/]+)\/index\.json$/);

  if (pathname === '/' || pathname === '') {
    const url = request.nextUrl.clone();
    url.pathname = targetPath;
    return NextResponse.rewrite(url);
  }

  if (nextDataRootMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/_next/data/${nextDataRootMatch[1]}${targetPath}.json`;
    return NextResponse.rewrite(url);
  }

  if (pathname === targetPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Macra / PulseCheck single-page hosts (root + canonicalization)
    '/',
    '/Macra',
    '/PulseCheck',
    // _next/data JSON for client-side navigation on any custom-host page
    '/_next/data/:path*',
    // Catch-all for PulseIntelligenceLabs.com sub-routes (skip static assets, api,
    // well-known, favicon, and anything with a file extension).
    '/((?!api|_next/static|_next/image|_next/data|favicon\\.ico|\\.well-known|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};
