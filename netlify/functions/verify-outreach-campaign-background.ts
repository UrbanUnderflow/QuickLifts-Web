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
const MILLION_VERIFY_KEY = process.env.MILLION_VERIFY_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.BREVO_MARKETING_KEY;

// Brevo mail sender helper
async function notifyAdmin(campaignName: string, verified: number, failed: number) {
    if (!BREVO_API_KEY) return;
    try {
        const adminEmail = process.env.BREVO_SENDER_EMAIL || 'no-reply@fitwithpulse.ai';
        const payload = {
            sender: { email: adminEmail, name: "Pulse Admin" },
            to: [{ email: "tremaine@fitwithpulse.ai", name: "Tremaine" }, { email: "admin@fitwithpulse.ai", name: "Admin" }],
            subject: `✅ Outreach Campaign Verified: ${campaignName}`,
            htmlContent: `
        <h2>Lead Verification Complete!</h2>
        <p>Your outreach campaign staging <strong>${campaignName}</strong> has finished processing emails via MillionVerifier.</p>
        <ul>
          <li><strong>Total Valid/Clean:</strong> ${verified}</li>
          <li><strong>Dead/Spam/Invalid:</strong> <span style="color:red">${failed}</span></li>
        </ul>
        <p>Head to your Pulse Admin dashboard to review and push these leads directly to Instantly.</p>
        <p><a href="https://pulsecheck.fitwithpulse.ai/admin/outreach-campaigns">View Outreach Campaigns Dashboard</a></p>
      `
        };

        await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'api-key': BREVO_API_KEY
            },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error('Failed to send Brevo notify:', e);
    }
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    // We expect { campaignId: "xxx" } in the body
    if (!event.body) return { statusCode: 400, body: 'Missing body' };
    if (!MILLION_VERIFY_KEY) {
        console.error("MILLION_VERIFY_KEY is missing from environment");
        return { statusCode: 500, body: 'Missing MILLION_VERIFY_KEY' };
    }

    let bodyData;
    try {
        bodyData = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: 'Invalid JSON' };
    }

    const campaignId = bodyData.campaignId;
    if (!campaignId) return { statusCode: 400, body: 'Missing campaignId' };

    try {
        console.log(`[Background Verifier] Starting verification for campaign ${campaignId}`);

        // Fetch campaign
        const campRef = db.collection('outreach_campaigns').doc(campaignId);
        const campDoc = await campRef.get();
        if (!campDoc.exists) return { statusCode: 404, body: 'Campaign not found' };

        await campRef.update({ status: 'verifying' });

        // Fetch all leads associated with this campaign that are pending
        const leadsSnap = await db.collection('fitnessSeeker_leads')
            .where('outreachCampaignId', '==', campaignId)
            .where('verificationStatus', '==', 'pending')
            .get();

        console.log(`[Background Verifier] Found ${leadsSnap.size} pending leads`);

        let validCount = campDoc.data()?.verifiedLeads || 0;
        let failCount = campDoc.data()?.failedLeads || 0;

        // We process sequentially or in very small chunks to respect standard API limits and memory limits
        // Background functions can run for 15 minutes.
        const CONCURRENCY = 5;
        const docs = leadsSnap.docs;

        for (let i = 0; i < docs.length; i += CONCURRENCY) {
            const batchDocs = docs.slice(i, i + CONCURRENCY);

            const promises = batchDocs.map(async (docSnap) => {
                const lead = docSnap.data();
                const email = lead.email;
                if (!email) {
                    await docSnap.ref.update({ verificationStatus: 'invalid' });
                    return 'invalid';
                }

                try {
                    // MillionVerifier API call
                    const url = `https://api.millionverifier.com/api/v3/?api=${MILLION_VERIFY_KEY}&email=${encodeURIComponent(email)}&timeout=10`;
                    const mvResp = await fetch(url);
                    const mvData = await mvResp.json();

                    // valid, catch_all -> we usually keep. invalid, disposable -> we trash
                    // For safest delivery, 'ok' is the pristine valid. 'catch_all' is risky. Let's accept 'ok' and 'catch_all'.
                    const result = mvData.result;

                    if (result === 'ok' || result === 'catch_all') {
                        await docSnap.ref.update({ verificationStatus: 'valid' });
                        return 'valid';
                    } else {
                        // invalid, disposable, unknown
                        await docSnap.ref.update({ verificationStatus: 'invalid' });
                        return 'invalid';
                    }
                } catch (e) {
                    console.error(`[Background Verifier] Error checking ${email}:`, e);
                    // If the network or MV fails, we don't want to fail the email permanently. We leave it pending or mark unknown
                    // But to prevent infinite loops, we mark it error_verify
                    await docSnap.ref.update({ verificationStatus: 'error_verify' });
                    return 'error';
                }
            });

            const results = await Promise.all(promises);

            const newlyValid = results.filter(r => r === 'valid').length;
            const newlyFailed = results.filter(r => r === 'invalid' || r === 'error').length;

            validCount += newlyValid;
            failCount += newlyFailed;

            // Update the campaign doc regularly so UI updates
            await campRef.update({
                verifiedLeads: validCount,
                failedLeads: failCount
            });

            console.log(`[Background Verifier] Progress: ${i + batchDocs.length}/${docs.length}`);
        }

        // Complete
        console.log(`[Background Verifier] Finished ${campaignId}. Valid: ${validCount}, Failed: ${failCount}`);
        await campRef.update({
            status: 'ready_to_push',
            verifiedLeads: validCount,
            failedLeads: failCount,
            updatedAt: new Date().toISOString()
        });

        // Notify Tremaine
        await notifyAdmin(campDoc.data()?.title || campaignId, validCount, failCount);

        return { statusCode: 200, body: 'Job complete' };
    } catch (error) {
        console.error('[Background Verifier] Fatal error:', error);
        db.collection('outreach_campaigns').doc(campaignId).update({ status: 'pending_verification' }).catch(() => { });
        return { statusCode: 500, body: 'Fatal error' };
    }
};
