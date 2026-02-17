import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/read-file?path=docs/sage/brainstorm-extract.md
 *
 * Reads a project-relative file and returns its contents as JSON.
 * Only allows reading from a safe allowlist of directories
 * to prevent arbitrary file reads.
 */

const ALLOWED_PREFIXES = ['docs/', '.agent/', 'scripts/', 'src/'];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const filePath = req.query.path as string | undefined;

    if (!filePath) {
        return res.status(400).json({ error: 'Missing "path" query parameter' });
    }

    // Security: only allow reading from approved directories
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('..') || !ALLOWED_PREFIXES.some((p) => normalizedPath.startsWith(p))) {
        return res.status(403).json({ error: 'Access denied — path not in allowlist' });
    }

    const projectRoot = process.cwd();
    const absolutePath = path.join(projectRoot, normalizedPath);

    try {
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ error: 'File not found', path: normalizedPath });
        }

        const content = fs.readFileSync(absolutePath, 'utf-8');
        return res.status(200).json({ content, path: normalizedPath });
    } catch (err: any) {
        return res.status(500).json({ error: 'Failed to read file', message: err.message });
    }
}
