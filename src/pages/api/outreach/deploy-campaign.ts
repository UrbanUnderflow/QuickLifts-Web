import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';

const adminDb = admin.firestore();
const INSTANTLY_KEY = process.env.INSTANTLY_KEY || process.env.INSTANTLY_API_KEY;
const FALLBACK_SITE_URL = 'https://quicklifts-dd3f1.netlify.app';

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
}

function normalizeBaseUrl(rawBaseUrl?: string) {
    if (!rawBaseUrl) return FALLBACK_SITE_URL;
    if (rawBaseUrl.startsWith('http://') || rawBaseUrl.startsWith('https://')) {
        return rawBaseUrl;
    }
    return `https://${rawBaseUrl}`;
}

function extractCampaignId(payload: any): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const directId = typeof payload.id === 'string' ? payload.id : null;
    const nestedId = typeof payload.campaign?.id === 'string' ? payload.campaign.id : null;
    return directId || nestedId;
}

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
        const sequences: EmailSequence[] = campData.emailSequences;
        const settings: CampaignSettings = campData.campaignSettings;
        const sendingEmail: string = campData.sendingEmail;

        const markDeployFailed = async (errorMessage: string, statusCode = 500) => {
            await campRef.update({
                deployStatus: 'deploy_failed',
                deployError: errorMessage
            });
            return res.status(statusCode).json({ error: errorMessage });
        };

        if (!sequences || sequences.length === 0) {
            return markDeployFailed('Campaign has no email sequences configured', 400);
        }
        if (!settings) {
            return markDeployFailed('Campaign has no settings configured', 400);
        }
        if (!sendingEmail) {
            return markDeployFailed('Campaign has no sending email configured', 400);
        }

        // If we already have an Instantly campaign and failed mid-deploy, resume from push.
        const existingInstantlyId = campData.instantlyCampaignId;
        const deployStatus = campData.deployStatus;
        const isRetryFromPush =
            !!existingInstantlyId &&
            (deployStatus === 'deploy_failed' || deployStatus === 'campaign_created' || deployStatus === 'pushing_leads');

        let instantlyCampaignId = existingInstantlyId;

        // =============================
        // PHASE A: Create Instantly Campaign (skip if retrying from push failure)
        // =============================
        if (!isRetryFromPush) {
            await campRef.update({ deployStatus: 'deploying', deployError: admin.firestore.FieldValue.delete() });

            // Build Instantly sequence steps from our email plan
            const instantlySteps = sequences.map((seq, index) => ({
                type: 'email',
                delay: seq.delayDays,
                delay_unit: 'days',
                pre_delay_unit: 'days',
                variants: [{
                    subject: index === 0 ? seq.subject : '', // Only first email gets subject; rest are reply-thread
                    body: `<div>${seq.body.replace(/\n/g, '</div><div>')}</div>`
                }]
            }));

            // Build schedule from settings
            const scheduleDaysMap: Record<number, boolean> = {};
            settings.scheduleDays.forEach(day => { scheduleDaysMap[day] = true; });

            const instantlyPayload: any = {
                name: campData.title,
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
                email_list: [sendingEmail],
                // Declare custom variables so Instantly knows to resolve them
                custom_variables: {
                    goal: true,
                    focusArea: true,
                    weight: true,
                    calorieReq: true,
                    gender: true,
                    level: true
                }
            };

            try {
                const createResponse = await fetch('https://api.instantly.ai/api/v2/campaigns', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${INSTANTLY_KEY}`
                    },
                    body: JSON.stringify(instantlyPayload)
                });

                if (!createResponse.ok) {
                    const errorText = await createResponse.text();
                    return markDeployFailed(`Failed to create Instantly campaign: ${createResponse.status} - ${errorText}`);
                }

                const createResult = await createResponse.json();
                instantlyCampaignId = extractCampaignId(createResult);

                if (!instantlyCampaignId) {
                    return markDeployFailed('Instantly campaign created response did not include a campaign ID');
                }

                await campRef.update({
                    deployStatus: 'campaign_created',
                    instantlyCampaignId
                });

                console.log(`[Deploy] Instantly campaign created: ${instantlyCampaignId}`);
            } catch (error: any) {
                await campRef.update({
                    deployStatus: 'deploy_failed',
                    deployError: `Network error creating Instantly campaign: ${error.message}`
                });
                return res.status(500).json({ error: error.message });
            }
        }

        if (!instantlyCampaignId) {
            return markDeployFailed('Missing Instantly campaign ID; cannot push leads');
        }

        // =============================
        // PHASE B: Trigger Lead Push
        // =============================
        await campRef.update({
            deployStatus: 'pushing_leads',
            deployError: admin.firestore.FieldValue.delete()
        });

        try {
            // Determine the correct base URL for the background function
            const baseUrl = normalizeBaseUrl(process.env.URL || process.env.DEPLOY_URL || process.env.SITE_URL);

            const pushResponse = await fetch(`${baseUrl}/.netlify/functions/push-outreach-campaign-background`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    campaignId,
                    instantlyCampaignId
                })
            });

            if (!pushResponse.ok) {
                const errorText = await pushResponse.text();
                const errorMessage = `Campaign created in Instantly but lead push failed: ${pushResponse.status} - ${errorText}`;
                await campRef.update({
                    deployStatus: 'deploy_failed',
                    deployError: errorMessage
                });
                return res.status(500).json({
                    error: errorMessage,
                    instantlyCampaignId
                });
            }

            console.log(`[Deploy] Lead push triggered for campaign ${campaignId}`);
            return res.status(200).json({
                success: true,
                instantlyCampaignId,
                message: 'Campaign deployed and lead push started'
            });

        } catch (error: any) {
            await campRef.update({
                deployStatus: 'deploy_failed',
                deployError: `Campaign created (${instantlyCampaignId}) but lead push trigger failed: ${error.message}`
            });
            return res.status(500).json({
                error: 'Campaign created but push trigger failed',
                instantlyCampaignId
            });
        }

    } catch (error: any) {
        console.error('[Deploy Campaign] Fatal error:', error);
        return res.status(500).json({ error: error.message || 'Unknown error' });
    }
}

export const config = {
    api: {
        responseLimit: false,
        bodyParser: { sizeLimit: '2mb' }
    }
};
