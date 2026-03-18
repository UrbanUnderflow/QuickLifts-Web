const LOCAL_PULSECHECK_FUNCTIONS_PROXY_PREFIX = '/api/pulsecheck/functions';

function getRuntimeOverrideOrigin(): string | null {
  if (typeof window === 'undefined') return null;

  const localStorageOverride = window.localStorage.getItem('pulsecheck_functions_origin');
  if (localStorageOverride) {
    return localStorageOverride.replace(/\/+$/, '');
  }

  const runtimeOverride = (window as typeof window & {
    __PULSECHECK_FUNCTIONS_ORIGIN__?: string;
  }).__PULSECHECK_FUNCTIONS_ORIGIN__;

  return runtimeOverride ? runtimeOverride.replace(/\/+$/, '') : null;
}

export function resolvePulseCheckFunctionUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (typeof window === 'undefined') {
    return normalizedPath;
  }

  const overrideOrigin = getRuntimeOverrideOrigin();
  if (overrideOrigin) {
    return `${overrideOrigin}${normalizedPath}`;
  }

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isNetlifyDevPort = window.location.port === '8888';
  const isFunctionsPort = window.location.port === '9999';

  if (isLocalhost && !isNetlifyDevPort && !isFunctionsPort) {
    if (normalizedPath.startsWith('/.netlify/functions/')) {
      return normalizedPath.replace('/.netlify/functions', LOCAL_PULSECHECK_FUNCTIONS_PROXY_PREFIX);
    }
  }

  return normalizedPath;
}
