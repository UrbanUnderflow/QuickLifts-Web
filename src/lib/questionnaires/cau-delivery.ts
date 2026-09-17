import { splitSubmission } from './cau';
import { baselineMirror, PartnerConfig, submitAuntEdnaBaseline } from './auntedna-partner';

type Mirror = ReturnType<typeof baselineMirror>;
export type DeliveryStore = {
  get(submissionId: string): Promise<Mirror | null>;
  // Atomic create-if-absent. Return the existing record if a concurrent request won.
  create(submissionId: string, mirror: Mirror): Promise<Mirror>;
};
export async function deliverQuestionnaire(input: any, externalId: string, config: PartnerConfig, store: DeliveryStore, transport: typeof fetch = fetch) {
  splitSubmission(input); // Validate before either external or local writes.
  const previous = await store.get(input.submissionId);
  if (previous) {
    if (previous.externalId !== externalId) throw Error('Submission identity conflict.');
    return previous;
  }
  const receipt = await submitAuntEdnaBaseline(input, externalId, config, transport);
  // A failed save is retried with the same athlete and submission IDs. auntEDNA
  // returns its original receipt. No health values are ever queued locally.
  const stored = await store.create(input.submissionId, baselineMirror(input, receipt));
  if (stored.externalId !== externalId) throw Error('Submission identity conflict.');
  return stored;
}
