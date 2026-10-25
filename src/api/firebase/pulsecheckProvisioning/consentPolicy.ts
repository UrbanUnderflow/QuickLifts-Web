import defaults from '../../../content/consents/defaults.json';
import pulseCheckOnly from '../../../content/consents/pulsecheck-only.json';
import type { PulseCheckRequiredConsentDocument } from './types';
import { isHealthBaselineEnabled, type HealthBaselineConfiguration } from './healthBaselinePolicy';

export type ConsentCategory = 'participation' | 'health_authorization' | 'research' | 'staff';
export type ConsentDecision = { decision: 'accepted' | 'declined' | 'revoked'; version: string; signedName: string; decidedAt: string; document: PulseCheckRequiredConsentDocument };
export type ConsentDecisions = Record<string, ConsentDecision>;
export function consentCategory(doc: PulseCheckRequiredConsentDocument): ConsentCategory {
  if (doc.category) return doc.category;
  return doc.id.includes('research') ? 'research' : 'participation';
}
export function consentDecisionComplete(doc: PulseCheckRequiredConsentDocument, decisions: ConsentDecisions = {}, accepted: string[] = [], versions: Record<string, string> = {}): boolean {
  const entry = decisions[doc.id];
  const category = consentCategory(doc);
  if (entry) return entry.version === doc.version && entry.document?.body === doc.body && consentCategory(entry.document) === category && (entry.decision === 'accepted' || ((category === 'health_authorization' || category === 'research') && ['declined', 'revoked'].includes(entry.decision)));
  if (doc.version === 'v1-pulsecheck') return false; // Revised stock terms require their own exact receipt.
  return category !== 'health_authorization' && accepted.includes(doc.id) && (!versions[doc.id] || versions[doc.id] === doc.version);
}
export function researchEligible(docs: PulseCheckRequiredConsentDocument[], decisions: ConsentDecisions, status: string, accepted: string[] = [], versions: Record<string, string> = {}): boolean {
  const research = docs.filter(d => consentCategory(d) === 'research');
  return status === 'accepted' && research.some(d => d.studySpecific === true) && research.every(d => consentDecisionComplete(d, decisions, accepted, versions) && (decisions[d.id]?.decision === 'accepted' || (!decisions[d.id] && accepted.includes(d.id))));
}
export const STAFF_CONSENT = defaults.staff as PulseCheckRequiredConsentDocument;
export const HEALTH_CONSENT = defaults.health as PulseCheckRequiredConsentDocument;
export const PARTICIPATION_CONSENT = defaults.participation as PulseCheckRequiredConsentDocument;
export const RESEARCH_CONSENT = defaults.research as PulseCheckRequiredConsentDocument;

/** Collection being on requires an explicit health decision, never an inferred acceptance. */
export function healthBaselineConsentDocuments(
  documents: PulseCheckRequiredConsentDocument[] = [],
  team?: HealthBaselineConfiguration,
  organization?: HealthBaselineConfiguration,
  configuredProductBrand?: string,
): PulseCheckRequiredConsentDocument[] {
  const scoped = selectConsentDocumentsForProduct(documents, configuredProductBrand);
  if (!isHealthBaselineEnabled(team, organization)) {
    return scoped.filter(document => consentCategory(document) !== 'health_authorization');
  }
  if (scoped.some(document => consentCategory(document) === 'health_authorization')) return scoped;
  return [...scoped, ...selectConsentDocumentsForProduct([{ ...HEALTH_CONSENT }], configuredProductBrand)];
}

export function staffConsentDocuments(docs: PulseCheckRequiredConsentDocument[] = []): PulseCheckRequiredConsentDocument[] {
  const staff = docs.filter(doc => consentCategory(doc) === 'staff');
  return staff.some(doc => doc.id === STAFF_CONSENT.id) ? staff : [STAFF_CONSENT, ...staff];
}

/** Product identity must come from the current team's persisted organization setting. */
export function usesAthleticMindConsent(
  organization: { id: string; configuredProductBrand?: string } | null,
  team: { id: string; organizationId: string } | null,
  membership: { teamId: string; organizationId: string } | null,
  previewMode = false,
): boolean {
  return organization?.configuredProductBrand === 'athleticmind'
    && organization.id === team?.organizationId
    && (previewMode || (membership?.teamId === team?.id && membership?.organizationId === organization.id));
}

/** Preserve customized agreements; only the exact shipped stock text is replaced. */
export function selectConsentDocumentsForProduct(
  documents: PulseCheckRequiredConsentDocument[], configuredProductBrand?: string,
): PulseCheckRequiredConsentDocument[] {
  if (configuredProductBrand !== 'pulsecheck') return documents;
  return documents.map(doc => {
    const key = (['participation', 'health'] as const).find(key => {
      const original = defaults[key];
      return doc.id === original.id && doc.version === original.version
        && doc.body === original.body && doc.title === original.title && doc.category === original.category;
    });
    return key ? { ...pulseCheckOnly[key] } as PulseCheckRequiredConsentDocument : doc;
  });
}

/** Reject newly submitted choices from an outdated open form without rewriting historical receipts. */
export function assertCurrentConsentDecisions(
  submitted: ConsentDecisions | undefined,
  previous: ConsentDecisions = {},
  documents: PulseCheckRequiredConsentDocument[],
): void {
  if (!submitted) return;
  for (const [id, entry] of Object.entries(submitted)) {
    if (JSON.stringify(entry) === JSON.stringify(previous[id])) continue;
    const current = documents.find(doc => doc.id === id);
    if (!current || entry.version !== current.version || entry.document?.body !== current.body
      || consentCategory(entry.document) !== consentCategory(current)) {
      throw new Error('The agreement terms changed. Refresh this page and review the current terms.');
    }
  }
}
