import { randomUUID } from 'node:crypto';
import { getFirebaseAdminApp } from '../firebase-admin';
import { createSyntheticFirebaseIdToken } from './syntheticFirebaseAuth';
import { resolveNoraFirebaseApiKey, resolveNoraRuntimeOrigin } from './runtimeConfig';
import { cleanupSyntheticStagingData } from './stagingRunner';
import { NORA_RED_TEAM_CONTRACT_VERSION } from './types';
import type { SimulationMessage } from './chatSimulation';

export { verifyRuntime } from './runtimeIdentity';
export type { RuntimeEvidence } from './runtimeIdentity';
import { verifyRuntime, type RuntimeEvidence } from './runtimeIdentity';
export type NoraChatAction = {id:string;type:'meal'|'practice';label:string;exerciseId?:string;category?:string};
export type RuntimeReply = { storageEvidence?: {conversationRecords:number; ordinaryTranscriptContainsInput:boolean}; chatActions?: NoraChatAction[]; reply: string; runtimeEvidence: RuntimeEvidence };
export type RuntimeResponder = (messages: SimulationMessage[], context?: string, actions?: boolean) => Promise<RuntimeReply>;

// Calls the exact app endpoint. There is deliberately no separate reply-model fallback.
export const respondWithAppRuntime: RuntimeResponder = async (messages, context = '', actions = false) => {
  const origin = resolveNoraRuntimeOrigin();
  const url = new URL('/.netlify/functions/pulsecheck-chat', origin);
  const expectedBuild = process.env.NORA_RED_TEAM_EXPECTED_BUILD || process.env.COMMIT_REF || process.env.NEXT_PUBLIC_COMMIT_SHA;
  if (!expectedBuild) throw new Error('APP_RUNTIME_UNAVAILABLE: Select the backend build to test.');
  const app = getFirebaseAdminApp(true);
  if (app.options.projectId !== 'quicklifts-dev-01') throw new Error('APP_RUNTIME_UNAVAILABLE: Development Firebase is required.');
  const uid = `nora-red-team-${randomUUID()}`;
  const db = app.firestore();
  try {
    const token = await createSyntheticFirebaseIdToken({ app, uid, email: `${uid}@example.invalid`, apiKey: resolveNoraFirebaseApiKey(true), claims: { noraRedTeamSynthetic: true, noraRedTeamRunId: uid } });
    const request = async (body: object) => {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-pulsecheck-firebase-mode': 'dev', 'x-pulsecheck-dev-firebase': 'true', 'x-nora-red-team-synthetic': 'true', 'x-nora-red-team-run-id': uid }, body: JSON.stringify({ userId: uid, ...body }), signal: AbortSignal.timeout(90000) });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        const code = typeof failure.errorCode === 'string' && /^[A-Z_]{1,80}$/.test(failure.errorCode) ? failure.errorCode : 'REQUEST_FAILED';
        throw new Error(`APP_RUNTIME_UNAVAILABLE: The app endpoint could not complete this test (${response.status}, ${code}).`);
      }
      const payload = await response.json();
      verifyRuntime(payload, expectedBuild);
      return payload;
    };
    await request({ runtimeProbe: true });
    await db.collection('users').doc(uid).set({ uid, displayName: 'Synthetic Athlete', primarySport: 'Volleyball', syntheticRedTeam: true });
    const payload = await request({ message: messages.at(-1)?.content, recentMessages: messages.slice(0, -1).map(m => ({ content: m.content, isFromUser: m.role === 'user' })), healthContext: context || undefined, clientCapabilities: { platform: 'red-team-staging', noraContractVersion: NORA_RED_TEAM_CONTRACT_VERSION, noraChatActions: actions } });
    if (typeof payload.assistantMessage !== 'string' || !payload.assistantMessage.trim()) throw new Error('APP_RUNTIME_UNAVAILABLE: The app returned no reply.');
    const stored = await db.collection('conversations').where('userId', '==', uid).get();
    const inputText = messages.at(-1)?.content || '';
    const storageEvidence = {conversationRecords:stored.size, ordinaryTranscriptContainsInput:stored.docs.some(doc => (doc.data().messages || []).some((m: {content?:string}) => typeof m.content === 'string' && m.content.includes(inputText)))};
    return { storageEvidence, chatActions: Array.isArray(payload.chatActions) ? payload.chatActions : [], reply: payload.assistantMessage, runtimeEvidence: payload.runtimeEvidence };
  } finally {
    await cleanupSyntheticStagingData({ app, db, uid, snapshotId: `${uid}_${new Date().toISOString().slice(0, 10)}`, coachIds: [], organizationId: uid, teamId: uid, membershipIds: [] });
  }
};
