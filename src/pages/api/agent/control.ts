import type { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * POST /api/agent/control
 * Body: { agentId: string; action: 'start' | 'stop' }
 *
 * Controls agent launchd services on the local Mac.
 * - start: launchctl bootstrap the agent plist
 * - stop:  launchctl bootout  the agent plist
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { agentId, action } = req.body;

    if (!agentId || !['start', 'stop'].includes(action)) {
        return res.status(400).json({ error: 'Missing agentId or invalid action (start|stop)' });
    }

    const plistPath = `${process.env.HOME}/Library/LaunchAgents/com.quicklifts.agent.${agentId}.plist`;
    const uid = process.getuid?.() ?? 501;

    try {
        if (action === 'start') {
            await execAsync(`launchctl bootstrap gui/${uid} "${plistPath}"`);
        } else {
            await execAsync(`launchctl bootout gui/${uid} "${plistPath}"`);
        }

        return res.status(200).json({ success: true, agentId, action });
    } catch (err: any) {
        // launchctl returns error if already started/stopped — treat as success
        const msg = err?.stderr || err?.message || '';
        if (msg.includes('already bootstrapped') || msg.includes('No such process') || msg.includes('Could not find specified service')) {
            return res.status(200).json({ success: true, agentId, action, note: 'Already in that state' });
        }

        console.error(`Agent control error [${action} ${agentId}]:`, msg);
        return res.status(500).json({ error: msg });
    }
}
