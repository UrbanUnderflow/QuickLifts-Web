import { Handler } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';

interface ColumnMapping {
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}

interface RequestBody {
  listId: string;
  campaignId: string;
  columnMapping: ColumnMapping;
  customVariables: string[];
}

interface InstantlyLead {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  campaign_id: string;
  custom_variables?: Record<string, string>;
}

const BATCH_SIZE = 50; // Instantly recommends batching API calls

const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Check both INSTANTLY_KEY and INSTANTLY_API_KEY for backwards compatibility
  const instantlyApiKey = process.env.INSTANTLY_KEY || process.env.INSTANTLY_API_KEY;
  if (!instantlyApiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'INSTANTLY_KEY or INSTANTLY_API_KEY not configured in environment variables' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}') as RequestBody;
    const { listId, campaignId, columnMapping, customVariables = [] } = body;

    if (!listId || !campaignId || !columnMapping?.email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: listId, campaignId, columnMapping.email' }),
      };
    }

    const db = await getFirestore();

    // Verify the list exists
    const listDoc = await db.collection('lead-lists').doc(listId).get();
    if (!listDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Lead list not found' }),
      };
    }

    // Fetch all leads for this list
    const leadsSnapshot = await db.collection('lead-list-items')
      .where('listId', '==', listId)
      .get();

    const leads = leadsSnapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data().data as Record<string, string>,
    }));

    console.log(`[push-leads-to-instantly] Pushing ${leads.length} leads to campaign ${campaignId}`);

    let successCount = 0;
    let failedCount = 0;
    const errors: { email: string; error: string }[] = [];

    // Process in batches
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);

      // Process each lead in the batch
      const results = await Promise.allSettled(
        batch.map(async (lead) => {
          const email = lead.data[columnMapping.email];

          if (!email || !isValidEmail(email)) {
            throw new Error('Invalid or missing email');
          }

          // Build the Instantly lead payload
          const instantlyLead: InstantlyLead = {
            email: email.toLowerCase().trim(),
            campaign_id: campaignId,
          };

          // Add optional fields
          if (columnMapping.firstName && lead.data[columnMapping.firstName]) {
            instantlyLead.first_name = lead.data[columnMapping.firstName].trim();
          }
          if (columnMapping.lastName && lead.data[columnMapping.lastName]) {
            instantlyLead.last_name = lead.data[columnMapping.lastName].trim();
          }
          if (columnMapping.companyName && lead.data[columnMapping.companyName]) {
            instantlyLead.company_name = lead.data[columnMapping.companyName].trim();
          }

          // Add custom variables
          if (customVariables.length > 0) {
            instantlyLead.custom_variables = {};
            for (const varName of customVariables) {
              if (lead.data[varName]) {
                instantlyLead.custom_variables[varName] = lead.data[varName];
              }
            }
          }

          // Push to Instantly API v2
          const response = await fetch('https://api.instantly.ai/api/v2/leads', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${instantlyApiKey}`,
            },
            body: JSON.stringify(instantlyLead),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[push-leads-to-instantly] Instantly API error for ${email}:`, errorBody);
            throw new Error(`Instantly API error: ${response.status} - ${errorBody}`);
          }

          return { email, success: true };
        })
      );

      // Count successes and failures
      for (const result of results) {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failedCount++;
          const leadIndex = results.indexOf(result);
          errors.push({
            email: batch[leadIndex]?.data[columnMapping.email] || 'unknown',
            error: result.reason?.message || 'Unknown error',
          });
        }
      }

      console.log(`[push-leads-to-instantly] Batch ${Math.floor(i / BATCH_SIZE) + 1} complete. Success: ${successCount}, Failed: ${failedCount}`);

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < leads.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`[push-leads-to-instantly] Complete. Success: ${successCount}, Failed: ${failedCount}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        successCount,
        failedCount,
        totalLeads: leads.length,
        campaignId,
        errors: errors.slice(0, 10), // Only return first 10 errors
      }),
    };
  } catch (error) {
    console.error('[push-leads-to-instantly] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to push leads to Instantly',
      }),
    };
  }
};

// Simple email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export { handler };
