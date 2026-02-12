import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

/**
 * File Browser API
 * 
 * GET ?path=/src/components — List directory contents
 * GET ?path=/src/components/Foo.tsx&read=true — Read file contents
 * 
 * All paths are relative to the project root.
 * Sensitive directories and binary files are excluded.
 */

// Project root (where package.json lives)
const PROJECT_ROOT = process.cwd();

// Directories to exclude from browsing
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

function isExcluded(name: string): boolean {
    if (name.startsWith('.') && name !== '.env.example') return true;
    return EXCLUDED_DIRS.has(name);
}

function isReadableFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    // Also allow extensionless files like Makefile, Dockerfile, etc.
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
    };
    return iconMap[ext] || '📄';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const relativePath = (req.query.path as string) || '/';
        const shouldRead = req.query.read === 'true';

        // Resolve the absolute path and ensure it's within the project root
        const absolutePath = path.resolve(PROJECT_ROOT, relativePath.replace(/^\//, ''));
        if (!absolutePath.startsWith(PROJECT_ROOT)) {
            return res.status(403).json({ error: 'Access denied — outside project root' });
        }

        // Check path segments for excluded dirs
        const relFromRoot = path.relative(PROJECT_ROOT, absolutePath);
        const segments = relFromRoot.split(path.sep);
        if (segments.some(s => EXCLUDED_DIRS.has(s))) {
            return res.status(403).json({ error: 'Access denied — excluded directory' });
        }

        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ error: 'Path not found' });
        }

        const stat = fs.statSync(absolutePath);

        // ── Read a file ──
        if (shouldRead && stat.isFile()) {
            if (stat.size > MAX_FILE_SIZE) {
                return res.status(413).json({
                    error: `File too large (${(stat.size / 1024).toFixed(1)}KB). Max is ${MAX_FILE_SIZE / 1024}KB.`,
                });
            }
            if (!isReadableFile(absolutePath)) {
                return res.status(415).json({ error: 'Unsupported file type' });
            }

            const content = fs.readFileSync(absolutePath, 'utf-8');
            return res.status(200).json({
                path: '/' + relFromRoot,
                name: path.basename(absolutePath),
                content,
                size: stat.size,
                extension: path.extname(absolutePath),
            });
        }

        // ── List a directory ──
        if (stat.isDirectory()) {
            const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
            const items = entries
                .filter(entry => !isExcluded(entry.name))
                .filter(entry => {
                    // For files, only show readable types
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
                // Sort: directories first, then alphabetical
                .sort((a, b) => {
                    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
                    return a.name.localeCompare(b.name);
                });

            return res.status(200).json({
                path: '/' + (relFromRoot || ''),
                items,
            });
        }

        return res.status(400).json({ error: 'Invalid path' });
    } catch (error: any) {
        console.error('File browse API error:', error);
        return res.status(500).json({ error: error.message || 'Failed to browse files' });
    }
}
