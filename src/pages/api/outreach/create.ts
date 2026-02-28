import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';

const adminDb = admin.firestore();

const DEFAULT_CAMPAIGN_SETTINGS = {
    dailyLimit: 30,
    scheduleFrom: '08:00',
    scheduleTo: '13:00',
    scheduleDays: [1, 2, 3, 4, 5],
    timezone: 'America/Detroit',
    stopOnReply: true,
    stopOnAutoReply: false,
    linkTracking: false,
    openTracking: true,
    textOnly: true
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { campaignName, targetGender, targetLevel, targetMinScore, targetMinCalorieReq } = req.body;

        if (!campaignName) {
            return res.status(400).json({ error: 'campaignName is required' });
        }

        console.log(`[Outreach Campaign] Creating empty campaign "${campaignName}"`);

        // 1. Create the new campaign metadata document
        const campaignRef = adminDb.collection('outreach_campaigns').doc();
        const campaignId = campaignRef.id;

        await campaignRef.set({
            id: campaignId,
            title: campaignName,
            targetGender: targetGender || 'all',
            targetLevel: targetLevel || 'all',
            targetMinScore: targetMinScore || '',
            targetMinCalorieReq: typeof targetMinCalorieReq === 'number' ? targetMinCalorieReq : 0,
            totalLeads: 0,
            verifiedLeads: 0,
            failedLeads: 0,
            pushedLeads: 0,
            status: 'pending_verification',
            deployStatus: 'planned',
            emailSequences: [],
            campaignSettings: DEFAULT_CAMPAIGN_SETTINGS,
            sendingEmail: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        // Return the response immediately
        return res.status(200).json({
            success: true,
            campaign: {
                id: campaignId,
                title: campaignName,
                targetGender: targetGender || 'all',
                targetLevel: targetLevel || 'all',
                targetMinScore: targetMinScore || '',
                targetMinCalorieReq: typeof targetMinCalorieReq === 'number' ? targetMinCalorieReq : 0,
                totalLeads: 0,
                status: 'pending_verification'
            }
        });

    } catch (error: any) {
        console.error('[Outreach Campaign] Error creating:', error);
        return res.status(500).json({ error: error.message || 'Failed to create campaign' });
    }
}
