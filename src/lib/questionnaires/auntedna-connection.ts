import type { PartnerConfig } from './auntedna-partner';

/** Provider-approved organization routing and credential scope are server-owned configuration.
 * A key prefix alone never authorizes a clinic; no key-default routing is used.
 */
export function resolveBaselineConnection(organizationId: string, teamId: string, organization: any,
  assignment: any, env: Record<string, string | undefined> = process.env): PartnerConfig | null {
  // Explicit synthetic assignments retain their isolated sandbox contract.
  if (assignment?.environment === 'test' && assignment.universityCode === 'SANDBOX') {
    const apiKey = env.AUNTEDNA_PARTNER_TEST_KEY;
    return apiKey?.startsWith('ae_pk_test_') ? { environment: 'test', universityCode: 'SANDBOX', apiKey } : null;
  }
  const connection = organization?.auntEdnaBaselineConnection;
  if (!organizationId || !teamId || !connection || connection.organizationId !== organizationId
    || connection.environment !== 'live' || typeof connection.universityCode !== 'string'
    || !/^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(connection.universityCode) || connection.universityCode === 'SANDBOX'
    || connection.universityCode !== organization.universityCode
    || !Array.isArray(connection.teamIds) || !connection.teamIds.includes(teamId)
    || typeof connection.approvalReference !== 'string' || !connection.approvalReference.trim()
    || !/^AUNTEDNA_PARTNER_LIVE_KEY(?:_[A-Z0-9_]+)?$/.test(connection.credentialEnv || '')) return null;
  const apiKey = env[connection.credentialEnv];
  return apiKey?.startsWith('ae_pk_live_') ? { environment: 'live', universityCode: connection.universityCode, apiKey } : null;
}
