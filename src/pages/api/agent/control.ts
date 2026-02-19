import type { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const SAFE_AGENT_ID = /^[a-z0-9_-]+$/i;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getServicePid(uid: number, serviceLabel: string): Promise<number | null> {
    try {
        const { stdout } = await execAsync(`launchctl print gui/${uid}/${serviceLabel}`);
        const match = stdout.match(/\bpid\s*=\s*(\d+)/);
        return match ? Number(match[1]) : null;
    } catch (err: any) {
        const msg = err?.stderr || err?.message || '';
        if (
            msg.includes('Could not find service') ||
            msg.includes('Could not find specified service') ||
            msg.includes('No such process')
        ) {
            return null;
        }
        throw err;
    }
}

/**
 * POST /api/agent/control
 * Body: { agentId: string; action: 'start' | 'stop' | 'restart' }
 *
 * Controls agent launchd services on the local Mac.
 * - start: launchctl bootstrap the agent plist
 * - stop:  launchctl bootout  the agent plist
 * - restart: launchctl kickstart -k service and verify PID rotation
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { agentId, action } = req.body as {
        agentId?: string;
        action?: 'start' | 'stop' | 'restart';
    };

    if (!agentId || !SAFE_AGENT_ID.test(agentId)) {
        return res.status(400).json({ error: 'Missing or invalid agentId' });
    }

    if (!action || !['start', 'stop', 'restart'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action (start|stop|restart)' });
    }

    const plistPath = `${process.env.HOME}/Library/LaunchAgents/com.quicklifts.agent.${agentId}.plist`;
    const uid = process.getuid?.() ?? 501;
    const serviceLabel = `com.quicklifts.agent.${agentId}`;
    const servicePath = `gui/${uid}/${serviceLabel}`;

    try {
        if (action === 'restart') {
            const beforePid = await getServicePid(uid, serviceLabel);
            try {
                await execAsync(`launchctl kickstart -k ${servicePath}`);
            } catch (err: any) {
                const msg = err?.stderr || err?.message || '';
                // If service isn't loaded yet, bootstrap from plist so restart still recovers service.
                if (
                    msg.includes('Could not find service') ||
                    msg.includes('Could not find specified service') ||
                    msg.includes('No such process')
                ) {
                    await execAsync(`launchctl bootstrap gui/${uid} "${plistPath}"`);
                } else {
                    throw err;
                }
            }

            let afterPid: number | null = null;
            for (let i = 0; i < 15; i += 1) {
                await sleep(200);
                afterPid = await getServicePid(uid, serviceLabel);
                if (afterPid && (!beforePid || afterPid !== beforePid)) break;
            }

            if (!afterPid) {
                return res.status(500).json({
                    success: false,
                    error: `Service ${agentId} did not come online after restart`,
                    beforePid,
                    afterPid: null,
                });
            }

            if (beforePid && afterPid === beforePid) {
                return res.status(500).json({
                    success: false,
                    error: `Service ${agentId} PID did not change after restart`,
                    beforePid,
                    afterPid,
                });
            }

            return res.status(200).json({
                success: true,
                agentId,
                action,
                beforePid,
                afterPid,
            });
        }

        if (action === 'start') {
            await execAsync(`launchctl bootstrap gui/${uid} "${plistPath}"`);
        } else {
            await execAsync(`launchctl bootout gui/${uid} "${plistPath}"`);
        }

        return res.status(200).json({ success: true, agentId, action });
    } catch (err: any) {
        // launchctl returns error if already started/stopped — treat as success
        const msg = err?.stderr || err?.message || '';
        if (
            (action === 'start' && msg.includes('already bootstrapped')) ||
            (action === 'stop' &&
                (msg.includes('No such process') ||
                    msg.includes('Could not find specified service') ||
                    msg.includes('Could not find service')))
        ) {
            return res.status(200).json({ success: true, agentId, action, note: 'Already in that state' });
        }

        console.error(`Agent control error [${action} ${agentId}]:`, msg);
        return res.status(500).json({ error: msg });
    }
}
