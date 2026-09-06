import { createHash } from 'node:crypto';
import type { NoraRedTeamScenario } from './types';
export function scenarioFingerprint(scenario: NoraRedTeamScenario): string {
  return createHash('sha256').update(JSON.stringify(scenario)).digest('hex');
}
export function catalogFingerprint(scenarios: NoraRedTeamScenario[]): string {
  return createHash('sha256')
    .update(
      scenarios
        .map((s) => `${s.id}:${scenarioFingerprint(s)}`)
        .sort()
        .join('\n'),
    )
    .digest('hex');
}
