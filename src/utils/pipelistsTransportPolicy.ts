// University outreach is reviewed and sent manually. This policy is scoped to
// PipeLists; product and investor delivery elsewhere must remain unchanged.
export const UNIVERSITY_BREVO_BLOCK_REASON = 'University outreach is manual-only. Brevo sending and automatic sequences are disabled for university lists.';

type ListIdentity = { templateKey?: unknown } | null | undefined;

export function isUniversityPipeList(list: ListIdentity): boolean {
  return list?.templateKey === 'university-pilot';
}

export function blocksUniversityBrevoTransport(personalList: ListIdentity, protectedList?: ListIdentity, emailType?: string): boolean {
  // Either stored copy is sufficient: a stale personal projection must never
  // enable delivery for a protected university list (or the reverse).
  return isUniversityPipeList(personalList) || isUniversityPipeList(protectedList) || emailType === 'school-outreach';
}

const KNOWN_TEMPLATES = new Set(['vc', 'grant', 'pitch', 'university-pilot', 'contract', 'partner', 'investor-metrics', 'contacts', 'task']);

export function hasKnownPipeListTemplate(list: ListIdentity): boolean {
  return typeof list?.templateKey === 'string' && KNOWN_TEMPLATES.has(list.templateKey);
}
