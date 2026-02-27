import type { NextApiRequest, NextApiResponse } from 'next';

const INSTANTLY_KEY = process.env.INSTANTLY_KEY || process.env.INSTANTLY_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!INSTANTLY_KEY) {
        return res.status(500).json({ error: 'Instantly API Key not configured in environment variables' });
    }

    try {
        const { campaignId, leads } = req.body;

        if (!campaignId || !leads || !Array.isArray(leads) || leads.length === 0) {
            return res.status(400).json({ error: 'campaignId and a non-empty leads array are required' });
        }

        console.log(`[Instantly Push] Starting push of ${leads.length} leads to campaign ${campaignId}`);

        let successCount = 0;
        let failedCount = 0;
        const errors: { email: string; error: string }[] = [];
        const BATCH_SIZE = 50; // Instantly handles rate limits better with small batches

        for (let i = 0; i < leads.length; i += BATCH_SIZE) {
            const batch = leads.slice(i, i + BATCH_SIZE);

            const results = await Promise.allSettled(
                batch.map(async (lead) => {
                    if (!lead.email) throw new Error('Missing email');

                    // Instantly payload format
                    const instantlyPayload = {
                        api_key: INSTANTLY_KEY,
                        campaign_id: campaignId,
                        skip_if_in_workspace: false,
                        leads: [
                            {
                                email: lead.email.toLowerCase().trim(),
                                first_name: lead.name ? lead.name.split(' ')[0] : '',
                                last_name: lead.name && lead.name.includes(' ') ? lead.name.split(' ').slice(1).join(' ') : '',
                                // Pass fitness data as custom variables directly
                                custom_variables: {
                                    goal: lead.goal || '',
                                    focusArea: lead.focusArea || '',
                                    weight: lead.weight ? `${lead.weight}` : '',
                                    calorieReq: lead.calorieReq ? `${lead.calorieReq}` : '',
                                    gender: lead.gender || '',
                                    level: lead.level || ''
                                }
                            }
                        ]
                    };

                    // We use the v1/lead/bulk endpoint as it is designed for mass injection
                    const response = await fetch('https://api.instantly.ai/api/v1/lead/add', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(instantlyPayload),
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Instantly API error: ${response.status} - ${errorText}`);
                    }

                    return { email: lead.email, success: true };
                })
            );

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    successCount++;
                } else {
                    failedCount++;
                    errors.push({
                        email: 'Unknown',
                        error: result.reason?.message || 'Unknown error',
                    });
                }
            }

            console.log(`[Instantly Push] Batch complete. Success: ${successCount}, Failed: ${failedCount}`);

            // Prevent rate limiting (Instantly is strict about concurrent requests)
            if (i + BATCH_SIZE < leads.length) {
                await new Promise(r => setTimeout(r, 800));
            }
        }

        return res.status(200).json({
            success: true,
            pushedCount: successCount,
            failedCount,
            errors: errors.slice(0, 10), // Only return the first 10 errors for brevity
        });

    } catch (error: any) {
        console.error('[Instantly Push] Error:', error);
        return res.status(500).json({ error: error.message || 'Failed to push leads' });
    }
}

// Increase serverless timeout limits given 100k lists could take some time to batch process
export const config = {
    api: {
        responseLimit: false,
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};
