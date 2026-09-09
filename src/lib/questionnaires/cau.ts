import source from '../../content/questionnaires/cau-operational.json';
export const COLLECTION = 'pulsecheck-restricted-questionnaire-submissions';
export const VERSION = 'cau-operational-web-v1';
export const questions = source.questions.filter(q => q.id !== 'cau-operational-04');
export function validateSubmission(input: any) {
  if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 150) throw Error('Enter your name.');
  if (typeof input.email !== 'string' || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw Error('Enter a valid email address.');
  if (!input.answers || typeof input.answers !== 'object' || Array.isArray(input.answers)) throw Error('Invalid answers.');
  const allowed = new Set(questions.map(q => q.id));
  if (Object.keys(input.answers).some(id => !allowed.has(id))) throw Error('Unknown question.');
  const fields: Record<string, any> = {};
  for (const q of questions) {
    const value = input.answers[q.id];
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) { fields[q.id] = { questionId: q.id, state: 'skipped' }; continue; }
    if (q.type === 'multi_select') {
      if (!Array.isArray(value) || value.some(v => typeof v !== 'string' || !q.choices.includes(v)) || new Set(value).size !== value.length || (q.maxSelections && value.length > q.maxSelections) || (value.length > 1 && value.some(v => (q.exclusiveChoices as string[]).includes(v)))) throw Error('Invalid selection.');
    } else {
      if (typeof value !== 'string' || value.length > 4000) throw Error('Invalid answer.');
      if (q.choices.length && !q.choices.includes(value)) throw Error('Invalid choice.');
      if (q.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw Error('Invalid date.');
    }
    fields[q.id] = { questionId: q.id, state: 'local', value };
  }
  return { version: VERSION, completedSections: { performance: input.completedSections?.performance === true, health: input.completedSections?.health === true }, identity: { name: input.name.trim(), email: input.email.trim().toLowerCase(), verification: 'self_reported' }, fields };
}
// A verified receiver receipt is required. Call in a transaction against the
// exported revision; never use a browser-supplied receipt to authorize redaction.
export function redactMigratedFields(record: any, receipt: { verified: boolean; sourceRevision: number; externalRecordId: string; fieldIds: string[]; receiptId: string }, now: string) {
  if (!receipt.verified || receipt.sourceRevision !== record.revision || !receipt.externalRecordId || !receipt.receiptId || !receipt.fieldIds.length) throw Error('Verified matching migration receipt required.');
  const fields = { ...record.fields };
  for (const id of receipt.fieldIds) {
    if (!fields[id] || fields[id].state !== 'local') throw Error('Field is not locally stored.');
    fields[id] = { questionId: id, state: 'external', custodian: 'auntEDNA', externalRecordId: receipt.externalRecordId, receiptId: receipt.receiptId, migratedAt: now };
  }
  const { payloadDigest: _removedDigest, ...retained } = record;
  return { ...retained, fields, revision: record.revision + 1 };
}
