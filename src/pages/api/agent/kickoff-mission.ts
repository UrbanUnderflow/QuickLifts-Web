import type { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * POST /api/agent/kickoff-mission
 * Body: { force?: boolean }
 *
 * Starts the autonomous mission engine:
 *  1. Reads the North Star
 *  2. Generates agent task assignments via GPT-4o
 *  3. Creates tasks in Firestore
 *  4. Kicks off a group chat briefing
 *  5. Sets mission status to 'active'
 *
 * GET /api/agent/kickoff-mission
 * Returns current mission status.
 *
 * DELETE /api/agent/kickoff-mission
 * Pauses/stops the active mission.
 */

function getDb() {
    const SERVICE_ACCOUNT = {
        type: 'service_account' as const,
        project_id: 'quicklifts-dd3f1',
        private_key_id: 'abbd015806ef3b43d93101522f12d029e736f447',
        private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDEZkOP1Kz/jfQc\nLrN2SKLVdRNCZHGHN+wcfqQXknnD47Y6GBA35O1573Ipk5FaRNvxysB/YP/Z9dLP\nOO/xk8yRA+FFI32kzQlBIpVHDVN/upfXRWS/38+1kktPD3EjwEFRB8HvYVopCm1k\nCaFOZZfrrHM2IEdboKDt3ByLoNNPLZhivcurhBm4PENNEVlyMiqqWBwTu0sFGkZ8\nLHQ4JGtaPe5VomlpVlokKmdQzEwVTWexSeQkbdXnYkd1m/sfT3mjP6RLBlXlJ4f/\nOp36QofqPxNRV7TJ/YkrL2nOLo6gq6XWS3ciVINUS9cuPlEIg+5OrR4eQUYhay3N\n5dakXn+ZAgMBAAECggEAJv+de9KB1a8E4ZG+bgbnWpaIT/8s8eo/Vrso70tVJXoy\nhZ+gnNC2/Sb4VtwoGTIiMIWPqtuCgm/HQAGw15n/HW6VTUrKWK6kH0x0MuspAOx2\n2Ta81kLldksJ7DWHRE+ZSLNPJa8BnbOl3B7zamNPAuu35vAK611eh0zVWD6Dpy1v\n7933i/pOMpvDY0ieoT0pl0GJcCVOBTS2f8z1+huepW5++G0TrTCZdq9ixCF68xEc\nyGTr1Dz/Qdv4gIO2SNk3TfKmw/HaL3tQM1izdMsJVs+nPxzmHj3tLnppyQJJFwcF\nZ1njhg6eSHPOINU/wu2KL2B+pXiROBLQr1JnvJsCZwKBgQDsYNrmbDhShYeU+OSs\nSaQx0POBeZFtlsMIbJomTSDr73Gn4ZXJaXfNoqvIuJel5SCTytK36Y+84/S3xeuy\nmXGMpfqBmEilMU5D4VOmSH/HFH6+35m1LWFw3aWSVGuUSIEQoWTKjWB9zQVwFd5w\nEw6HsuNm1IJvsEfZpzXpcydBMwKBgQDUs9cLfY93MbkT5M/WL9jbPp846HZxvzeW\nGiBR7gMAPMre32DPDKQKqnRVAvXJPhd8mKjC3T4gRm+NBWKLQjIUO0RQoVG39HN/\n9yGBTyLMccJf5d9MZe5OIwkVhbN5ekPucNhqHJQEIVz0duZ7UhFgfgLSroy/04vA\ndjgGeGxUAwKBgD+9Pkm0FNvrtcut8bujf+sO9RqMtXJfnOfAoTCCy8XTI0qpwcI1\n9mA05S2S2RGa31X68yc0i9Xbgjmr3Qqj5cKPXyVi8vPYf8o+EFheZFZCaIr/sGry\nebv9iJAUw42Qn3zkiFE2HjbN+hFnVDvUZ66fxkIMO7/yQO2n8RmqO4ORAoGAFbqV\nglf+WvfaZ1zdmoziw2r/Swn8Z5xYKl5a5OPCrLiJJQF+20f4ThqhrbmSsE9GiPTz\ncIy3dwabCLX/HijSAt0XGoGQXpF7Zxww8QvLi0UnzTIngJ99G8BagjdZYVSLMgWX\nJifrOwzJeTPYUcrNeaUF1s38FPCgezXYfVi6AE8CgYEAv+9EP3q6zY51CMtXKb04\n1yLrnZze20aUMmAQ0KE1nH9ZRk7GgT+Bbmq1Nw6Ro3xItPffX42S5w8jDhiZJK/j\neVGloaXM9MHG2uTPWSVlUJ2ew2LcYpq42PbJUuS06teFFPohMCOs7urTc0Vdya5u\ngTynFJmBFslLO3UKNPAshn0=\n-----END PRIVATE KEY-----\n',
        client_email: 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com',
        client_id: '111494077667496751062',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com',
        universe_domain: 'googleapis.com',
    };
    const existing = getApps().find(a => a.name === 'mission-api');
    const adminApp = existing || initializeApp({ credential: cert(SERVICE_ACCOUNT as any) }, 'mission-api');
    return getFirestore(adminApp);
}

const RUNNER_AGENT_IDS = ['nora', 'scout', 'solara', 'sage'];
const execAsync = promisify(exec);

async function setRunnersEnabled(db: ReturnType<typeof getFirestore>, enabled: boolean, reason: string) {
    const now = new Date();
    await Promise.all(
        RUNNER_AGENT_IDS.map((agentId) => {
            const patch: Record<string, any> = {
                runnerEnabled: enabled,
                runnerEnabledAt: now,
                runnerEnabledReason: reason,
                updatedAt: now,
            };

            // Push immediate UI-safe state on pause so agents do not appear "working"
            // while their runners are shutting down.
            if (!enabled) {
                patch.status = 'offline';
                patch.notes = 'Mission paused — waiting for resume.';
                patch.currentTask = '';
                patch.currentTaskId = '';
                patch.taskProgress = 0;
                patch.currentStepIndex = -1;
                patch.executionSteps = [];
            } else {
                patch.status = 'idle';
                patch.notes = 'Mission resumed — runner re-enabled.';
            }

            return db.collection('agent-presence').doc(agentId).set(patch, { merge: true });
        })
    );
}

async function setRunnerServicesState(action: 'start' | 'stop') {
    const uid = process.getuid?.() ?? 501;
    const commands = RUNNER_AGENT_IDS.map((agentId) => {
        const plistPath = `${process.env.HOME}/Library/LaunchAgents/com.quicklifts.agent.${agentId}.plist`;
        if (action === 'start') {
            return `launchctl bootstrap gui/${uid} "${plistPath}"`;
        }
        return `launchctl bootout gui/${uid} "${plistPath}"`;
    });

    await Promise.all(commands.map(async (command) => {
        try {
            await execAsync(command);
        } catch (err: any) {
            const msg = String(err?.stderr || err?.message || '');
            if (
                msg.includes('already bootstrapped') ||
                msg.includes('No such process') ||
                msg.includes('Could not find specified service') ||
                msg.includes('Could not find service')
            ) {
                return;
            }
            throw err;
        }
    }));
}

async function stopStrayAgentRunners() {
    try {
        const { stdout } = await execAsync(`pgrep -af "node scripts/agentRunner.js" || true`);
        const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean);
        const pids = lines
            .map((line) => Number(line.split(/\s+/)[0]))
            .filter((pid) => Number.isFinite(pid) && pid > 1 && pid !== process.pid);

        if (pids.length === 0) return;

        await Promise.all(pids.map(async (pid) => {
            try { await execAsync(`kill -TERM ${pid}`); } catch (_) { }
        }));

        await new Promise((resolve) => setTimeout(resolve, 1200));

        const { stdout: afterTerm } = await execAsync(`pgrep -af "node scripts/agentRunner.js" || true`);
        const remaining = afterTerm
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .map((line) => Number(line.split(/\s+/)[0]))
            .filter((pid) => Number.isFinite(pid) && pid > 1 && pid !== process.pid);

        if (remaining.length > 0) {
            await Promise.all(remaining.map(async (pid) => {
                try { await execAsync(`kill -KILL ${pid}`); } catch (_) { }
            }));
        }
    } catch (_) {
        // Non-fatal: launchd/presence controls still apply.
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const db = getDb();
    const missionRef = db.doc('company-config/mission-status');

    /* ── GET: Return mission status ── */
    if (req.method === 'GET') {
        try {
            const snap = await missionRef.get();
            if (!snap.exists) {
                return res.status(200).json({ status: 'idle', missionId: null });
            }
            return res.status(200).json(snap.data());
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    /* ── DELETE: Pause mission ── */
    if (req.method === 'DELETE') {
        try {
            const snap = await missionRef.get();
            if (!snap.exists) {
                await missionRef.set({
                    status: 'paused',
                    pausedAt: new Date(),
                    updatedAt: new Date(),
                }, { merge: true });
                await setRunnersEnabled(db, false, 'mission-paused');
                await setRunnerServicesState('stop');
                await stopStrayAgentRunners();
                return res.status(200).json({ success: true, message: 'Mission pause enforced.' });
            }
            if (snap.data()?.status !== 'active') {
                // Idempotent enforcement path: mission may already be paused, but we still
                // need to push runner/presence shutdown state in case it drifted.
                await setRunnersEnabled(db, false, 'mission-paused');
                await setRunnerServicesState('stop');
                await stopStrayAgentRunners();
                return res.status(200).json({ success: true, message: 'Mission already paused — runner shutdown re-enforced.' });
            }
            await missionRef.update({
                status: 'paused',
                pausedAt: new Date(),
                updatedAt: new Date(),
            });
            await setRunnersEnabled(db, false, 'mission-paused');
            await setRunnerServicesState('stop');
            await stopStrayAgentRunners();
            return res.status(200).json({ success: true, message: 'Mission paused.' });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    /* ── POST: Launch mission ── */
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { force = false } = req.body || {};

    const scriptPath = path.resolve(process.cwd(), 'scripts/kickoffMission.js');
    if (!fs.existsSync(scriptPath)) {
        return res.status(500).json({ error: `kickoffMission.js not found at: ${scriptPath}` });
    }

    const args = [scriptPath];
    if (force) args.push('--force');

    try {
        // Prevent duplicate worker pools before we start mission services.
        await stopStrayAgentRunners();

        // Ensure all runners are explicitly re-enabled before mission kickoff.
        await setRunnersEnabled(db, true, 'mission-start');
        await setRunnerServicesState('start');

        const child = spawn('node', args, {
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: process.cwd(),
            env: {
                ...process.env,
                // Mission kickoff should use OpenClaw OAuth by default.
                USE_OPENCLAW: process.env.USE_OPENCLAW ?? 'true',
            },
        });

        let stderr = '';
        let stdout = '';
        child.stdout?.on('data', (d) => { stdout += d.toString(); });
        child.stderr?.on('data', (d) => { stderr += d.toString(); });

        const result = await Promise.race([
            new Promise<{ status: 'started' }>((resolve) => {
                setTimeout(() => {
                    child.stdout?.removeAllListeners();
                    child.stderr?.removeAllListeners();
                    child.unref();
                    resolve({ status: 'started' });
                }, 8000);
            }),
            new Promise<{ status: 'crashed'; code: number | null; error: string }>((resolve) => {
                child.on('exit', (code) => {
                    resolve({ status: 'crashed', code, error: stderr || stdout || `Exit ${code}` });
                });
            }),
            new Promise<{ status: 'error'; error: string }>((resolve) => {
                child.on('error', (err) => {
                    resolve({ status: 'error', error: err.message });
                });
            }),
        ]);

        if (result.status === 'started') {
            return res.status(200).json({
                success: true,
                message: 'Mission strategy roundtable started',
                pid: child.pid,
                note: 'Agents are moving to the round table for planning. Tasks are assigned after the strategy round.',
            });
        } else if (result.status === 'crashed') {
            return res.status(500).json({
                error: 'Mission kickoff script crashed',
                details: (result as any).error?.substring(0, 500),
            });
        } else {
            return res.status(500).json({
                error: 'Failed to start mission kickoff',
                details: (result as any).error,
            });
        }
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
}
