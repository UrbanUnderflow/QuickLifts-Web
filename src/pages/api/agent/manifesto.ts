import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const manifestoPath = path.join(process.cwd(), 'docs', 'AGENT_MANIFESTO.md');

    try {
        if (!fs.existsSync(manifestoPath)) {
            return res.status(404).json({ error: 'Manifesto not found' });
        }
        const content = fs.readFileSync(manifestoPath, 'utf-8');
        res.status(200).json({ content });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
}
