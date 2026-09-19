import { VERSION, questions, validateSubmission, questionCustodian } from './cau';
export const performanceQuestions = questions.filter(q => questionCustodian(q.id) === 'PulseCheck');
export function performanceDraft(input: any) {
  if (input?.version !== VERSION || !Number.isInteger(input.position) || input.position < 0 || input.position >= performanceQuestions.length || typeof input.completed !== 'boolean') throw Error('Invalid progress.');
  const allowed = new Set(performanceQuestions.map(q => q.id));
  if (!input.answers || Object.keys(input.answers).some(id => !allowed.has(id))) throw Error('Performance answers only.');
  const validated = validateSubmission({name:'Draft',email:'draft@example.com',answers:input.answers});
  const answers = Object.fromEntries(Object.entries(validated.fields).filter(([id, f]: any) => allowed.has(id) && f.state === 'local').map(([id, f]: any) => [id,f.value]));
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 150) throw Error('Name required.');
  return {flowVersion:input.flowVersion === 3 ? 3 : input.flowVersion === 2 ? 2 : 1,version:VERSION,name:input.name.trim(),answers,position:input.position,completed:input.completed};
}
export async function savePerformanceDraft(db: any, ref: any, input: any, ownerUid: string) {
  const draft = performanceDraft(input);
  if (!Number.isInteger(input.revision) || input.revision < 0) throw Error('Invalid revision.');
  return db.runTransaction(async (tx: any) => {
    const previous = (await tx.get(ref)).data();
    if (previous?.revision === input.revision + 1 && JSON.stringify(performanceDraft(previous)) === JSON.stringify(draft)) return previous;
    if ((previous?.revision || 0) !== input.revision) throw Error('Draft changed.');
    const stored = {...draft,kind:'performance-draft',ownerUid,revision:input.revision + 1,startedAt:previous?.startedAt || new Date().toISOString(),updatedAt:new Date().toISOString()};
    tx.set(ref,stored); return stored;
  });
}
