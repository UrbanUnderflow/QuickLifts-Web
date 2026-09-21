import { auth, getFirebaseModeRequestHeaders } from './config';

export interface EvidenceEntry {
  id: string; moment: string; action?: string | null; sourceAssignmentId?: string | null;
  sourceSkillName?: string | null; createdAt: number; revisitCount: number; useCount: number;
}
export interface EvidenceDraft { entryId: string; moment: string; action?: string; sourceAssignmentId?: string; sourceSkillName?: string }
/** Bind every operation to the account that opened this private surface. */
export async function evidenceRequest<T>(ownerId: string, path = '', init: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user || user.uid !== ownerId) throw new Error('Your account changed. Open your evidence again.');
  const token = await user.getIdToken();
  if (auth.currentUser?.uid !== ownerId) throw new Error('Your account changed. Open your evidence again.');
  const response = await fetch(`/api/evidence-journal${path}`, { ...init, headers: {
    'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...getFirebaseModeRequestHeaders(),
  } });
  const payload = await response.json();
  if (auth.currentUser?.uid !== ownerId) throw new Error('Your account changed. Open your evidence again.');
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Your evidence could not be updated. Please try again.');
  return payload as T;
}
export const saveEvidence = (ownerId: string, draft: EvidenceDraft) => evidenceRequest<{ entry: EvidenceEntry; created: boolean }>(ownerId, '', { method: 'POST', body: JSON.stringify(draft) });
export const recordEvidenceEvent = (ownerId: string, entryId: string, event: 'revisited' | 'used', eventId = crypto.randomUUID()) => evidenceRequest<{ recorded: boolean }>(ownerId, '/event', { method: 'POST', body: JSON.stringify({ entryId, eventId, event }) });
