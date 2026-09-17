import { splitSubmission } from './cau';

const BASE_URL = 'https://partner-api.auntedna.ai';
export type PartnerConfig = { apiKey: string; environment: 'test' | 'live'; universityCode: string };
export type BaselineReceipt = {
  baselineId: string; athleteId: string; externalId: string;
  submissionId: string; receivedAt: string; created: boolean; requestId: string;
};
export class PartnerError extends Error {
  constructor(public status: number, public retryable: boolean) {
    // Never expose provider bodies: validation errors can contain submitted answers.
    super('auntEDNA submission could not be confirmed.');
  }
}
function validateConfig(config: PartnerConfig) {
  if (!config.apiKey.startsWith(`ae_pk_${config.environment}_`) ||
      (config.environment === 'test' ? config.universityCode !== 'SANDBOX' : config.universityCode !== 'CAU')) {
    throw new Error('Invalid auntEDNA environment configuration.');
  }
}
export async function submitAuntEdnaBaseline(
  input: Parameters<typeof splitSubmission>[0], externalId: string,
  config: PartnerConfig, transport: typeof fetch = fetch,
): Promise<BaselineReceipt> {
  validateConfig(config);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(externalId) || !/^[A-Za-z0-9_-]{1,128}$/.test(input.submissionId || '')) throw Error('Invalid submission identity.');
  const { auntEdna } = splitSubmission(input);
  let response: Response;
  try {
    response = await transport(`${BASE_URL}/partner/athletes/${encodeURIComponent(externalId)}/baseline`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${config.apiKey}`, 'X-Pulse-Integration': 'true', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...auntEdna, universityCode: config.universityCode }),
    });
  } catch { throw new PartnerError(502, true); }
  if (!response.ok) throw new PartnerError(response.status, response.status >= 500 || response.status === 429);
  let envelope: any;
  try { envelope = await response.json(); } catch { throw new PartnerError(502, true); }
  const data = envelope?.data;
  if (envelope?.success !== true || !data || data.externalId !== externalId || data.submissionId !== input.submissionId ||
      !['baselineId', 'athleteId', 'receivedAt'].every(key => typeof data[key] === 'string' && data[key].length > 0) ||
      !Number.isFinite(Date.parse(data.receivedAt)) || typeof data.created !== 'boolean' || typeof envelope.requestId !== 'string' || !envelope.requestId) {
    throw new PartnerError(502, true);
  }
  return { baselineId: data.baselineId, athleteId: data.athleteId, externalId: data.externalId,
    submissionId: data.submissionId, receivedAt: data.receivedAt, created: data.created, requestId: envelope.requestId };
}

// Only a receipt returned by the authenticated server call may reach this helper.
// The browser cannot supply or authorize completion with a receipt of its own.
export function baselineMirror(input: Parameters<typeof splitSubmission>[0], receipt: BaselineReceipt) {
  const { pulseCheck } = splitSubmission(input);
  if (receipt.submissionId !== pulseCheck.submissionId) throw Error('Receipt does not match submission.');
  return { ...pulseCheck, externalId: receipt.externalId, status: 'complete',
    auntEdna: { baselineId: receipt.baselineId, athleteId: receipt.athleteId, receivedAt: receipt.receivedAt, requestId: receipt.requestId },
    auntEdnaReferences: Object.fromEntries(Object.keys(pulseCheck.auntEdnaReferences).map(id => [id, {
      questionId: id, questionnaireVersion: pulseCheck.version, custodian: 'auntEDNA', state: 'external',
      baselineId: receipt.baselineId, athleteId: receipt.athleteId,
    }])) };
}
