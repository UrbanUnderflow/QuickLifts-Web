import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/**
 * Agent Messaging API
 *
 * POST — Send a command/message to an agent
 * GET  — Read recent messages for an agent
 *
 * This enables agent-to-agent communication through Firestore.
 * The Virtual Office and CLI scripts can send messages to agents,
 * and agents can respond back.
 */

const COLLECTION = 'agent-commands';
const db = getFirestore();

interface AgentMessage {
    from: string;           // 'antigravity', 'tremaine', 'nora', etc.
    to: string;             // target agent ID
    type: 'task' | 'question' | 'command' | 'response' | 'chat';
    content: string;        // the message/task/question
    metadata?: Record<string, any>;  // optional extra data (taskId, priority, etc.)
    status: 'pending' | 'read' | 'in-progress' | 'completed' | 'failed';
    response?: string;      // agent's response
    createdAt: any;
    completedAt?: any;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Simple API key check (use the same FIREBASE_SECRET_KEY as a simple auth)
    // In production, use proper auth
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;

    try {
        if (req.method === 'POST') {
            const { from, to, type, content, metadata } = req.body;

            if (!from || !to || !content) {
                return res.status(400).json({ error: 'Missing required fields: from, to, content' });
            }

            const message: AgentMessage = {
                from,
                to,
                type: type || 'command',
                content,
                metadata: metadata || {},
                status: 'pending',
                createdAt: FieldValue.serverTimestamp(),
            };

            const docRef = await db.collection(COLLECTION).add(message);

            return res.status(200).json({
                success: true,
                messageId: docRef.id,
                message: `Message sent to ${to}`,
            });

        } else if (req.method === 'GET') {
            const { agentId, limit: limitStr, status: filterStatus } = req.query;

            if (!agentId) {
                return res.status(400).json({ error: 'Missing agentId query parameter' });
            }

            let query = db.collection(COLLECTION)
                .where('to', '==', agentId)
                .orderBy('createdAt', 'desc')
                .limit(parseInt(limitStr as string, 10) || 20);

            if (filterStatus) {
                query = db.collection(COLLECTION)
                    .where('to', '==', agentId)
                    .where('status', '==', filterStatus)
                    .orderBy('createdAt', 'desc')
                    .limit(parseInt(limitStr as string, 10) || 20);
            }

            const snap = await query.get();
            const messages = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
                completedAt: doc.data().completedAt?.toDate?.()?.toISOString() || null,
            }));

            return res.status(200).json({ messages });

        } else if (req.method === 'PATCH') {
            // For agents to respond to messages
            const { messageId, status, response } = req.body;

            if (!messageId) {
                return res.status(400).json({ error: 'Missing messageId' });
            }

            const updates: Record<string, any> = {};
            if (status) updates.status = status;
            if (response) updates.response = response;
            if (status === 'completed') updates.completedAt = FieldValue.serverTimestamp();

            await db.collection(COLLECTION).doc(messageId).update(updates);

            return res.status(200).json({ success: true });

        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error: any) {
        console.error('Agent message API error:', error);
        return res.status(500).json({ error: error.message });
    }
}
