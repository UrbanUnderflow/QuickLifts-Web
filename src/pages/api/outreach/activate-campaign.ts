import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';

const adminDb = admin.firestore();
const INSTANTLY_KEY = process.env.INSTANTLY_KEY || process.env.INSTANTLY_API_KEY;

/**
 * Activate or pause an Instantly campaign.
 * 
 * POST /api/outreach/activate-campaign
 * Body: { campaignId: string, action: 'activate' | 'pause' }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!INSTANTLY_KEY) {
        return res.status(500).json({ error: 'INSTANTLY_KEY not configured' });
    }

    const { campaignId, action } = req.body;

    if (!campaignId) {
        return res.status(400).json({ error: 'campaignId is required' });
    }

    if (!action || !['activate', 'pause'].includes(action)) {
        return res.status(400).json({ error: 'action must be "activate" or "pause"' });
    }

    try {
        const campRef = adminDb.collection('outreach_campaigns').doc(campaignId);
        const campDoc = await campRef.get();

        if (!campDoc.exists) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const campData = campDoc.data()!;
        const instantlyCampaignId = campData.instantlyCampaignId;

        if (!instantlyCampaignId) {
            return res.status(400).json({
                error: 'Campaign has no Instantly campaign ID. Deploy the campaign first.'
            });
        }

        const endpoint = action === 'activate'
            ? `https://api.instantly.ai/api/v2/campaigns/${instantlyCampaignId}/activate`
            : `https://api.instantly.ai/api/v2/campaigns/${instantlyCampaignId}/pause`;

        console.log(`[Campaign Control] ${action} campaign ${instantlyCampaignId}`);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${INSTANTLY_KEY}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Campaign Control] Instantly ${action} failed: ${response.status} - ${errorText}`);
            return res.status(500).json({
                error: `Failed to ${action} campaign: ${response.status} - ${errorText}`
            });
        }

        const result = await response.json();
        console.log(`[Campaign Control] Successfully ${action}d campaign ${instantlyCampaignId}`);

        // Update Firestore with the new campaign status
        const firestoreUpdate: any = {
            updatedAt: new Date().toISOString()
        };

        if (action === 'activate') {
            firestoreUpdate.campaignActive = true;
            firestoreUpdate.activatedAt = new Date().toISOString();
        } else {
            firestoreUpdate.campaignActive = false;
            firestoreUpdate.pausedAt = new Date().toISOString();
        }

        await campRef.update(firestoreUpdate);

        return res.status(200).json({
            success: true,
            action,
            instantlyCampaignId,
            message: `Campaign ${action}d successfully`,
            instantlyResponse: result
        });

    } catch (error: any) {
        console.error(`[Campaign Control] Fatal error:`, error);
        return res.status(500).json({ error: error.message || 'Unknown error' });
    }
}
