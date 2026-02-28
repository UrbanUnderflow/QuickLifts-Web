import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';

const adminDb = admin.firestore();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { campaignName, leads } = req.body;

        if (!campaignName || !leads || !Array.isArray(leads) || leads.length === 0) {
            return res.status(400).json({ error: 'campaignName and a non-empty leads array are required' });
        }

        console.log(`[Outreach Campaign] Creating campaign "${campaignName}" with ${leads.length} leads`);

        // 1. Create the new campaign metadata document
        const campaignRef = adminDb.collection('outreach_campaigns').doc();
        const campaignId = campaignRef.id;

        await campaignRef.set({
            id: campaignId,
            title: campaignName,
            totalLeads: leads.length,
            verifiedLeads: 0,
            failedLeads: 0,
            pushedLeads: 0,
            status: 'pending_verification',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        // 2. Update all selected leads with the new campaign ID and pending status
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
                    verificationStatus: 'pending' // pending, valid, invalid
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

        // Return the response immediately
        return res.status(200).json({
            success: true,
            campaignId,
            assignedCount,
            failedCount
        });

    } catch (error: any) {
        console.error('[Outreach Campaign] Error creating:', error);
        return res.status(500).json({ error: error.message || 'Failed to create campaign' });
    }
}

// Increase serverless limits
export const config = {
    api: {
        responseLimit: false,
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};
