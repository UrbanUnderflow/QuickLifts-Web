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
}

type JobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed';

const LEADS_PER_API_CALL = 25;
const MAX_BACKGROUND_EXECUTION_TIME_MS = 14 * 60 * 1000; // 14 minutes (background functions can run longer)
const OPENAI_TIMEOUT_MS = 25_000;

const MAX_FIELD_CHARS = 240;
function normalizeFieldValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, MAX_FIELD_CHARS);
}

function hasNonEmptyValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initializeFirebaseAdmin, admin } = require('./config/firebase');
  initializeFirebaseAdmin({ headers: event.headers || {} });
  const db = admin.firestore();

  let body: RequestBody;
  try {
    body = JSON.parse(event.body || '{}') as RequestBody;
  } catch (e: any) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON', detail: e?.message }) };
  }

  const { listId, sourceColumn, sourceColumns, newColumnName, prompt } = body;
  const columns = sourceColumns || (sourceColumn ? [sourceColumn] : []);

  if (!listId || columns.length === 0 || !newColumnName || !prompt?.trim()) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing required fields: listId, sourceColumns (or sourceColumn), newColumnName, prompt' }),
    };
  }

  // Create a job record first so the UI can start polling immediately.
  const jobRef = db.collection('lead-massage-jobs').doc();
  const jobId = jobRef.id;
  const createdAt = new Date();

  await jobRef.set({
    id: jobId,
    status: 'queued' as JobStatus,
    listId,
    sourceColumns: columns,
    newColumnName,
    prompt: prompt.trim(),
    totalLeads: 0,
    processedCount: 0,
    alreadyProcessedCount: 0,
    newlyProcessedCount: 0,
    remainingLeads: 0,
    errorCount: 0,
    errors: [],
    message: 'Job queued',
    createdAt,
    updatedAt: createdAt,
  });

  // Return immediately; the function continues running in the background (Netlify background function).
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  (async () => {
    const startTime = Date.now();

    const failJob = async (message: string, detail?: any) => {
      console.error('[massage-lead-column-job] Job failed:', message, detail || '');
      await jobRef.set(
        {
          status: 'failed' as JobStatus,
          message,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    };

    try {
      if (!openai.apiKey) {
        await failJob('Missing OpenAI API key (OPEN_AI_SECRET_KEY).');
        return;
      }

      await jobRef.set({ status: 'running' as JobStatus, message: 'Job started', updatedAt: new Date() }, { merge: true });

      const listDoc = await db.collection('lead-lists').doc(listId).get();
      if (!listDoc.exists) {
        await failJob('Lead list not found');
        return;
      }

      const listData = listDoc.data();
      const currentColumns: string[] = listData?.columns || [];
      const columnExists = currentColumns.includes(newColumnName);

      const missingColumns = columns.filter((col) => !currentColumns.includes(col));
      const validColumns = columns.filter((col) => currentColumns.includes(col));
      if (missingColumns.length > 0) {
        console.log(`[massage-lead-column-job] Warning: missing source columns: ${missingColumns.join(', ')}`);
      }
      if (validColumns.length === 0) {
        await failJob(`None of the source columns exist in list: ${columns.join(', ')}`);
        return;
      }

      const leadsSnapshot = await db.collection('lead-list-items').where('listId', '==', listId).get();
      const leads = leadsSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ref: doc.ref,
        data: (doc.data().data || {}) as Record<string, string>,
      }));

      const leadsToProcess = leads.filter((lead) => !hasNonEmptyValue(lead.data?.[newColumnName]));
      const alreadyProcessedCount = leads.length - leadsToProcess.length;

      await jobRef.set(
        {
          totalLeads: leads.length,
          alreadyProcessedCount,
          newlyProcessedCount: 0,
          processedCount: alreadyProcessedCount,
          remainingLeads: leadsToProcess.length,
          message: `Processing ${leadsToProcess.length.toLocaleString()} empty leads (${alreadyProcessedCount.toLocaleString()} already had values)`,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      let newlyProcessedCount = 0;
      let errorCount = 0;
      const errors: { leadId: string; error: string }[] = [];

      // Process in batches until complete or time budget is exhausted.
      for (let i = 0; i < leadsToProcess.length; i += LEADS_PER_API_CALL) {
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_BACKGROUND_EXECUTION_TIME_MS) {
          const remaining = Math.max(0, leadsToProcess.length - newlyProcessedCount);
          await jobRef.set(
            {
              status: 'paused' as JobStatus,
              newlyProcessedCount,
              processedCount: alreadyProcessedCount + newlyProcessedCount,
              remainingLeads: remaining,
              errorCount,
              errors: errors.slice(0, 10),
              message: `Paused due to time budget. Updated ${newlyProcessedCount} new leads. Run again to continue.`,
              updatedAt: new Date(),
            },
            { merge: true }
          );
          return;
        }

        const batch = leadsToProcess.slice(i, i + LEADS_PER_API_CALL);
        const batchInputData: Array<{
          leadId: string;
          leadRef: any;
          inputData: Record<string, string>;
          hasData: boolean;
          hasValidColumns: boolean;
        }> = [];

        for (const lead of batch) {
          const inputData: Record<string, string> = {};
          let hasAnyData = false;
          let hasValidColumnData = false;

          validColumns.forEach((col) => {
            const value = normalizeFieldValue(lead.data[col] || '');
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

        const leadsWithValidData = batchInputData.filter((item) => item.hasValidColumns);
        const leadsNeedingGenericHook = batchInputData.filter((item) => !item.hasValidColumns && item.hasData);
        const leadsWithoutData = batchInputData.filter((item) => !item.hasData);

        let transformedValues: string[] = [];
        let genericHooks: string[] = [];

        if (leadsWithValidData.length > 0) {
          const inputText = leadsWithValidData
            .map((item, idx) => {
              const leadInput =
                validColumns.length === 1
                  ? normalizeFieldValue(item.inputData[validColumns[0]])
                  : validColumns.map((col) => `${col}: "${normalizeFieldValue(item.inputData[col])}"`).join('\n');
              return `LEAD ${idx + 1}:\n${leadInput}`;
            })
            .join('\n\n');

          const apiCallPromise = openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are a data transformation assistant.

CRITICAL RULES:
- You must return a JSON object with a "values" key containing an array with exactly ${leadsWithValidData.length} strings
- Each string corresponds to LEAD 1, LEAD 2, ... in order
- Output ONLY the transformed text for each lead, nothing else
- Keep responses concise and direct
- The response must be valid JSON: {"values": ["value1", "value2", ...]}`,
              },
              {
                role: 'user',
                content: `Transform the following ${leadsWithValidData.length} leads:

${inputText}

INSTRUCTIONS: ${prompt.trim()}

Return JSON: {"values": ["value1", "value2", ...]} with exactly ${leadsWithValidData.length} values.`,
              },
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
            max_tokens: 550,
          });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('OpenAI API call timed out')), OPENAI_TIMEOUT_MS)
          );

          const completion = (await Promise.race([apiCallPromise, timeoutPromise])) as any;
          const responseContent = completion.choices[0]?.message?.content?.trim() || '';

          try {
            const parsed = JSON.parse(responseContent);
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed.values)) {
              transformedValues = parsed.values.map((v: any) => String(v || '').trim());
            } else {
              throw new Error('Unexpected response format');
            }

            if (transformedValues.length !== leadsWithValidData.length) {
              while (transformedValues.length < leadsWithValidData.length) transformedValues.push('');
              transformedValues = transformedValues.slice(0, leadsWithValidData.length);
            }
          } catch (e: any) {
            errorCount += leadsWithValidData.length;
            leadsWithValidData.forEach((item) => errors.push({ leadId: item.leadId, error: e?.message || 'Failed to parse model output' }));
            transformedValues = new Array(leadsWithValidData.length).fill('');
          }
        }

        if (leadsNeedingGenericHook.length > 0) {
          const genericPrompt = `Create a personalized email hook (8-15 words) suitable for any company in fitness/wellness/community space.

Return a JSON object with a "values" array containing exactly ${leadsNeedingGenericHook.length} hooks.`;

          try {
            const genericApiCallPromise = openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `Return ONLY valid JSON: {"values": ["hook1", "hook2", ...]} with exactly ${leadsNeedingGenericHook.length} strings.`,
                },
                { role: 'user', content: genericPrompt },
              ],
              temperature: 0.7,
              response_format: { type: 'json_object' },
              max_tokens: 500,
            });

            const genericTimeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('OpenAI API call timed out')), OPENAI_TIMEOUT_MS)
            );

            const genericCompletion = (await Promise.race([genericApiCallPromise, genericTimeoutPromise])) as any;
            const genericResponseContent = genericCompletion.choices[0]?.message?.content?.trim() || '';
            const parsed = JSON.parse(genericResponseContent);
            if (parsed?.values && Array.isArray(parsed.values)) {
              genericHooks = parsed.values.map((v: any) => String(v || '').trim());
            } else {
              genericHooks = new Array(leadsNeedingGenericHook.length).fill('Your focus on building community really stands out.');
            }
          } catch {
            genericHooks = new Array(leadsNeedingGenericHook.length).fill('Your focus on building community really stands out.');
          }
        }

        // Combine in original order.
        const allTransformedValues: Array<{ ref: any; value: string; leadId: string }> = [];
        let validIdx = 0;
        let genericIdx = 0;
        for (const item of batchInputData) {
          if (item.hasValidColumns) {
            allTransformedValues.push({ ref: item.leadRef, value: transformedValues[validIdx] || '', leadId: item.leadId });
            validIdx++;
          } else if (item.hasData && !item.hasValidColumns) {
            allTransformedValues.push({
              ref: item.leadRef,
              value: genericHooks[genericIdx] || 'Your focus on building community really stands out.',
              leadId: item.leadId,
            });
            genericIdx++;
          } else {
            allTransformedValues.push({ ref: item.leadRef, value: '', leadId: item.leadId });
          }
        }

        // Write updates.
        const firestoreBatch = db.batch();
        let batchUpdates = 0;

        for (const { ref, value, leadId } of allTransformedValues) {
          // extra safety: don't overwrite if it was filled by another run
          const leadData = (leads.find((l) => l.id === leadId)?.data || {}) as Record<string, string>;
          if (hasNonEmptyValue(leadData?.[newColumnName])) continue;

          firestoreBatch.update(ref, {
            data: {
              ...leadData,
              [newColumnName]: value,
            },
          });

          batchUpdates++;
        }

        if (batchUpdates > 0) {
          await firestoreBatch.commit();
          newlyProcessedCount += batchUpdates;
        }

        // Update job progress.
        const remaining = Math.max(0, leadsToProcess.length - newlyProcessedCount);
        await jobRef.set(
          {
            newlyProcessedCount,
            processedCount: alreadyProcessedCount + newlyProcessedCount,
            remainingLeads: remaining,
            errorCount,
            errors: errors.slice(0, 10),
            message: remaining > 0 ? `Processing… ${remaining.toLocaleString()} remaining` : 'Finalizing…',
            updatedAt: new Date(),
          },
          { merge: true }
        );
      }

      // Ensure the column exists in the list columns array if it was newly created.
      if (!columnExists) {
        const updatedColumns = [...currentColumns];
        if (!updatedColumns.includes(newColumnName)) updatedColumns.push(newColumnName);
        await db.collection('lead-lists').doc(listId).update({ columns: updatedColumns, updatedAt: new Date() });
      } else {
        await db.collection('lead-lists').doc(listId).update({ updatedAt: new Date() });
      }

      await jobRef.set(
        {
          status: 'completed' as JobStatus,
          newlyProcessedCount,
          processedCount: alreadyProcessedCount + newlyProcessedCount,
          remainingLeads: 0,
          errorCount,
          errors: errors.slice(0, 10),
          message: `Completed. Updated ${newlyProcessedCount.toLocaleString()} new leads.`,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    } catch (e: any) {
      await failJob(e?.message || 'Unhandled job error', e);
    }
  })();

  return {
    statusCode: 202,
    headers,
    body: JSON.stringify({ success: true, jobId }),
  };
};

export { handler };

