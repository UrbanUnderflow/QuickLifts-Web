import { Handler } from '@netlify/functions';
import OpenAI from 'openai';

// Use require for CommonJS module (same as working functions like pulsecheck-chat.js)
const { initializeFirebaseAdmin, admin } = require('./config/firebase');

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY || process.env.OPENAI_API_KEY,
});

interface RequestBody {
  listId: string;
  sourceColumn?: string; // Legacy support
  sourceColumns?: string[]; // New: support multiple columns
  newColumnName: string;
  prompt: string;
  batchSize?: number;
}

const BATCH_SIZE = 20; // Process 20 leads at a time to avoid timeouts

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

  try {
    // Initialize Firebase Admin
    try {
      console.log('[massage-lead-column] Initializing Firebase Admin...');
      initializeFirebaseAdmin({ headers: event.headers || {} });
      console.log('[massage-lead-column] Firebase Admin initialized successfully');
    } catch (firebaseInitError: any) {
      console.error('[massage-lead-column] Firebase initialization error:', firebaseInitError);
      console.error('[massage-lead-column] Error details:', {
        message: firebaseInitError.message,
        stack: firebaseInitError.stack,
        name: firebaseInitError.name
      });
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ 
          error: 'Firebase initialization failed', 
          detail: firebaseInitError.message,
          hint: 'Check that FIREBASE_SECRET_KEY is properly formatted with PEM headers in Netlify environment variables'
        }) 
      };
    }

    // Get fresh db reference after initialization
    let db;
    try {
      db = admin.firestore();
      console.log('[massage-lead-column] Firestore instance obtained');
    } catch (dbError: any) {
      console.error('[massage-lead-column] Error getting Firestore:', dbError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to get Firestore instance', detail: dbError.message })
      };
    }

    const body = JSON.parse(event.body || '{}') as RequestBody;
    const { listId, sourceColumn, sourceColumns, newColumnName, prompt, batchSize = BATCH_SIZE } = body;

    // Support both single column (legacy) and multiple columns (new)
    const columns = sourceColumns || (sourceColumn ? [sourceColumn] : []);
    
    if (!listId || columns.length === 0 || !newColumnName || !prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: listId, sourceColumns (or sourceColumn), newColumnName, prompt' }),
      };
    }

    // Verify the list exists and get current columns
    const listDoc = await db.collection('lead-lists').doc(listId).get();
    if (!listDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Lead list not found' }),
      };
    }

    const listData = listDoc.data();
    const currentColumns = listData?.columns || [];

    // Validate all source columns exist
    const missingColumns = columns.filter(col => !currentColumns.includes(col));
    if (missingColumns.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Source column(s) not found in list: ${missingColumns.join(', ')}` }),
      };
    }

    if (currentColumns.includes(newColumnName)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Column "${newColumnName}" already exists` }),
      };
    }

    // Fetch all leads for this list
    const leadsSnapshot = await db.collection('lead-list-items')
      .where('listId', '==', listId)
      .get();

    const leads = leadsSnapshot.docs.map(doc => ({
      id: doc.id,
      ref: doc.ref,
      data: doc.data().data as Record<string, string>,
    }));

    console.log(`[massage-lead-column] Processing ${leads.length} leads for list ${listId}`);

    let processedCount = 0;
    let errorCount = 0;
    const errors: { leadId: string; error: string }[] = [];

    // Process in batches
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      
      // Process each lead in the batch in parallel
      const results = await Promise.allSettled(
        batch.map(async (lead) => {
          // Build input data from all selected columns
          const inputData: Record<string, string> = {};
          let hasAnyData = false;
          
          columns.forEach(col => {
            const value = lead.data[col] || '';
            inputData[col] = value;
            if (value.trim()) {
              hasAnyData = true;
            }
          });
          
          if (!hasAnyData) {
            // Skip if all columns are empty, just add empty new column
            return { id: lead.id, ref: lead.ref, transformedValue: '' };
          }

          try {
            // Build input text showing all column values
            const inputText = columns.length === 1
              ? inputData[columns[0]]
              : columns.map(col => `${col}: "${inputData[col]}"`).join('\n');

            const completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini', // Use faster, cheaper model for bulk processing
              messages: [
                {
                  role: 'system',
                  content: `You are a data transformation assistant. Your job is to transform text data based on user instructions. 
                  
CRITICAL RULES:
- Output ONLY the transformed text, nothing else
- Do not include quotes, labels, or explanations
- Keep responses concise and direct
- If the input is empty or unclear, output an empty string
- You have access to multiple data columns - use all of them as needed based on the instructions`,
                },
                {
                  role: 'user',
                  content: columns.length === 1
                    ? `Transform this text according to the instructions:

INPUT TEXT: "${inputText}"

INSTRUCTIONS: ${prompt}

OUTPUT:`
                    : `Transform the following data according to the instructions:

INPUT DATA:
${inputText}

INSTRUCTIONS: ${prompt}

OUTPUT:`,
                },
              ],
              temperature: 0.3,
              max_tokens: 150,
            });

            const transformedValue = completion.choices[0]?.message?.content?.trim() || '';
            return { id: lead.id, ref: lead.ref, transformedValue };
          } catch (err) {
            console.error(`[massage-lead-column] Error processing lead ${lead.id}:`, err);
            throw err;
          }
        })
      );

      // Update Firestore for successful transformations
      const firestoreBatch = db.batch();
      let batchUpdates = 0;

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { ref, transformedValue } = result.value;
          const currentData = leads.find(l => l.ref === ref)?.data || {};
          firestoreBatch.update(ref, {
            data: {
              ...currentData,
              [newColumnName]: transformedValue,
            },
          });
          batchUpdates++;
          processedCount++;
        } else {
          errorCount++;
          errors.push({
            leadId: batch[results.indexOf(result)]?.id || 'unknown',
            error: result.reason?.message || 'Unknown error',
          });
        }
      }

      if (batchUpdates > 0) {
        await firestoreBatch.commit();
      }

      console.log(`[massage-lead-column] Processed batch ${Math.floor(i / batchSize) + 1}, total: ${processedCount}/${leads.length}`);
    }

    // Update the list's columns array to include the new column
    const updatedColumns = [...currentColumns, newColumnName];
    await db.collection('lead-lists').doc(listId).update({
      columns: updatedColumns,
      updatedAt: new Date(),
    });

    console.log(`[massage-lead-column] Complete. Processed: ${processedCount}, Errors: ${errorCount}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        processedCount,
        errorCount,
        totalLeads: leads.length,
        newColumnName,
        errors: errors.slice(0, 10), // Only return first 10 errors
      }),
    };
  } catch (error) {
    console.error('[massage-lead-column] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to transform column',
      }),
    };
  }
};

export { handler };
