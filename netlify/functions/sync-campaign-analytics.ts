import { Handler, HandlerEvent } from '@netlify/functions';
import { admin } from './config/firebase';

const db = admin.firestore();
const INSTANTLY_KEY = process.env.INSTANTLY_KEY || process.env.INSTANTLY_API_KEY;

// Netlify scheduled function: runs every 4 hours
export const config = {
    schedule: "0 */4 * * *"
};

function parseNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function pickNumber(source: Record<string, any> | undefined, keys: string[]): number | null {
    if (!source) return null;
    for (const key of keys) {
        const parsed = parseNumber(source[key]);
        if (parsed !== null) return parsed;
    }
    return null;
}

function normalizeRate(rawRate: number | null): number | null {
    if (rawRate === null) return null;
    return Math.round(rawRate <= 1 ? rawRate * 100 : rawRate);
}

function normalizeAnalytics(apiPayload: any, campaignData: any) {
    const source = typeof apiPayload?.data === 'object' && apiPayload?.data !== null
        ? apiPayload.data
        : apiPayload;

    const totalLeads =
        pickNumber(source, ['total_leads', 'lead_count', 'leads_count', 'sent', 'total_sent']) ??
        parseNumber(campaignData?.pushedLeads) ??
        parseNumber(campaignData?.verifiedLeads) ??
        0;

    const totalOpens = pickNumber(source, ['total_opens', 'opens', 'opened_count', 'open_count']) ?? 0;
    const totalReplies = pickNumber(source, ['total_replies', 'replies', 'reply_count']) ?? 0;
    const totalBounces = pickNumber(source, ['total_bounces', 'bounces', 'bounce_count']) ?? 0;

    const openRateFromApi = normalizeRate(pickNumber(source, ['open_rate', 'openRate']));
    const replyRateFromApi = normalizeRate(pickNumber(source, ['reply_rate', 'replyRate']));

    const openRate = openRateFromApi ?? (totalLeads > 0 ? Math.round((totalOpens / totalLeads) * 100) : 0);
    const replyRate = replyRateFromApi ?? (totalLeads > 0 ? Math.round((totalReplies / totalLeads) * 100) : 0);

    return {
        openRate,
        replyRate,
        totalOpens,
        totalReplies,
        totalBounces,
        lastSynced: new Date().toISOString()
    };
}

function parseRequestedCampaignId(event: HandlerEvent): { campaignId: string | null; invalidJson: boolean } {
    if (!event.body) return { campaignId: null, invalidJson: false };
    try {
        const payload = JSON.parse(event.body);
        if (typeof payload.campaignId !== 'string') return { campaignId: null, invalidJson: false };
        const trimmed = payload.campaignId.trim();
        return { campaignId: trimmed || null, invalidJson: false };
    } catch {
        return { campaignId: null, invalidJson: true };
    }
}

export const handler: Handler = async (event: HandlerEvent) => {
    if (!INSTANTLY_KEY) {
        console.error('[Analytics Sync] Missing INSTANTLY_KEY');
        return { statusCode: 500, body: 'Missing INSTANTLY_KEY' };
    }

    try {
        const { campaignId: requestedCampaignId, invalidJson } = parseRequestedCampaignId(event);

        if (invalidJson) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
        }
        const campaignDocs: FirebaseFirestore.DocumentSnapshot[] = [];

        if (requestedCampaignId) {
            const campaignDoc = await db.collection('outreach_campaigns').doc(requestedCampaignId).get();
            if (!campaignDoc.exists) {
                return { statusCode: 404, body: JSON.stringify({ error: 'Campaign not found' }) };
            }

            const campaignData = campaignDoc.data() || {};
            if (!campaignData.instantlyCampaignId) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Campaign has no Instantly campaign ID' }) };
            }

            campaignDocs.push(campaignDoc);
        } else {
            const campaignsSnap = await db.collection('outreach_campaigns')
                .where('deployStatus', '==', 'deployed')
                .get();
            campaignDocs.push(...campaignsSnap.docs);
        }

        if (campaignDocs.length === 0) {
            console.log('[Analytics Sync] No deployed campaigns to sync');
            return { statusCode: 200, body: JSON.stringify({ synced: 0, total: 0 }) };
        }

        console.log(`[Analytics Sync] Syncing analytics for ${campaignDocs.length} campaign(s)`);

        let syncedCount = 0;
        let failedCount = 0;
        const failures: Array<{ campaignId: string; error: string }> = [];

        for (const campaignDoc of campaignDocs) {
            const campaignData = campaignDoc.data() || {};
            const instantlyCampaignId = campaignData.instantlyCampaignId;

            if (!instantlyCampaignId) continue;

            try {
                const analyticsResponse = await fetch(
                    `https://api.instantly.ai/api/v2/campaigns/${instantlyCampaignId}/analytics`,
                    { headers: { 'Authorization': `Bearer ${INSTANTLY_KEY}` } }
                );

                let analyticsPayload: any;
                if (analyticsResponse.ok) {
                    analyticsPayload = await analyticsResponse.json();
                } else {
                    const detailsResponse = await fetch(
                        `https://api.instantly.ai/api/v2/campaigns/${instantlyCampaignId}`,
                        { headers: { 'Authorization': `Bearer ${INSTANTLY_KEY}` } }
                    );

                    if (!detailsResponse.ok) {
                        const errorMsg = `Instantly fetch failed (${analyticsResponse.status}/${detailsResponse.status})`;
                        throw new Error(errorMsg);
                    }

                    analyticsPayload = await detailsResponse.json();
                }

                const analytics = normalizeAnalytics(analyticsPayload, campaignData);

                await campaignDoc.ref.update({
                    analytics,
                    updatedAt: new Date().toISOString()
                });

                syncedCount++;
            } catch (error: any) {
                failedCount++;
                const errorMessage = error?.message || 'Unknown sync error';
                failures.push({ campaignId: campaignDoc.id, error: errorMessage });
                console.error(`[Analytics Sync] Error syncing ${campaignDoc.id}:`, errorMessage);
            }
        }

        const responseBody = JSON.stringify({
            synced: syncedCount,
            failed: failedCount,
            total: campaignDocs.length,
            failures
        });

        const statusCode = requestedCampaignId && failedCount > 0 ? 500 : 200;
        return { statusCode, body: responseBody };

    } catch (error: any) {
        console.error('[Analytics Sync] Fatal error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Unknown error' }) };
    }
};
