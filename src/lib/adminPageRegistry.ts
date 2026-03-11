import fs from 'fs';
import path from 'path';

export type ManageablePageKind = 'static' | 'dynamic';

export interface ManageablePageEntry {
  pageId: string;
  route: string;
  kind: ManageablePageKind;
  sourcePath: string;
  suggestedUrl: string | null;
}

const PAGE_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js']);
const IGNORED_FILE_PATTERNS = [/\.d\.ts$/i, /\.bak/i, /\bcopy\./i];
const IGNORED_SEGMENTS = new Set(['api', 'admin']);

function shouldIgnoreFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.split('/').some((segment) => segment.startsWith('_'))) return true;
  if ([...IGNORED_SEGMENTS].some((segment) => normalized.split('/').includes(segment))) return true;
  return IGNORED_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function walkPages(dirPath: string, repoRoot: string, found: string[] = []): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    const relativePath = path.relative(repoRoot, absolutePath);

    if (entry.isDirectory()) {
      if (entry.name.startsWith('_') || IGNORED_SEGMENTS.has(entry.name)) continue;
      walkPages(absolutePath, repoRoot, found);
      continue;
    }

    const extension = path.extname(entry.name);
    if (!PAGE_EXTENSIONS.has(extension)) continue;
    if (shouldIgnoreFile(relativePath)) continue;
    found.push(relativePath);
  }

  return found;
}

function toRoute(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/');
  const withoutPrefix = normalized.replace(/^src\/pages\//, '');
  const withoutExtension = withoutPrefix.replace(/\.(tsx|ts|jsx|js)$/i, '');
  const segments = withoutExtension.split('/');

  const routeSegments = segments.filter((segment, index) => {
    if (segment === 'index') return index !== segments.length - 1;
    return true;
  });

  if (routeSegments.length === 0) return '/';
  return `/${routeSegments.join('/')}`;
}

function toPageId(route: string): string {
  if (route === '/') return 'index';
  return route.replace(/^\//, '');
}

export function getManageablePageRegistry(siteOrigin = 'https://fitwithpulse.ai'): ManageablePageEntry[] {
  const repoRoot = path.resolve(process.cwd());
  const pagesRoot = path.join(repoRoot, 'src/pages');
  const filePaths = walkPages(pagesRoot, repoRoot);

  return filePaths
    .map((sourcePath) => {
      const route = toRoute(sourcePath);
      const hasDynamicSegment = route.includes('[');
      const kind: ManageablePageKind = hasDynamicSegment ? 'dynamic' : 'static';
      return {
        pageId: toPageId(route),
        route,
        kind,
        sourcePath,
        suggestedUrl: hasDynamicSegment ? null : `${siteOrigin}${route === '/' ? '' : route}`,
      };
    })
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === 'static' ? -1 : 1;
      return left.route.localeCompare(right.route);
    });
}
