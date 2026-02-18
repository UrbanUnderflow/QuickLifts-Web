import type { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * POST /api/agent/trigger-standup
 * Body: { type?: 'morning' | 'evening' }
 *
 * Manually triggers a standup by running the dailyStandup.js script.
 * Waits up to 5 seconds to verify the script actually starts successfully
 * before returning. If it crashes immediately, the error is returned.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { type } = req.body || {};

    if (type && !['morning', 'evening'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be "morning" or "evening".' });
    }

    const scriptPath = path.resolve(process.cwd(), 'scripts/dailyStandup.js');

    // Verify the script exists before trying to run it
    if (!fs.existsSync(scriptPath)) {
        console.error(`[trigger-standup] Script not found: ${scriptPath}`);
        return res.status(500).json({ error: `Script not found: ${scriptPath}` });
    }

    // Always pass --force when manually triggered so the script skips the time-window check.
    const args = type ? [scriptPath, type, '--force'] : [scriptPath, '--force'];

    console.log(`[trigger-standup] Spawning: node ${args.join(' ')}`);
    console.log(`[trigger-standup] CWD: ${process.cwd()}`);

    try {
        // Spawn with pipe so we can capture early errors
        const child = spawn('node', args, {
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: process.cwd(),
            env: { ...process.env },
        });

        let stderr = '';
        let stdout = '';

        child.stdout?.on('data', (data) => {
            stdout += data.toString();
        });
        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        // Wait up to 5 seconds to see if the script crashes immediately
        const result = await Promise.race([
            new Promise<{ status: 'started' }>((resolve) => {
                // If after 5s the process hasn't exited, it's running fine
                setTimeout(() => {
                    // Detach from the process so it continues in the background
                    child.stdout?.removeAllListeners();
                    child.stderr?.removeAllListeners();
                    child.unref();
                    resolve({ status: 'started' });
                }, 5000);
            }),
            new Promise<{ status: 'crashed'; code: number | null; error: string }>((resolve) => {
                child.on('exit', (code) => {
                    resolve({
                        status: 'crashed',
                        code,
                        error: stderr || stdout || `Script exited with code ${code}`,
                    });
                });
            }),
            new Promise<{ status: 'error'; error: string }>((resolve) => {
                child.on('error', (err) => {
                    resolve({ status: 'error', error: err.message });
                });
            }),
        ]);

        if (result.status === 'started') {
            console.log(`[trigger-standup] Script running (PID ${child.pid}). Early output: ${stdout.substring(0, 200)}`);
            return res.status(200).json({
                success: true,
                message: `Standup triggered${type ? ` (${type})` : ' (auto-detect)'}`,
                pid: child.pid,
            });
        } else if (result.status === 'crashed') {
            console.error(`[trigger-standup] Script crashed immediately:`, result.error);
            return res.status(500).json({
                error: 'Standup script crashed on startup',
                details: result.error.substring(0, 500),
                exitCode: result.code,
            });
        } else {
            console.error(`[trigger-standup] Spawn error:`, result.error);
            return res.status(500).json({
                error: 'Failed to start standup script',
                details: result.error,
            });
        }
    } catch (err: any) {
        console.error('[trigger-standup] Failed to trigger standup:', err);
        return res.status(500).json({ error: err.message || 'Failed to trigger standup' });
    }
}
