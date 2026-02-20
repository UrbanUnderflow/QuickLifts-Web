// functions/src/validators/auth.ts
//
// Validation helpers for auth-related payloads, including partner attribution
// metadata used when creating new user accounts.

import { PartnerSource } from "../models/user";

/**
 * validatePartnerSource
 *
 * Ensures an incoming partnerSource payload is structurally valid before it is
 * persisted. Returns a normalized PartnerSource object when valid, or
 * undefined when the payload should be ignored.
 */
export function validatePartnerSource(input: any): PartnerSource | undefined {
  if (!input) return undefined;

  const type = input.type;
  const partnerId = input.partnerId;

  const allowedTypes: PartnerSource["type"][] = ["brand", "gym", "runClub"];

  if (typeof type !== "string" || !allowedTypes.includes(type)) {
    return undefined;
  }

  if (typeof partnerId !== "string" || partnerId.trim().length === 0) {
    return undefined;
  }

  return {
    type,
    partnerId: partnerId.trim(),
  };
}

/**
 * isPartnerSourceImmutableUpdate
 *
 * Helper to compare an existing partnerSource with an updated one and check
 * whether the update attempts to change attribution. This is primarily useful
 * for tests and defensive checks; Firestore security rules enforce the
 * immutability constraint at the client level.
 */
export function isPartnerSourceImmutableUpdate(
  before: PartnerSource | undefined,
  after: PartnerSource | undefined
): boolean {
  // Allowed cases:
  // - both undefined
  // - both defined and identical
  if (!before && !after) return true;
  if (before && after && before.type === after.type && before.partnerId === after.partnerId) {
    return true;
  }
  // Any other transition (adding, removing, or changing) is considered invalid
  return false;
}
