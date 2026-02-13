import type { Handler, HandlerEvent } from '@netlify/functions';
import fs from 'fs';
import path from 'path';

/**
 * File Browser + Search API (Netlify Function)
 *
 * GET ?search=query          — Fuzzy search filenames across the project (like Cursor @)
 * GET ?path=/src/components  — List directory contents
 * GET ?path=/src/Foo.tsx&read=true — Read file contents
 *
 * All paths are relative to the project root.
 * Sensitive directories and binary files are excluded.
 */

// Project root — Netlify functions run from the site root
const PROJECT_ROOT = process.cwd();

// Directories to exclude from browsing and searching
const EXCLUDED_DIRS = new Set([
    'node_modules', '.next', '.git', '.env', '.env.local', '.env.production',
    '.cache', 'dist', 'build', 'out', '.vercel', '.netlify',
    '__pycache__', '.DS_Store', 'coverage', '.turbo',
]);

// File extensions we support reading (code + docs)
const READABLE_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.less',
    '.json', '.md', '.mdx', '.txt', '.yml', '.yaml', '.toml',
    '.html', '.xml', '.svg', '.env.example', '.graphql', '.gql',
    '.sql', '.sh', '.bash', '.zsh', '.py', '.rb', '.go', '.rs',
    '.swift', '.kt', '.java', '.c', '.cpp', '.h', '.hpp',
]);

// Max file size we'll read (50KB)
const MAX_FILE_SIZE = 50 * 1024;

// Max search results
const MAX_SEARCH_RESULTS = 50;

// Max search depth to avoid unbounded traversal
const MAX_SEARCH_DEPTH = 12;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
};

function isExcluded(name: string): boolean {
    if (name.startsWith('.') && name !== '.env.example') return true;
    return EXCLUDED_DIRS.has(name);
}

function isReadableFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    if (!ext) {
        const base = path.basename(filename);
        return ['Makefile', 'Dockerfile', 'Procfile', 'Gemfile', 'Rakefile'].includes(base);
    }
    return READABLE_EXTENSIONS.has(ext);
}

function getFileIcon(name: string, isDir: boolean): string {
    if (isDir) return '📁';
    const ext = path.extname(name).toLowerCase();
    const iconMap: Record<string, string> = {
        '.ts': '🔷', '.tsx': '⚛️', '.js': '🟡', '.jsx': '⚛️',
        '.css': '🎨', '.scss': '🎨', '.json': '📋', '.md': '📝',
        '.html': '🌐', '.svg': '🖼️', '.py': '🐍', '.sql': '🗄️',
        '.yml': '⚙️', '.yaml': '⚙️', '.sh': '🐚',
        '.swift': '🍎', '.kt': '🟣', '.java': '☕',
    };
    return iconMap[ext] || '📄';
}

// ────────────────────────────────────────────────────────
// Fuzzy search: recursively walk the tree and score matches
// ────────────────────────────────────────────────────────

interface SearchResult {
    name: string;
    path: string;
    isDirectory: boolean;
    icon: string;
    size?: number;
    extension?: string;
    parentDir: string;
    score: number;
}

function fuzzyScore(query: string, filename: string, relativePath: string): number {
    const lowerQuery = query.toLowerCase();
    const lowerName = filename.toLowerCase();
    const lowerPath = relativePath.toLowerCase();

    // Exact match on filename → highest score
    if (lowerName === lowerQuery) return 100;

    // Filename starts with query
    if (lowerName.startsWith(lowerQuery)) return 90;

    // Filename contains query as a contiguous substring
    if (lowerName.includes(lowerQuery)) return 70;

    // Full path contains query (matches directory names too)
    if (lowerPath.includes(lowerQuery)) return 50;

    // Fuzzy: every character in query appears in order in filename
    let qi = 0;
    for (let i = 0; i < lowerName.length && qi < lowerQuery.length; i++) {
        if (lowerName[i] === lowerQuery[qi]) qi++;
    }
    if (qi === lowerQuery.length) return 30;

    // Fuzzy on full path
    qi = 0;
    for (let i = 0; i < lowerPath.length && qi < lowerQuery.length; i++) {
        if (lowerPath[i] === lowerQuery[qi]) qi++;
    }
    if (qi === lowerQuery.length) return 15;

    return 0; // no match
}

function searchFiles(
    dir: string,
    query: string,
    results: SearchResult[],
    depth: number = 0,
): void {
    if (depth > MAX_SEARCH_DEPTH || results.length >= MAX_SEARCH_RESULTS * 2) return;

    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return; // permission denied etc.
    }

    for (const entry of entries) {
        if (isExcluded(entry.name)) continue;
        if (results.length >= MAX_SEARCH_RESULTS * 2) break;

        const fullPath = path.join(dir, entry.name);
        const relPath = '/' + path.relative(PROJECT_ROOT, fullPath);

        if (entry.isDirectory()) {
            // Score the directory itself
            const score = fuzzyScore(query, entry.name, relPath);
            if (score > 0) {
                results.push({
                    name: entry.name,
                    path: relPath,
                    isDirectory: true,
                    icon: '📁',
                    parentDir: '/' + path.relative(PROJECT_ROOT, dir),
                    score,
                });
            }
            // Recurse into subdirectories
            searchFiles(fullPath, query, results, depth + 1);
        } else if (entry.isFile() && isReadableFile(entry.name)) {
            const score = fuzzyScore(query, entry.name, relPath);
            if (score > 0) {
                let size: number | undefined;
                try { size = fs.statSync(fullPath).size; } catch { /* skip */ }
                results.push({
                    name: entry.name,
                    path: relPath,
                    isDirectory: false,
                    icon: getFileIcon(entry.name, false),
                    size,
                    extension: path.extname(entry.name),
                    parentDir: '/' + path.relative(PROJECT_ROOT, dir),
                    score,
                });
            }
        }
    }
}

// ────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────

export const handler: Handler = async (event: HandlerEvent) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        const params = event.queryStringParameters || {};
        const searchQuery = params.search || '';
        const relativePath = params.path || '/';
        const shouldRead = params.read === 'true';

        // ── Search mode ──────────────────────────────────
        if (searchQuery.trim()) {
            const results: SearchResult[] = [];
            searchFiles(PROJECT_ROOT, searchQuery.trim(), results);

            // Sort by score (descending), then alphabetically
            results.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                // Prefer files over directories at the same score
                if (a.isDirectory !== b.isDirectory) return a.isDirectory ? 1 : -1;
                return a.name.localeCompare(b.name);
            });

            // Take top N
            const trimmed = results.slice(0, MAX_SEARCH_RESULTS);

            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    mode: 'search',
                    query: searchQuery,
                    results: trimmed,
                    total: results.length,
                }),
            };
        }

        // ── Browse / Read mode ────────────────────────────
        const absolutePath = path.resolve(PROJECT_ROOT, relativePath.replace(/^\//, ''));
        if (!absolutePath.startsWith(PROJECT_ROOT)) {
            return {
                statusCode: 403,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: 'Access denied — outside project root' }),
            };
        }

        const relFromRoot = path.relative(PROJECT_ROOT, absolutePath);
        const segments = relFromRoot.split(path.sep);
        if (segments.some(s => EXCLUDED_DIRS.has(s))) {
            return {
                statusCode: 403,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: 'Access denied — excluded directory' }),
            };
        }

        if (!fs.existsSync(absolutePath)) {
            return {
                statusCode: 404,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: 'Path not found' }),
            };
        }

        const stat = fs.statSync(absolutePath);

        // ── Read a file ──
        if (shouldRead && stat.isFile()) {
            if (stat.size > MAX_FILE_SIZE) {
                return {
                    statusCode: 413,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({
                        error: `File too large (${(stat.size / 1024).toFixed(1)}KB). Max is ${MAX_FILE_SIZE / 1024}KB.`,
                    }),
                };
            }
            if (!isReadableFile(absolutePath)) {
                return {
                    statusCode: 415,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ error: 'Unsupported file type' }),
                };
            }

            const content = fs.readFileSync(absolutePath, 'utf-8');
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    path: '/' + relFromRoot,
                    name: path.basename(absolutePath),
                    content,
                    size: stat.size,
                    extension: path.extname(absolutePath),
                }),
            };
        }

        // ── List a directory ──
        if (stat.isDirectory()) {
            const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
            const items = entries
                .filter(entry => !isExcluded(entry.name))
                .filter(entry => {
                    if (entry.isFile()) return isReadableFile(entry.name);
                    return true;
                })
                .map(entry => {
                    const entryPath = path.join(absolutePath, entry.name);
                    const entryStat = fs.statSync(entryPath);
                    const isDir = entry.isDirectory();
                    return {
                        name: entry.name,
                        path: '/' + path.relative(PROJECT_ROOT, entryPath),
                        isDirectory: isDir,
                        icon: getFileIcon(entry.name, isDir),
                        size: isDir ? undefined : entryStat.size,
                        extension: isDir ? undefined : path.extname(entry.name),
                        children: isDir
                            ? fs.readdirSync(entryPath, { withFileTypes: true })
                                .filter(e => !isExcluded(e.name))
                                .length
                            : undefined,
                    };
                })
                .sort((a, b) => {
                    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
                    return a.name.localeCompare(b.name);
                });

            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    path: '/' + (relFromRoot || ''),
                    items,
                }),
            };
        }

        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Invalid path' }),
        };
    } catch (error: any) {
        console.error('File browse API error:', error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: error.message || 'Failed to browse files' }),
        };
    }
};
