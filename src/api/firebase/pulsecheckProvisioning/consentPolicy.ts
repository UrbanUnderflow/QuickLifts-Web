import defaults from '../../../content/consents/defaults.json';
import type { PulseCheckRequiredConsentDocument } from './types';

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

export function staffConsentDocuments(docs: PulseCheckRequiredConsentDocument[] = []): PulseCheckRequiredConsentDocument[] {
  const staff = docs.filter(doc => consentCategory(doc) === 'staff');
  return staff.some(doc => doc.id === STAFF_CONSENT.id) ? staff : [STAFF_CONSENT, ...staff];
}
