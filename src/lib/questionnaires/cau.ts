import { OWNERSHIP_VERSION, questionCustodian, questionVisible } from './cau-routing';
export { OWNERSHIP_VERSION, questionCustodian } from './cau-routing';
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
    if (!questionVisible(q.id, input.answers)) { fields[q.id] = { questionId: q.id, state: 'not_applicable' }; continue; }
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
export function splitSubmission(input: any) {
  const validated = validateSubmission(input);
  const auntEdnaFields: Record<string, any> = {};
  const pulseFields: Record<string, any> = {};
  const references: Record<string, any> = {};
  for (const [id, field] of Object.entries(validated.fields)) {
    if (questionCustodian(id) === 'auntEDNA') {
      auntEdnaFields[id] = field;
      // Never copy value, free text, scores, or answer hashes into the mirror.
      references[id] = { questionId: id, questionnaireVersion: VERSION, custodian: 'auntEDNA', state: 'awaiting_receipt' };
    } else pulseFields[id] = field;
  }
  return {
    auntEdna: { submissionId: input.submissionId, version: VERSION, ownershipVersion: OWNERSHIP_VERSION, identity: validated.identity, fields: auntEdnaFields },
    pulseCheck: { submissionId: input.submissionId, version: VERSION, ownershipVersion: OWNERSHIP_VERSION, identity: validated.identity, fields: pulseFields, auntEdnaReferences: references }
  };
}
// Receipt must be authenticated by the integration, not trusted from a browser.
// This constructs the restricted mirror only; no clinical values are accepted.
export function attachAuntEdnaReceipt(pulseRecord: ReturnType<typeof splitSubmission>['pulseCheck'], receipt: { submissionId: string; recordId: string; receiptId: string }) {
  if (receipt.submissionId !== pulseRecord.submissionId || !receipt.recordId || !receipt.receiptId) throw Error('Matching auntEDNA receipt required.');
  return { ...pulseRecord, auntEdnaReferences: Object.fromEntries(Object.entries(pulseRecord.auntEdnaReferences).map(([id, ref]) => [id, { questionId: id, questionnaireVersion: VERSION, custodian: 'auntEDNA', state: 'external', recordId: receipt.recordId, receiptId: receipt.receiptId }])) };
}
