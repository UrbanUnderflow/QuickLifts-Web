export type ProgramSignInPolicy = { mode: 'standard' | 'institution-phone'; emailDomains: string[] };
export function normalizeSignInPolicy(value: unknown): ProgramSignInPolicy;
export function phoneSession(identity: any): boolean;
export function assertOrganizationSignIn(organization: any, identity: any, email: string): void;
