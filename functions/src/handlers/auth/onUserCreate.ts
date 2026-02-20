// functions/src/handlers/auth/onUserCreate.ts
//
// Centralized Firestore write logic for user creation.
// This handler is designed to be called from HTTP endpoints or auth triggers
// when a new Pulse user is created. It persists the canonical user shape to
// `/users/{uid}` and supports optional partner attribution via `partnerSource`.

import * as admin from "firebase-admin";
import { User, PartnerSource } from "../../models/user";

const db = admin.firestore();

export interface OnUserCreatePayload {
  uid: string;
  email: string;
  displayName?: string;
  username?: string;
  // Optional partner attribution coming from the signup flow
  partnerSource?: PartnerSource | null;
}

/**
 * buildUserDocument
 *
 * Normalizes the inbound payload into the canonical User document shape.
 * This is kept as a pure function so it can be unit-tested independently.
 */
export function buildUserDocument(payload: OnUserCreatePayload): User {
  const now = new Date();

  const baseUser: User = {
    id: payload.uid,
    email: payload.email,
    displayName: payload.displayName,
    username: payload.username,
    createdAt: now,
    updatedAt: now,
  };

  if (payload.partnerSource && payload.partnerSource.partnerId && payload.partnerSource.type) {
    baseUser.partnerSource = {
      type: payload.partnerSource.type,
      partnerId: payload.partnerSource.partnerId,
    };
  }

  return baseUser;
}

/**
 * createUserDocument
 *
 * Writes the user document to Firestore at `/users/{uid}`.
 * If `partnerSource` is provided, it is persisted as part of the document
 * and treated as immutable after creation (enforced via security rules
 * and/or validator logic in later steps).
 */
export async function createUserDocument(payload: OnUserCreatePayload): Promise<void> {
  const userDoc = buildUserDocument(payload);

  await db
    .collection("users")
    .doc(payload.uid)
    .set(userDoc, { merge: false });
}
