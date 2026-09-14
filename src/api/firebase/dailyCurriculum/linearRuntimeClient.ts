import { auth, getFirebaseModeRequestHeaders } from '../config';
import type { SimModule } from '../mentaltraining/types';
export interface LinearRuntimeAssignment {
  id: string; versionId: string; skillId: string; skillName: string;
  skillType: 'protocol' | 'simulation'; phase: 'learn' | 'practice' | 'use_it';
  sourceDate: string; timezone: string; windowStart: string; windowEnd: string;
  completedDayCount: number; requiredDays: 5; phaseCompletedToday: boolean;
  contentSnapshot: SimModule; clientContractVersion: 1;
}
export interface LinearRuntimeResponse {
  status: 'legacy' | 'blocked' | 'review_due' | 'assignment' | 'recorded'; reason?: string;
  assignment?: LinearRuntimeAssignment;
}
export type LinearUseOutcome = 'used' | 'forgot' | 'no_chance';
export async function requestLinearRuntime(body: { action: 'today' | 'start' | 'complete'; assignmentId?: string; outcome?: LinearUseOutcome }): Promise<LinearRuntimeResponse> {
  if (!auth.currentUser) throw new Error('Sign in to open your skill plan.');
  const token = await auth.currentUser.getIdToken();
  const response = await fetch('/api/curriculum/runtime', { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...getFirebaseModeRequestHeaders(),
  }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : typeof payload.reason === 'string' ? payload.reason : 'Your skill plan could not be saved. Please retry.');
  if (body.action !== 'today' && payload.status !== 'recorded') throw new Error(payload.reason || 'This activity was not confirmed. Refresh your assignment and retry.');
  return payload;
}

/** Private writing is saved separately from phase-completion evidence. */
export async function saveLinearJournal(assignmentId: string, text: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Sign in to save your private journal.');
  if (!text.trim() || text.length > 4000) throw new Error('Use between 1 and 4,000 characters for your private journal.');
  const token = await auth.currentUser.getIdToken();
  const response = await fetch('/api/curriculum/journal', { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...getFirebaseModeRequestHeaders(),
  }, body: JSON.stringify({ assignmentId, text }) });
  const payload = await response.json();
  if (!response.ok || payload.status !== 'saved') throw new Error(typeof payload.error === 'string' ? payload.error : 'Your private journal was not saved. Please retry.');
}

export async function loadLinearJournal(assignmentId: string): Promise<string> {
  if (!auth.currentUser) throw new Error('Sign in to open your private journal.');
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`/api/curriculum/journal?${new URLSearchParams({ assignmentId })}`, { headers: { Authorization: `Bearer ${token}`, ...getFirebaseModeRequestHeaders() } });
  const result = await response.json();
  if (!response.ok || result.status !== 'loaded') throw new Error(result.error || 'Your saved journal could not be loaded.');
  return typeof result.text === 'string' ? result.text : '';
}
