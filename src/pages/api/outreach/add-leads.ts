import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';

const adminDb = admin.firestore();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { campaignId, leads } = req.body;

        if (!campaignId || !leads || !Array.isArray(leads) || leads.length === 0) {
            return res.status(400).json({ error: 'campaignId and a non-empty leads array are required' });
        }

        console.log(`[Outreach Campaign] Adding ${leads.length} leads to campaign "${campaignId}"`);

        // Check campaign
        const campaignRef = adminDb.collection('outreach_campaigns').doc(campaignId);
        const campDoc = await campaignRef.get();
        if (!campDoc.exists) {
            return res.status(404).json({ error: 'Campaign does not exist' });
        }

        const BATCH_SIZE = 500; // Firestore limit per batch
        let assignedCount = 0;
        let failedCount = 0;

        for (let i = 0; i < leads.length; i += BATCH_SIZE) {
            const batchLeads = leads.slice(i, i + BATCH_SIZE);
            const writeBatch = adminDb.batch();

            batchLeads.forEach((lead) => {
                if (!lead.id) return;
                const leadRef = adminDb.collection('fitnessSeeker_leads').doc(lead.id);
                writeBatch.update(leadRef, {
                    outreachCampaignId: campaignId,
                    verificationStatus: 'pending'
                });
                assignedCount++;
            });

            try {
                await writeBatch.commit();
            } catch (err: any) {
                console.error(`[Outreach Campaign] Failed to commit batch update at offset ${i}:`, err);
                failedCount += batchLeads.length;
            }
        }

        // Increment the totalLead counter securely using FieldValue.increment
        await campaignRef.update({
            totalLeads: admin.firestore.FieldValue.increment(assignedCount),
            updatedAt: new Date().toISOString()
        });

        return res.status(200).json({
            success: true,
            assignedCount,
            failedCount
        });

    } catch (error: any) {
        console.error('[Outreach Campaign] Error adding leads:', error);
        return res.status(500).json({ error: error.message || 'Failed to add leads to campaign' });
    }
}

// Increase serverless limits for potentially heavy payloads
export const config = {
    api: {
        responseLimit: false,
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};
