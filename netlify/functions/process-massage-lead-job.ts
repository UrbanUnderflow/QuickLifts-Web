import { Handler } from '@netlify/functions';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
});

type JobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

const LEADS_PER_API_CALL = 75;
const MAX_BACKGROUND_EXECUTION_TIME_MS = 14 * 60 * 1000;
const OPENAI_TIMEOUT_MS = 30_000;

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

  let jobId: string | undefined;
  try {
    const body = JSON.parse(event.body || '{}') as { jobId?: string };
    jobId = body.jobId;
  } catch {
    // noop
  }

  if (!jobId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing jobId' }) };
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initializeFirebaseAdmin, admin } = require('./config/firebase');
  initializeFirebaseAdmin({ headers: event.headers || {} });
  const db = admin.firestore();

  const jobRef = db.collection('lead-massage-jobs').doc(jobId);

  const logJob = async (patch: any) => {
    await jobRef.set(
      {
        ...patch,
        updatedAt: new Date(),
        debug: {
          ...(patch.debug || {}),
          lastHeartbeatAt: new Date(),
        },
      },
      { merge: true }
    );
  };

  const failJob = async (message: string, detail?: any) => {
    console.error('[process-massage-lead-job] Job failed:', message, detail || '');
    await logJob({
      status: 'failed' as JobStatus,
      message,
      debug: { phase: 'failed', lastError: detail?.message || String(detail || '') },
    });
  };

  try {
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Job not found' }) };
    }

    const job = jobDoc.data() || {};
    const listId = job.listId as string | undefined;
    const sourceColumns = (job.sourceColumns || []) as string[];
    const newColumnName = job.newColumnName as string | undefined;
    const prompt = (job.prompt || '') as string;

    if (!listId || sourceColumns.length === 0 || !newColumnName || !prompt.trim()) {
      await failJob('Job configuration is missing required fields.');
      return { statusCode: 200, headers, body: JSON.stringify({ success: false }) };
    }

    if (!openai.apiKey) {
      await failJob('Missing OpenAI API key (OPEN_AI_SECRET_KEY).');
      return { statusCode: 200, headers, body: JSON.stringify({ success: false }) };
    }

    const startTime = Date.now();
    await logJob({ status: 'running' as JobStatus, message: 'Job started', debug: { phase: 'starting' } });

    const listDoc = await db.collection('lead-lists').doc(listId).get();
    if (!listDoc.exists) {
      await failJob('Lead list not found');
      return { statusCode: 200, headers, body: JSON.stringify({ success: false }) };
    }

    const listData = listDoc.data();
    const currentColumns: string[] = listData?.columns || [];
    const columnExists = currentColumns.includes(newColumnName);

    const missingColumns = sourceColumns.filter((col) => !currentColumns.includes(col));
    const validColumns = sourceColumns.filter((col) => currentColumns.includes(col));
    if (validColumns.length === 0) {
      await failJob(`None of the source columns exist in list: ${sourceColumns.join(', ')}`);
      return { statusCode: 200, headers, body: JSON.stringify({ success: false }) };
    }

    await logJob({
      message: missingColumns.length > 0 ? `Missing columns: ${missingColumns.join(', ')}` : 'Validated columns',
      debug: { phase: 'loading_leads' },
    });

    const leadsSnapshot = await db.collection('lead-list-items').where('listId', '==', listId).get();
    const leads = leadsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ref: doc.ref,
      data: (doc.data().data || {}) as Record<string, string>,
    }));

    const leadsToProcess = leads.filter((lead) => !hasNonEmptyValue(lead.data?.[newColumnName]));
    const alreadyProcessedCount = leads.length - leadsToProcess.length;
    const totalBatches = Math.ceil(leadsToProcess.length / LEADS_PER_API_CALL);

    await logJob({
      totalLeads: leads.length,
      alreadyProcessedCount,
      newlyProcessedCount: 0,
      processedCount: alreadyProcessedCount,
      remainingLeads: leadsToProcess.length,
      errorCount: 0,
      errors: [],
      message: `Processing ${leadsToProcess.length.toLocaleString()} empty leads (${alreadyProcessedCount.toLocaleString()} already had values)`,
      debug: { phase: 'running', batchNumber: 0, totalBatches },
    });

    let newlyProcessedCount = 0;
    let errorCount = 0;
    const errors: { leadId: string; error: string }[] = [];

    for (let i = 0; i < leadsToProcess.length; i += LEADS_PER_API_CALL) {
      const jobCheck = (await jobRef.get()).data();
      if (jobCheck?.status === 'cancelled') {
        await logJob({
          message: `Cancelled. Updated ${newlyProcessedCount} new leads before cancellation.`,
          newlyProcessedCount,
          processedCount: alreadyProcessedCount + newlyProcessedCount,
          remainingLeads: Math.max(0, leadsToProcess.length - newlyProcessedCount),
          errorCount,
          errors: errors.slice(0, 10),
          debug: { phase: 'cancelled' },
        });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }

      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_BACKGROUND_EXECUTION_TIME_MS) {
        await logJob({
          status: 'paused' as JobStatus,
          message: `Paused due to time budget. Updated ${newlyProcessedCount} new leads. Run again to continue.`,
          newlyProcessedCount,
          processedCount: alreadyProcessedCount + newlyProcessedCount,
          remainingLeads: Math.max(0, leadsToProcess.length - newlyProcessedCount),
          errorCount,
          errors: errors.slice(0, 10),
          debug: { phase: 'paused' },
        });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }

      const batchNumber = Math.floor(i / LEADS_PER_API_CALL) + 1;
      const batch = leadsToProcess.slice(i, i + LEADS_PER_API_CALL);

      await logJob({
        message: `Processing batch ${batchNumber}/${totalBatches} (${batch.length} leads)…`,
        debug: { phase: 'batch_start', batchNumber, totalBatches },
      });

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
      // leadsWithoutData kept for parity, but we just write empty strings for those.

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

        const t0 = Date.now();
        const apiCallPromise = openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a data transformation assistant.

CRITICAL RULES:
- Return a JSON object with a "values" array of exactly ${leadsWithValidData.length} strings
- Each string corresponds to LEAD 1, LEAD 2, ... in order
- Output ONLY the transformed text; no extra commentary
- Return ONLY valid JSON like {"values":["..."]}`,
            },
            {
              role: 'user',
              content: `Transform the following ${leadsWithValidData.length} leads:

${inputText}

INSTRUCTIONS: ${prompt.trim()}

Return JSON {"values":[...]} with exactly ${leadsWithValidData.length} values.`,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 1600,
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('OpenAI API call timed out')), OPENAI_TIMEOUT_MS)
        );

        let responseContent = '';
        try {
          const completion = (await Promise.race([apiCallPromise, timeoutPromise])) as any;
          responseContent = completion.choices[0]?.message?.content?.trim() || '';
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
          leadsWithValidData.forEach((item) =>
            errors.push({ leadId: item.leadId, error: e?.message || 'Failed to parse model output' })
          );
          transformedValues = new Array(leadsWithValidData.length).fill('');
          await logJob({
            errorCount,
            errors: errors.slice(0, 10),
            debug: { phase: 'openai_error', lastError: e?.message || String(e) },
          });
        } finally {
          const ms = Date.now() - t0;
          await logJob({ debug: { phase: 'openai_done', lastOpenAiMs: ms } });
        }
      }

      if (leadsNeedingGenericHook.length > 0) {
        const genericPrompt = `Create ${leadsNeedingGenericHook.length} different 8-15 word hooks. Return JSON {"values":[...]} only.`;
        try {
          const genericApiCallPromise = openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `Return ONLY valid JSON: {"values": ["hook1", ...]} with exactly ${leadsNeedingGenericHook.length} strings.`,
              },
              { role: 'user', content: genericPrompt },
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' },
            max_tokens: 1500,
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
        } catch (e: any) {
          genericHooks = new Array(leadsNeedingGenericHook.length).fill('Your focus on building community really stands out.');
          await logJob({ debug: { phase: 'generic_openai_error', lastError: e?.message || String(e) } });
        }
      }

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

      const firestoreBatch = db.batch();
      let batchUpdates = 0;

      for (const { ref, value, leadId } of allTransformedValues) {
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
        await logJob({ debug: { phase: 'commit_start', lastBatchUpdates: batchUpdates } });
        await firestoreBatch.commit();
        newlyProcessedCount += batchUpdates;
      }

      const remaining = Math.max(0, leadsToProcess.length - newlyProcessedCount);
      await logJob({
        newlyProcessedCount,
        processedCount: alreadyProcessedCount + newlyProcessedCount,
        remainingLeads: remaining,
        errorCount,
        errors: errors.slice(0, 10),
        message: remaining > 0 ? `Processing… ${remaining.toLocaleString()} remaining` : 'Finalizing…',
        debug: { phase: 'batch_done', batchNumber, totalBatches, lastBatchUpdates: batchUpdates },
      });
    }

    // Ensure the column exists in the list columns array if it was newly created.
    await logJob({ debug: { phase: 'finalizing' }, message: 'Finalizing…' });
    if (!columnExists) {
      const updatedColumns = [...currentColumns];
      if (!updatedColumns.includes(newColumnName)) updatedColumns.push(newColumnName);
      await db.collection('lead-lists').doc(listId).update({ columns: updatedColumns, updatedAt: new Date() });
    } else {
      await db.collection('lead-lists').doc(listId).update({ updatedAt: new Date() });
    }

    await logJob({
      status: 'completed' as JobStatus,
      remainingLeads: 0,
      newlyProcessedCount,
      processedCount: alreadyProcessedCount + newlyProcessedCount,
      errorCount,
      errors: errors.slice(0, 10),
      message: `Completed. Updated ${newlyProcessedCount.toLocaleString()} new leads.`,
      debug: { phase: 'completed' },
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (e: any) {
    await failJob(e?.message || 'Unhandled job error', e);
    return { statusCode: 200, headers, body: JSON.stringify({ success: false }) };
  }
};

export { handler };

