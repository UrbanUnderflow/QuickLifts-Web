import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';

const adminDb = admin.firestore();
const INSTANTLY_KEY = process.env.INSTANTLY_KEY || process.env.INSTANTLY_API_KEY;

interface EmailSequence {
    subject: string;
    body: string;
    delayDays: number;
}

interface CampaignSettings {
    dailyLimit: number;
    scheduleFrom: string;
    scheduleTo: string;
    scheduleDays: number[];
    timezone: string;
    stopOnReply: boolean;
    stopOnAutoReply: boolean;
    linkTracking: boolean;
    openTracking: boolean;
    textOnly: boolean;
    slowRampUp?: boolean;
    slowRampUpIncrement?: number;
}

/**
 * Syncs email sequences + campaign settings from Firestore → Instantly.
 * Uses PATCH /v2/campaigns/{id} to push sequences, schedule, and options
 * to an already-created Instantly campaign.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!INSTANTLY_KEY) {
        return res.status(500).json({ error: 'INSTANTLY_KEY not configured' });
    }

    const { campaignId } = req.body;
    if (!campaignId) {
        return res.status(400).json({ error: 'campaignId is required' });
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
            return res.status(400).json({ error: 'Campaign has no Instantly campaign ID. Deploy the campaign first.' });
        }

        const sequences: EmailSequence[] = campData.emailSequences;
        const settings: CampaignSettings = campData.campaignSettings;
        const sendingEmail: string = campData.sendingEmail;

        if (!sequences || sequences.length === 0) {
            return res.status(400).json({ error: 'Campaign has no email sequences configured' });
        }
        if (!settings) {
            return res.status(400).json({ error: 'Campaign has no settings configured' });
        }

        // Build Instantly sequence steps from our email plan
        const instantlySteps = sequences.map((seq, index) => ({
            type: 'email',
            delay: index === 0 ? 0 : seq.delayDays,
            delay_unit: 'days',
            variants: [{
                subject: index === 0 ? seq.subject : '', // Only first email gets subject; rest are reply-thread
                body: `<div>${seq.body.replace(/\n/g, '</div><div>')}</div>`
            }]
        }));

        // Build schedule from settings
        const scheduleDaysMap: Record<number, boolean> = {};
        settings.scheduleDays.forEach(day => { scheduleDaysMap[day] = true; });

        // PATCH the Instantly campaign with updated sequences + settings
        const patchPayload: any = {
            sequences: [{
                steps: instantlySteps
            }],
            campaign_schedule: {
                schedules: [{
                    name: 'Campaign Schedule',
                    timing: {
                        from: settings.scheduleFrom,
                        to: settings.scheduleTo
                    },
                    days: scheduleDaysMap,
                    timezone: settings.timezone
                }]
            },
            daily_limit: settings.dailyLimit,
            stop_on_reply: settings.stopOnReply,
            stop_on_auto_reply: settings.stopOnAutoReply,
            link_tracking: settings.linkTracking,
            open_tracking: settings.openTracking,
            text_only: settings.textOnly,
            first_email_text_only: settings.textOnly,
            slow_ramp_up: settings.slowRampUp ?? true,
            slow_ramp_up_increment: settings.slowRampUpIncrement ?? 2,
            custom_variables: {
                goal: true,
                focusArea: true,
                weight: true,
                calorieReq: true,
                gender: true,
                level: true
            }
        };

        // Include sending email if present
        if (sendingEmail) {
            patchPayload.email_list = [sendingEmail];
        }

        console.log(`[Sync Settings] PATCHing Instantly campaign ${instantlyCampaignId} with ${sequences.length} sequences`);

        const patchResponse = await fetch(`https://api.instantly.ai/api/v2/campaigns/${instantlyCampaignId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${INSTANTLY_KEY}`
            },
            body: JSON.stringify(patchPayload)
        });

        if (!patchResponse.ok) {
            const errorText = await patchResponse.text();
            console.error(`[Sync Settings] Instantly PATCH failed: ${patchResponse.status} - ${errorText}`);
            return res.status(500).json({
                error: `Failed to sync settings to Instantly: ${patchResponse.status} - ${errorText}`
            });
        }

        const patchResult = await patchResponse.json();
        console.log(`[Sync Settings] Successfully synced settings for campaign ${instantlyCampaignId}`);

        // Update Firestore to track when settings were last synced
        await campRef.update({
            settingsLastSynced: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        return res.status(200).json({
            success: true,
            instantlyCampaignId,
            message: `Settings synced: ${sequences.length} email sequences, schedule, and options pushed to Instantly`,
            instantlyResponse: patchResult
        });

    } catch (error: any) {
        console.error('[Sync Settings] Fatal error:', error);
        return res.status(500).json({ error: error.message || 'Unknown error' });
    }
}

export const config = {
    api: {
        responseLimit: false,
        bodyParser: { sizeLimit: '2mb' }
    }
};
