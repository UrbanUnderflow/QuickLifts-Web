import { NORA_RED_TEAM_CONTRACT_VERSION } from './types';
export type RuntimeEvidence = { actionSchemaVersion?: number; runtime: string; revision: string; build: string; contractVersion: string; targetModel: string };

export function verifyRuntime(payload: any, expectedBuild?: string): RuntimeEvidence {
  const evidence = payload?.runtimeEvidence;
  if (payload?.syntheticRedTeam?.active !== true || payload?.syntheticRedTeam?.externalSideEffects !== false || payload?.syntheticRedTeam?.firebaseMode !== 'dev') throw new Error('APP_RUNTIME_UNAVAILABLE: The endpoint has not confirmed development isolation.');
  if (evidence?.actionSchemaVersion !== 1 || evidence?.runtime !== 'pulsecheck-chat' || evidence?.revision !== 'shared-chat-v1' || evidence?.contractVersion !== NORA_RED_TEAM_CONTRACT_VERSION || !evidence?.build || evidence.targetModel !== 'gpt-4o-mini') throw new Error('APP_RUNTIME_UNAVAILABLE: Deploy the matching Nora runtime before testing.');
  if (expectedBuild && evidence.build !== expectedBuild) throw new Error('APP_RUNTIME_UNAVAILABLE: The tested backend differs from the selected build.');
  return evidence;
}

