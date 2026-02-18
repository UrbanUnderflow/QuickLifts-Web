import type { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * POST /api/agent/trigger-standup
 * Body: { type?: 'telemetry' }
 *
 * Manually triggers a telemetry check by running the dailyStandup.js script.
 * Part of the Heartbeat Protocol — replaces traditional standups with
 * continuous system health monitoring, idle detection, and work assignment.
 *
 * Waits up to 5 seconds to verify the script actually starts successfully
 * before returning. If it crashes immediately, the error is returned.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const scriptPath = path.resolve(process.cwd(), 'scripts/dailyStandup.js');

    // Verify the script exists before trying to run it
    if (!fs.existsSync(scriptPath)) {
        console.error(`[telemetry] Script not found: ${scriptPath}`);
        return res.status(500).json({ error: `Script not found: ${scriptPath}` });
    }

    // Always pass --force when manually triggered so the script skips the time-window check.
    const args = [scriptPath, '--force'];

    console.log(`[telemetry] Spawning: node ${args.join(' ')}`);
    console.log(`[telemetry] CWD: ${process.cwd()}`);

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
            console.log(`[telemetry] Check running (PID ${child.pid}). Early output: ${stdout.substring(0, 200)}`);
            return res.status(200).json({
                success: true,
                message: 'Telemetry check triggered',
                pid: child.pid,
            });
        } else if (result.status === 'crashed') {
            console.error(`[telemetry] Script crashed immediately:`, result.error);
            return res.status(500).json({
                error: 'Telemetry check script crashed on startup',
                details: result.error.substring(0, 500),
                exitCode: result.code,
            });
        } else {
            console.error(`[telemetry] Spawn error:`, result.error);
            return res.status(500).json({
                error: 'Failed to start telemetry check',
                details: result.error,
            });
        }
    } catch (err: any) {
        console.error('[telemetry] Failed to trigger check:', err);
        return res.status(500).json({ error: err.message || 'Failed to trigger telemetry check' });
    }
}
