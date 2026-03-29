const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const API_ROOT = path.join(PROJECT_ROOT, 'src/pages/api');
const NETLIFY_TOML = path.join(PROJECT_ROOT, 'netlify.toml');
const FILE_EXTENSIONS = new Set(['.js', '.ts', '.tsx', '.mjs', '.cjs']);
const FIREBASE_NEXT_PATTERNS = [
  'lib/firebase-admin',
  'server/firebase/app-registry',
];

function walkDirectory(dirPath, results = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name === '__tests__') {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(fullPath, results);
      continue;
    }

    if (!FILE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    results.push(fullPath);
  }

  return results;
}

function toRoute(filePath) {
  const relativePath = path.relative(path.join(PROJECT_ROOT, 'src/pages'), filePath).split(path.sep).join('/');
  return `/${relativePath}`
    .replace(/\.(?:js|ts|tsx|mjs|cjs)$/, '')
    .replace(/\/index$/, '');
}

function collectFirebaseNextApiRoutes() {
  if (!fs.existsSync(API_ROOT)) {
    return [];
  }

  return walkDirectory(API_ROOT)
    .filter((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      return FIREBASE_NEXT_PATTERNS.some((pattern) => content.includes(pattern))
        && /export\s+default\s+/m.test(content);
    })
    .map(toRoute)
    .sort();
}

function collectNetlifyFunctionRedirects() {
  if (!fs.existsSync(NETLIFY_TOML)) {
    return new Map();
  }

  const content = fs.readFileSync(NETLIFY_TOML, 'utf8');
  const redirects = new Map();
  const blockRegex = /\[\[redirects\]\]([\s\S]*?)(?=\n\[\[redirects\]\]|\n\[[^\[]|$)/g;

  for (const match of content.matchAll(blockRegex)) {
    const block = match[1];
    const fromMatch = block.match(/from\s*=\s*"([^"]+)"/);
    const toMatch = block.match(/to\s*=\s*"([^"]+)"/);

    if (!fromMatch || !toMatch) {
      continue;
    }

    const from = fromMatch[1];
    const to = toMatch[1];
    if (!to.startsWith('/.netlify/functions/')) {
      continue;
    }

    redirects.set(from, to);
  }

  return redirects;
}

function toConcreteRouteSample(route) {
  return route.replace(/\[([^\]]+)\]/g, (_, paramName) => {
    const normalized = String(paramName || 'sample')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    return normalized || 'sample';
  });
}

function redirectPatternToRegex(pattern) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withWildcards = escaped
    .replace(/:([A-Za-z0-9_]+)/g, '[^/]+')
    .replace(/\\\*/g, '.*');
  return new RegExp(`^${withWildcards}$`);
}

function findRedirectForRoute(route, redirects) {
  const concreteRoute = toConcreteRouteSample(route);

  for (const [from, target] of redirects.entries()) {
    if (redirectPatternToRegex(from).test(concreteRoute)) {
      return { route, target, redirectPattern: from };
    }
  }

  return null;
}

function main() {
  const routes = collectFirebaseNextApiRoutes();
  const redirects = collectNetlifyFunctionRedirects();

  const mitigated = routes
    .map((route) => findRedirectForRoute(route, redirects))
    .filter(Boolean);

  const atRisk = routes
    .filter((route) => !findRedirectForRoute(route, redirects))
    .map((route) => ({ route }));

  const report = {
    summary: {
      totalFirebaseNextApiRoutes: routes.length,
      mitigatedByNetlifyRedirect: mitigated.length,
      stillAtRiskOnNextRuntime: atRisk.length,
    },
    mitigated,
    atRisk,
  };

  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  console.log('[firebase-next-api-runtime-audit] Summary');
  console.log(`- total Firebase-backed Next API routes: ${report.summary.totalFirebaseNextApiRoutes}`);
  console.log(`- mitigated by Netlify function redirect: ${report.summary.mitigatedByNetlifyRedirect}`);
  console.log(`- still at risk on Next.js Server Handler: ${report.summary.stillAtRiskOnNextRuntime}`);

  if (mitigated.length > 0) {
    console.log('');
    console.log('[firebase-next-api-runtime-audit] Mitigated routes');
    for (const item of mitigated) {
      console.log(`- ${item.route} -> ${item.target} (${item.redirectPattern})`);
    }
  }

  if (atRisk.length > 0) {
    console.log('');
    console.log('[firebase-next-api-runtime-audit] At-risk routes');
    for (const item of atRisk) {
      console.log(`- ${item.route}`);
    }
  }
}

main();
