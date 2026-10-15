/**
 * PipeLists is a production-only surface until an isolated demo/emulator stack is
 * provided. This module must remain service-dependency-free: it runs before Firebase,
 * authentication, persistence, or delivery clients may be imported.
 */
export const PIPELISTS_RUNTIME_BLOCK_CODE = 'PIPELISTS_NON_PRODUCTION_BLOCKED';
export const PIPELISTS_RUNTIME_BLOCK_MESSAGE =
  'PipeLists is disabled outside the verified production deployment.';

const PRODUCTION_HOSTS = new Set(['fitwithpulse.ai', 'www.fitwithpulse.ai']);

type RuntimeEnvironment = {
  NODE_ENV?: string;
  CONTEXT?: string;
  NETLIFY_LOCAL?: string;
  NETLIFY_PREVIEW_SERVER?: string;
  SITE_ID?: string;
  SITE_NAME?: string;
  URL?: string;
};

type DeploymentMarker = { production?: boolean; siteId?: string; siteName?: string; url?: string };
const deployment: DeploymentMarker = (() => {
  try {
    // Generated before bundling; a clean checkout and function-only local run
    // have no marker and stay disabled. This imports data, never a service.
    const marker: unknown = require('../generated/pipelists-deployment.json');
    return marker && typeof marker === 'object' ? marker as DeploymentMarker : { production: false };
  } catch {
    return { production: false };
  }
})();

export function isPipeListsProductionRuntime(env: RuntimeEnvironment = {
  NODE_ENV: process.env.NODE_ENV, CONTEXT: process.env.CONTEXT, NETLIFY_LOCAL: process.env.NETLIFY_LOCAL,
  NETLIFY_PREVIEW_SERVER: process.env.NETLIFY_PREVIEW_SERVER,
  SITE_ID: process.env.SITE_ID, SITE_NAME: process.env.SITE_NAME, URL: process.env.URL,
}): boolean {
  // CONTEXT is build-only on Netlify. The bundled marker proves build context;
  // the documented runtime site identity also rejects copied local artifacts.
  // Missing NODE_ENV/CONTEXT is normal in Functions, but conflicting values deny.
  return deployment.production === true && Boolean(deployment.siteId && deployment.siteName && deployment.url)
    && env.SITE_ID === deployment.siteId && env.SITE_NAME === deployment.siteName && env.URL === deployment.url
    && (env.NODE_ENV === undefined || env.NODE_ENV === 'production')
    && (env.CONTEXT === undefined || env.CONTEXT === 'production')
    && env.NETLIFY_LOCAL !== 'true' && env.NETLIFY_PREVIEW_SERVER !== 'true';
}

export class PipeListsRuntimeError extends Error {
  readonly status = 503;
  readonly code = PIPELISTS_RUNTIME_BLOCK_CODE;

  constructor() {
    super(PIPELISTS_RUNTIME_BLOCK_MESSAGE);
    this.name = 'PipeListsRuntimeError';
  }
}

export function assertPipeListsProductionRuntime(): void {
  if (!isPipeListsProductionRuntime()) throw new PipeListsRuntimeError();
}

export function isPipeListsProductionBrowser(hostname?: string, protocol?: string): boolean {
  // next.config.js derives this flag from deployment context, never a public
  // environment override. Host checks also block a copied production build.
  if (process.env.NEXT_PUBLIC_PIPELISTS_PRODUCTION_BUILD !== 'true') return false;
  if (hostname === undefined) {
    if (typeof window === 'undefined') return false;
    hostname = window.location.hostname;
    protocol = window.location.protocol;
    if (window.location.port && window.location.port !== '443') return false;
  }
  return protocol === 'https:' && PRODUCTION_HOSTS.has(hostname.toLowerCase());
}

function isProductionHostHeader(host: unknown): boolean {
  if (typeof host !== 'string') return false;
  return PRODUCTION_HOSTS.has(host.toLowerCase().replace(/:443$/, ''));
}

function isProductionOrigin(origin: unknown): boolean {
  if (origin === undefined) return true;
  if (typeof origin !== 'string') return false;
  try {
    const url = new URL(origin);
    return url.origin === origin && url.protocol === 'https:' && !url.port && PRODUCTION_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function guardPipeListsApiRequest(
  req: { headers: { host?: string | string[]; origin?: string | string[] } },
  res: {
    setHeader: (name: string, value: string) => unknown;
    status: (status: number) => { json: (body: { success: false; error: string; code: string }) => unknown };
  },
): boolean {
  if (isPipeListsProductionRuntime() && isProductionHostHeader(req.headers.host) && isProductionOrigin(req.headers.origin)) {
    return true;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(503).json({ success: false, error: PIPELISTS_RUNTIME_BLOCK_MESSAGE, code: PIPELISTS_RUNTIME_BLOCK_CODE });
  return false;
}

export function isPipeListsRoute(pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '').toLowerCase();
  return path === '/pipelists' || path === '/pipelistsqueue';
}
