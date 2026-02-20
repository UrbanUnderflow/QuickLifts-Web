import type { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
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
        private_key_id: '***REMOVED***',
        private_key: '***REMOVED***',
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
            if (!snap.exists || snap.data()?.status !== 'active') {
                return res.status(200).json({ message: 'No active mission to pause.' });
            }
            await missionRef.update({
                status: 'paused',
                pausedAt: new Date(),
                updatedAt: new Date(),
            });
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
