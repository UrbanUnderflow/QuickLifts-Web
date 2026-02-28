import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    try {
        if (process.env.FIREBASE_SECRET_KEY) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: "quicklifts-dd3f1",
                    privateKey: process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
                    clientEmail: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
                })
            });
        }
    } catch (error) {
        console.error('Firebase admin init error:', error);
    }
}

const db = admin.firestore();
const INSTANTLY_KEY = process.env.INSTANTLY_KEY || process.env.INSTANTLY_API_KEY;

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    if (!event.body) return { statusCode: 400, body: 'Missing body' };

    if (!INSTANTLY_KEY) {
        console.error("INSTANTLY_KEY is missing from environment");
        return { statusCode: 500, body: 'Missing INSTANTLY_KEY' };
    }

    let bodyData;
    try {
        bodyData = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: 'Invalid JSON' };
    }

    const { campaignId, instantlyCampaignId } = bodyData;
    if (!campaignId || !instantlyCampaignId) {
        return { statusCode: 400, body: 'Missing campaignId or instantlyCampaignId' };
    }

    try {
        console.log(`[Instantly Push Background] Starting push for staging campaign ${campaignId} into Instantly ${instantlyCampaignId}`);

        // Fetch campaign
        const campRef = db.collection('outreach_campaigns').doc(campaignId);
        const campDoc = await campRef.get();
        if (!campDoc.exists) return { statusCode: 404, body: 'Campaign not found' };

        await campRef.update({
            status: 'pushing',
            instantlyCampaignId: instantlyCampaignId
        });

        // Fetch only VALID verified leads from this campaign
        const leadsSnap = await db.collection('fitnessSeeker_leads')
            .where('outreachCampaignId', '==', campaignId)
            .where('verificationStatus', '==', 'valid')
            .get();

        console.log(`[Instantly Push Background] Found ${leadsSnap.size} valid leads to push`);

        let pushedCount = campDoc.data()?.pushedLeads || 0;
        let pushLogs: string[] = campDoc.data()?.pushLogs || [];

        const addLog = (msg: string) => {
            const timeStr = new Date().toLocaleTimeString();
            const fullMsg = `[${timeStr}] ${msg}`;
            pushLogs.push(fullMsg);
            console.log(`[Instantly Push] ${msg}`);
        };

        addLog(`Started push for ${leadsSnap.size} valid leads to Instantly ID: ${instantlyCampaignId}`);

        // Process in small parallel chunks to respect Instantly rate limits and endpoints
        const BATCH_SIZE = 50;
        const docs = leadsSnap.docs;

        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            const batchDocs = docs.slice(i, i + BATCH_SIZE);

            const results = await Promise.allSettled(
                batchDocs.map(async (docSnap) => {
                    const lead = docSnap.data();
                    if (!lead.email) throw new Error('Missing email');

                    const v2Payload = {
                        campaign: instantlyCampaignId,
                        email: lead.email.toLowerCase().trim(),
                        first_name: lead.name ? lead.name.split(' ')[0] : '',
                        last_name: lead.name && lead.name.includes(' ') ? lead.name.split(' ').slice(1).join(' ') : '',
                        custom_variables: {
                            goal: lead.goal || '',
                            focusArea: lead.focusArea || '',
                            weight: lead.weight ? `${lead.weight}` : '',
                            calorieReq: lead.calorieReq ? `${lead.calorieReq}` : '',
                            gender: lead.gender || '',
                            level: lead.level || ''
                        }
                    };

                    const response = await fetch('https://api.instantly.ai/api/v2/leads', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${INSTANTLY_KEY}`
                        },
                        body: JSON.stringify(v2Payload),
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`API error: ${response.status} - ${errorText}`);
                    }

                    return true;
                })
            );

            // Tally successes natively
            const batchSuccessCount = results.filter(r => r.status === 'fulfilled').length;
            pushedCount += batchSuccessCount;

            // Log any errors natively
            const failedBatch = results.filter(r => r.status === 'rejected');
            if (failedBatch.length > 0) {
                const firstErrorMsg = (failedBatch[0] as PromiseRejectedResult).reason;
                addLog(`Batch ${(i / BATCH_SIZE) + 1} failed ${failedBatch.length} leads. First Error: ${firstErrorMsg}`);
            }

            if (batchSuccessCount > 0) {
                addLog(`Batch ${(i / BATCH_SIZE) + 1} pushed ${batchSuccessCount} leads successfully.`);
            }

            // Sync doc progressively so UI updates
            await campRef.update({
                pushedLeads: pushedCount,
                pushLogs: pushLogs.length > 200 ? pushLogs.slice(-200) : pushLogs
            });

            // Add a small delay between batches to respect instantly rate limits
            if (i + BATCH_SIZE < docs.length) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        // Complete
        addLog(`Finished pushing to ${campaignId}. Total Pushed: ${pushedCount}`);
        await campRef.update({
            status: 'completed',
            pushedLeads: pushedCount,
            pushLogs,
            updatedAt: new Date().toISOString()
        });

        return { statusCode: 200, body: 'Push complete' };
    } catch (error: any) {
        console.error('[Instantly Push Background] Fatal error:', error);
        db.collection('outreach_campaigns').doc(campaignId).update({
            status: 'ready_to_push',
            pushLogs: admin.firestore.FieldValue.arrayUnion(`[FATAL ERROR] ${error.message || 'Unknown crash'}`)
        }).catch(() => { });
        return { statusCode: 500, body: 'Fatal error' };
    }
};
