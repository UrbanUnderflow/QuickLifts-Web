import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MACRA_HOSTS = new Set(['eatwithmacra.ai', 'www.eatwithmacra.ai']);
const PULSECHECK_HOSTS = new Set(['pulsecheckmind.ai', 'www.pulsecheckmind.ai']);

const getHostTargetPath = (host: string) => {
  if (MACRA_HOSTS.has(host)) return '/Macra';
  if (PULSECHECK_HOSTS.has(host)) return '/PulseCheck';
  return null;
};

export function middleware(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0];
  const targetPath = getHostTargetPath(host);
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
  matcher: ['/', '/Macra', '/PulseCheck', '/_next/data/:path*/index.json'],
};
