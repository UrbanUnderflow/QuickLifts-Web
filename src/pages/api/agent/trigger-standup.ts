import type { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import path from 'path';

/**
 * POST /api/agent/trigger-standup
 * Body: { type?: 'morning' | 'evening' }
 *
 * Manually triggers a standup by running the dailyStandup.js script.
 * The script runs as a detached background process and the API returns immediately.
 * The type is optional — if omitted, the script auto-detects based on time of day.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { type } = req.body || {};

    // Validate type if provided
    if (type && !['morning', 'evening'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be "morning" or "evening".' });
    }

    const scriptPath = path.resolve(process.cwd(), 'scripts/dailyStandup.js');
    const args = type ? [scriptPath, type] : [scriptPath];

    try {
        // Spawn the standup script as a detached background process
        const child = spawn('node', args, {
            detached: true,
            stdio: 'ignore',
            cwd: process.cwd(),
            env: { ...process.env },
        });

        // Unref so the parent process can exit without waiting for the child
        child.unref();

        return res.status(200).json({
            success: true,
            message: `Standup triggered${type ? ` (${type})` : ' (auto-detect)'}`,
            pid: child.pid,
        });
    } catch (err: any) {
        console.error('Failed to trigger standup:', err);
        return res.status(500).json({ error: err.message || 'Failed to trigger standup' });
    }
}
