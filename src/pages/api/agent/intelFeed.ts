import type { NextApiRequest, NextApiResponse } from 'next';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../api/firebase/config';

interface IntelPayload {
  agentId: string;
  agentName?: string;
  emoji?: string;
  headline: string;
  summary: string;
  impact?: string;
  urgency?: 'routine' | 'priority' | 'urgent';
  sources?: Array<{ label: string; url?: string }>;
  nextAction?: string;
  tags?: string[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body as IntelPayload;
    if (!payload.agentId || !payload.headline || !payload.summary) {
      return res.status(400).json({ error: 'Missing required fields (agentId, headline, summary).' });
    }

    await addDoc(collection(db, 'intel-feed'), {
      agentId: payload.agentId,
      agentName: payload.agentName || payload.agentId,
      emoji: payload.emoji || '🧠',
      headline: payload.headline,
      summary: payload.summary,
      impact: payload.impact || '',
      urgency: payload.urgency || 'routine',
      sources: payload.sources || [],
      nextAction: payload.nextAction || '',
      tags: payload.tags || [],
      createdAt: serverTimestamp(),
    });

    return res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('Intel feed publish failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to publish intel entry' });
  }
}
