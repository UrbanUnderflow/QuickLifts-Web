import { Handler } from '@netlify/functions';
import OpenAI from 'openai';

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

const LEADS_PER_API_CALL = 200; // Process 200 leads per OpenAI API call (reduced to avoid timeouts)
const MAX_EXECUTION_TIME_MS = 24000; // 24 seconds - leave buffer before Netlify timeout (26s limit)
const OPENAI_TIMEOUT_MS = 10000; // 10 second timeout for OpenAI API calls

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
    // Initialize Firebase Admin - require inside handler to avoid top-level issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initializeFirebaseAdmin, admin } = require('./config/firebase');
    
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

    let body: RequestBody;
    try {
      body = JSON.parse(event.body || '{}') as RequestBody;
    } catch (parseError: any) {
      console.error('[massage-lead-column] JSON parse error:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body', detail: parseError.message }),
      };
    }

    const { listId, sourceColumn, sourceColumns, newColumnName, prompt } = body;

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

    // Check for missing columns - if any are missing, we'll use generic fallback
    const missingColumns = columns.filter(col => !currentColumns.includes(col));
    const validColumns = columns.filter(col => currentColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log(`[massage-lead-column] Warning: Some source columns not found: ${missingColumns.join(', ')}. Will use generic fallback for those.`);
    }
    
    // If no valid columns exist, we can't proceed
    if (validColumns.length === 0 && columns.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: `None of the source columns exist in list: ${columns.join(', ')}`,
          hint: 'Please select columns that exist in your lead list, or the function will generate generic hooks for missing data.'
        }),
      };
    }

    // Check if column already exists - if it does, we'll update existing values (skip ones with values)
    const columnExists = currentColumns.includes(newColumnName);
    if (!columnExists) {
      // Only add to columns list if it's a new column
      // For existing columns, we'll just update the values
    }

    // Fetch all leads for this list
    let leadsSnapshot;
    try {
      leadsSnapshot = await db.collection('lead-list-items')
        .where('listId', '==', listId)
        .get();
    } catch (queryError: any) {
      console.error('[massage-lead-column] Error fetching leads:', queryError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch leads', detail: queryError.message }),
      };
    }

    const leads = leadsSnapshot.docs.map(doc => ({
      id: doc.id,
      ref: doc.ref,
      data: doc.data().data as Record<string, string>,
    }));

    console.log(`[massage-lead-column] Processing ${leads.length} leads for list ${listId}`);

    const startTime = Date.now();
    let processedCount = 0;
    let errorCount = 0;
    const errors: { leadId: string; error: string }[] = [];

    // Filter out leads that already have a value in the new column (skip if value exists)
    let skippedCount = 0;
    let processedCountBeforeFilter = 0;
    
    const leadsToProcess = leads.filter(lead => {
      // Access the value from the nested data structure
      const existingValue = lead.data?.[newColumnName];
      
      // More strict check: skip if value exists and is not empty/whitespace
      const hasValue = existingValue !== undefined && 
                      existingValue !== null && 
                      String(existingValue).trim() !== '';
      
      if (hasValue) {
        skippedCount++;
        // Debug: log first few skipped leads
        if (skippedCount <= 5) {
          console.log(`[massage-lead-column] SKIPPING lead ${lead.id} - has value: "${existingValue}" (type: ${typeof existingValue})`);
        }
        return false; // Skip this lead - it already has a value
      }
      
      processedCountBeforeFilter++;
      // Debug: log first few leads to process
      if (processedCountBeforeFilter <= 5) {
        console.log(`[massage-lead-column] WILL PROCESS lead ${lead.id} - no value (value: ${existingValue}, type: ${typeof existingValue})`);
      }
      return true; // Process this lead - no value exists
    });

    if (skippedCount > 0) {
      console.log(`[massage-lead-column] ✅ Filtered out ${skippedCount} leads that already have values in "${newColumnName}"`);
    }
    console.log(`[massage-lead-column] ✅ ${leadsToProcess.length} leads need processing (${skippedCount} skipped, ${leads.length} total)`);
    
    // Verify filtering worked - check a sample
    if (leadsToProcess.length > 0) {
      const sampleLead = leadsToProcess[0];
      const sampleValue = sampleLead.data[newColumnName];
      console.log(`[massage-lead-column] ✅ Sample lead to process - ID: ${sampleLead.id}, "${newColumnName}" value:`, sampleValue, `(should be empty/null/undefined)`);
    } else {
      console.log(`[massage-lead-column] ⚠️  No leads to process! All ${leads.length} leads already have values.`);
    }

    // Process in batches of 1000 leads per API call
    for (let i = 0; i < leadsToProcess.length; i += LEADS_PER_API_CALL) {
      // Check if we're approaching timeout before processing this batch
      let elapsedTime = Date.now() - startTime;
      if (elapsedTime > MAX_EXECUTION_TIME_MS) {
        console.log(`[massage-lead-column] Approaching timeout, stopping at ${processedCount}/${leadsToProcess.length} leads`);
        
        // Update the list's columns array to include the new column (even if partial, only if new)
        if (!columnExists) {
          const updatedColumns = [...currentColumns];
          if (!updatedColumns.includes(newColumnName)) {
            updatedColumns.push(newColumnName);
            await db.collection('lead-lists').doc(listId).update({
              columns: updatedColumns,
              updatedAt: new Date(),
            });
          }
        } else {
          await db.collection('lead-lists').doc(listId).update({
            updatedAt: new Date(),
          });
        }

        const alreadyProcessed = leads.length - leadsToProcess.length;
        const totalProcessed = alreadyProcessed + processedCount;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            partial: true,
            processedCount: totalProcessed,
            errorCount,
            totalLeads: leads.length,
            remainingLeads: leadsToProcess.length - processedCount,
            newColumnName,
            message: `Processed ${totalProcessed} of ${leads.length} leads. Run the transformation again to continue processing the remaining ${leadsToProcess.length - processedCount} leads.`,
            errors: errors.slice(0, 10),
          }),
        };
      }

      const batch = leadsToProcess.slice(i, i + LEADS_PER_API_CALL);
      const batchNumber = Math.floor(i / LEADS_PER_API_CALL) + 1;
      const totalBatches = Math.ceil(leadsToProcess.length / LEADS_PER_API_CALL);
      
      console.log(`[massage-lead-column] Processing batch ${batchNumber}/${totalBatches} with ${batch.length} leads`);

      // Build input data for all leads in this batch
      const batchInputData: Array<{ leadId: string; leadRef: any; inputData: Record<string, string>; hasData: boolean; hasValidColumns: boolean }> = [];
      
      for (const lead of batch) {
        const inputData: Record<string, string> = {};
        let hasAnyData = false;
        let hasValidColumnData = false;
        
        // Only use valid columns that exist
        validColumns.forEach(col => {
          const value = lead.data[col] || '';
          inputData[col] = value;
          if (value.trim()) {
            hasAnyData = true;
            hasValidColumnData = true;
          }
        });
        
        batchInputData.push({
          leadId: lead.id,
          leadRef: lead.ref,
          inputData,
          hasData: hasAnyData,
          hasValidColumns: hasValidColumnData,
        });
      }

      // Separate leads: those with valid column data, those with no data, and those needing generic hooks
      const leadsWithValidData = batchInputData.filter(item => item.hasValidColumns);
      const leadsNeedingGenericHook = batchInputData.filter(item => !item.hasValidColumns && item.hasData);
      const leadsWithoutData = batchInputData.filter(item => !item.hasData);

      let transformedValues: string[] = [];
      let genericHooks: string[] = [];

      // Process leads with valid column data
      if (leadsWithValidData.length > 0) {
        // Check timeout before making API call
        elapsedTime = Date.now() - startTime;
        if (elapsedTime > MAX_EXECUTION_TIME_MS) {
          console.log(`[massage-lead-column] Approaching timeout before API call, stopping at ${processedCount}/${leadsToProcess.length} leads`);
          
          // Update the list's columns array (only if new column)
          if (!columnExists) {
            const updatedColumns = [...currentColumns];
            if (!updatedColumns.includes(newColumnName)) {
              updatedColumns.push(newColumnName);
              await db.collection('lead-lists').doc(listId).update({
                columns: updatedColumns,
                updatedAt: new Date(),
              });
            }
          } else {
            await db.collection('lead-lists').doc(listId).update({
              updatedAt: new Date(),
            });
          }

          const alreadyProcessed = leads.length - leadsToProcess.length;
          const totalProcessed = alreadyProcessed + processedCount;

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              partial: true,
              processedCount: totalProcessed,
              errorCount,
              totalLeads: leads.length,
              remainingLeads: leadsToProcess.length - processedCount,
              newColumnName,
              message: `Approaching timeout. Processed ${totalProcessed} of ${leads.length} leads. Run again to continue processing the remaining ${leadsToProcess.length - processedCount} leads.`,
              errors: errors.slice(0, 10),
            }),
          };
        }

        try {
          // Build input text for all leads with valid data
          const inputText = leadsWithValidData.map((item, index) => {
            const leadInput = validColumns.length === 1
              ? item.inputData[validColumns[0]]
              : validColumns.map(col => `${col}: "${item.inputData[col]}"`).join('\n');
            return `LEAD ${index + 1}:\n${leadInput}`;
          }).join('\n\n');

          // Add timeout wrapper for OpenAI API call
          const apiCallPromise = openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are a data transformation assistant. You will receive multiple leads and must transform each one according to the instructions.

CRITICAL RULES:
- You must return a JSON object with a "values" key containing an array with exactly ${leadsWithValidData.length} strings
- Each string in the array corresponds to the transformed value for LEAD 1, LEAD 2, etc. in order
- Output ONLY the transformed text for each lead, nothing else
- Do not include quotes, labels, or explanations in the individual values
- Keep responses concise and direct
- If the input is empty or unclear, output an empty string for that lead
- The response must be valid JSON: {"values": ["value1", "value2", "value3", ...]}`,
              },
              {
                role: 'user',
                content: `Transform the following ${leadsWithValidData.length} leads according to the instructions:

${inputText}

INSTRUCTIONS: ${prompt}

Return a JSON object with a "values" array containing ${leadsWithValidData.length} strings, one for each lead in order. Example: {"values": ["transformed value 1", "transformed value 2", ...]}`,
              },
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
            max_tokens: 2000, // Increased for multiple responses
          });

          // Add timeout to OpenAI API call
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('OpenAI API call timed out')), OPENAI_TIMEOUT_MS)
          );

          const completion = await Promise.race([apiCallPromise, timeoutPromise]) as any;

          const responseContent = completion.choices[0]?.message?.content?.trim() || '';
          
          // Try to parse as JSON array or JSON object
          try {
            const parsed = JSON.parse(responseContent);
            
            // Handle different response formats
            if (Array.isArray(parsed)) {
              transformedValues = parsed.map(v => String(v || '').trim());
            } else if (typeof parsed === 'object' && parsed.values) {
              transformedValues = Array.isArray(parsed.values) 
                ? parsed.values.map((v: any) => String(v || '').trim())
                : [];
            } else if (typeof parsed === 'object') {
              // Try to extract array from object
              const keys = Object.keys(parsed).sort();
              transformedValues = keys.map(key => String(parsed[key] || '').trim());
            } else {
              throw new Error('Unexpected response format');
            }

            // Ensure we have the right number of values
            if (transformedValues.length !== leadsWithValidData.length) {
              console.warn(`[massage-lead-column] Expected ${leadsWithValidData.length} values, got ${transformedValues.length}. Padding with empty strings.`);
              while (transformedValues.length < leadsWithValidData.length) {
                transformedValues.push('');
              }
              transformedValues = transformedValues.slice(0, leadsWithValidData.length);
            }
          } catch (parseError: any) {
            console.error('[massage-lead-column] Error parsing JSON response:', parseError);
            console.error('[massage-lead-column] Response content:', responseContent);
            // Fallback: treat as array of empty strings
            transformedValues = new Array(leadsWithValidData.length).fill('');
            errorCount += leadsWithValidData.length;
            leadsWithValidData.forEach((item, idx) => {
              errors.push({
                leadId: item.leadId,
                error: `Failed to parse response: ${parseError.message}`,
              });
            });
          }
        } catch (apiError: any) {
          console.error(`[massage-lead-column] Error in API call for batch ${batchNumber}:`, apiError);
          console.error(`[massage-lead-column] Error type: ${apiError.name}, message: ${apiError.message}`);
          
          // If timeout, return early with partial results
          if (apiError.message?.includes('timed out') || apiError.message?.includes('timeout')) {
            console.log(`[massage-lead-column] OpenAI API timeout for batch ${batchNumber}, returning partial results`);
            
            // Update the list's columns array (only if new column)
            if (!columnExists) {
              const updatedColumns = [...currentColumns];
              if (!updatedColumns.includes(newColumnName)) {
                updatedColumns.push(newColumnName);
                await db.collection('lead-lists').doc(listId).update({
                  columns: updatedColumns,
                  updatedAt: new Date(),
                });
              }
            } else {
              await db.collection('lead-lists').doc(listId).update({
                updatedAt: new Date(),
              });
            }

            const alreadyProcessed = leads.length - leadsToProcess.length;
            const totalProcessed = alreadyProcessed + processedCount;

            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                success: true,
                partial: true,
                processedCount: totalProcessed,
                errorCount,
                totalLeads: leads.length,
                remainingLeads: leadsToProcess.length - processedCount,
                newColumnName,
                message: `OpenAI API timeout. Processed ${totalProcessed} of ${leads.length} leads. Run again to continue processing the remaining ${leadsToProcess.length - processedCount} leads.`,
                errors: errors.slice(0, 10),
              }),
            };
          }
          
          // Mark all leads in this batch as failed
          transformedValues = new Array(leadsWithValidData.length).fill('');
          errorCount += leadsWithValidData.length;
          leadsWithValidData.forEach((item) => {
            errors.push({
              leadId: item.leadId,
              error: apiError.message || 'API call failed',
            });
          });
        }
      }

      // Generate generic personalized hooks for leads missing the source columns
      if (leadsNeedingGenericHook.length > 0) {
        console.log(`[massage-lead-column] Generating ${leadsNeedingGenericHook.length} generic hooks for leads with missing source columns`);
        
        try {
          const genericPrompt = `Create a personalized email hook (8-15 words) that will be inserted into this outreach email:

"Hi {{firstName}},
I came across {{companyName}} and liked what I saw. [PERSONALIZATION_HOOK].
I'm the founder of Pulse, a platform helping studios, gyms, and corporations, build and engage community. Think what run club has done in real life, digitally."

Since we don't have specific company data for these leads, create a generic but still personalized hook that:
- Is warm and engaging
- Connects to community, engagement, or growth themes
- Sounds authentic and conversational
- Works for any company in the fitness/wellness/community space
- Is 8-15 words

Return a JSON object with a "values" array containing ${leadsNeedingGenericHook.length} different generic hooks. Each should be slightly varied but follow the same theme.`;

          // Add timeout wrapper for generic hooks API call
          const genericApiCallPromise = openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are a data transformation assistant. Generate personalized email hooks when specific company data is not available.

CRITICAL RULES:
- You must return a JSON object with a "values" key containing an array with exactly ${leadsNeedingGenericHook.length} strings
- Each string should be a unique, slightly varied generic hook (8-15 words)
- All hooks should be warm, engaging, and relevant to community/engagement themes
- Keep responses concise and direct
- The response must be valid JSON: {"values": ["hook1", "hook2", "hook3", ...]}`,
              },
              {
                role: 'user',
                content: genericPrompt,
              },
            ],
            temperature: 0.7, // Higher temperature for variety in generic hooks
            response_format: { type: 'json_object' },
            max_tokens: 1000,
          });

          const genericTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('OpenAI API call timed out')), OPENAI_TIMEOUT_MS)
          );

          const genericCompletion = await Promise.race([genericApiCallPromise, genericTimeoutPromise]) as any;

          const genericResponseContent = genericCompletion.choices[0]?.message?.content?.trim() || '';
          
          try {
            const parsed = JSON.parse(genericResponseContent);
            
            if (parsed.values && Array.isArray(parsed.values)) {
              genericHooks = parsed.values.map((v: any) => String(v || '').trim());
            } else {
              throw new Error('Unexpected response format');
            }

            // Ensure we have the right number of hooks
            if (genericHooks.length !== leadsNeedingGenericHook.length) {
              console.warn(`[massage-lead-column] Expected ${leadsNeedingGenericHook.length} generic hooks, got ${genericHooks.length}. Reusing hooks.`);
              while (genericHooks.length < leadsNeedingGenericHook.length) {
                genericHooks.push(...genericHooks.slice(0, leadsNeedingGenericHook.length - genericHooks.length));
              }
              genericHooks = genericHooks.slice(0, leadsNeedingGenericHook.length);
            }
          } catch (parseError: any) {
            console.error('[massage-lead-column] Error parsing generic hooks response:', parseError);
            // Fallback: use a default generic hook for all
            genericHooks = new Array(leadsNeedingGenericHook.length).fill('Your focus on building community really stands out.');
          }
        } catch (apiError: any) {
          console.error(`[massage-lead-column] Error generating generic hooks:`, apiError);
          // Fallback: use a default generic hook
          genericHooks = new Array(leadsNeedingGenericHook.length).fill('Your focus on building community really stands out.');
        }
      }

      // Combine all leads, maintaining order: valid data -> generic hooks -> empty
      const allTransformedValues: Array<{ ref: any; value: string }> = [];
      let validDataIndex = 0;
      let genericHookIndex = 0;
      
      for (const item of batchInputData) {
        if (item.hasValidColumns) {
          // Use transformed value from valid columns
          allTransformedValues.push({
            ref: item.leadRef,
            value: transformedValues[validDataIndex] || '',
          });
          validDataIndex++;
        } else if (item.hasData && !item.hasValidColumns) {
          // Use generic hook for leads with data but missing source columns
          allTransformedValues.push({
            ref: item.leadRef,
            value: genericHooks[genericHookIndex] || 'Your focus on building community really stands out.',
          });
          genericHookIndex++;
        } else {
          // No data at all - empty value
          allTransformedValues.push({
            ref: item.leadRef,
            value: '',
          });
        }
      }

      // Update Firestore for all leads in this batch
      const firestoreBatch = db.batch();
      let batchUpdates = 0;

      for (const { ref, value } of allTransformedValues) {
        const lead = leadsToProcess.find(l => l.ref === ref);
        if (lead) {
          // Double-check: verify this lead doesn't already have a value
          const existingValue = lead.data?.[newColumnName];
          if (existingValue !== undefined && existingValue !== null && String(existingValue).trim() !== '') {
            console.warn(`[massage-lead-column] ⚠️  Skipping update for lead ${lead.id} - already has value: "${existingValue}"`);
            continue; // Skip this lead - it already has a value
          }
          
          const currentData = lead.data || {};
          firestoreBatch.update(ref, {
            data: {
              ...currentData,
              [newColumnName]: value,
            },
          });
          batchUpdates++;
          processedCount++;
        }
      }

      if (batchUpdates > 0) {
        await firestoreBatch.commit();
        console.log(`[massage-lead-column] Committed ${batchUpdates} updates for batch ${batchNumber}`);
      }

      console.log(`[massage-lead-column] Completed batch ${batchNumber}/${totalBatches}, total: ${processedCount}/${leadsToProcess.length}`);
      
      // Check timeout after each batch
      elapsedTime = Date.now() - startTime;
      if (elapsedTime > MAX_EXECUTION_TIME_MS) {
        console.log(`[massage-lead-column] Timeout approaching, stopping at batch ${batchNumber}`);
        
        // Update the list's columns array to include the new column (even if partial, only if new)
        if (!columnExists) {
          const updatedColumns = [...currentColumns];
          if (!updatedColumns.includes(newColumnName)) {
            updatedColumns.push(newColumnName);
            await db.collection('lead-lists').doc(listId).update({
              columns: updatedColumns,
              updatedAt: new Date(),
            });
          }
        } else {
          await db.collection('lead-lists').doc(listId).update({
            updatedAt: new Date(),
          });
        }

        const alreadyProcessed = leads.length - leadsToProcess.length;
        const totalProcessed = alreadyProcessed + processedCount;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            partial: true,
            processedCount: totalProcessed,
            errorCount,
            totalLeads: leads.length,
            remainingLeads: leadsToProcess.length - processedCount,
            newColumnName,
            message: `Processed ${totalProcessed} of ${leads.length} leads before timeout. Run the transformation again to continue processing the remaining ${leadsToProcess.length - processedCount} leads.`,
            errors: errors.slice(0, 10),
          }),
        };
      }
    }

    // Update the list's columns array to include the new column (only if it's new)
    if (!columnExists) {
      const updatedColumns = [...currentColumns, newColumnName];
      await db.collection('lead-lists').doc(listId).update({
        columns: updatedColumns,
        updatedAt: new Date(),
      });
    } else {
      // Just update the timestamp for existing columns
      await db.collection('lead-lists').doc(listId).update({
        updatedAt: new Date(),
      });
    }

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
  } catch (error: any) {
    console.error('[massage-lead-column] Unhandled error:', error);
    console.error('[massage-lead-column] Error stack:', error?.stack);
    console.error('[massage-lead-column] Error name:', error?.name);
    console.error('[massage-lead-column] Error message:', error?.message);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to transform column',
        detail: error instanceof Error ? error.message : String(error),
        type: error?.name || 'UnknownError',
      }),
    };
  }
};

export { handler };
