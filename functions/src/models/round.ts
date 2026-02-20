// functions/src/models/round.ts
// Firestore model for documents in the `rounds` collection.
//
// NOTE: The rounds backend is still evolving; this interface is intentionally
// minimal and focused on fields that other backend logic may rely on. As
// additional rounds fields are formalized, they should be added here and
// referenced from any handlers or validators that operate on the `rounds`
// collection.

export interface Round {
  /**
   * Unique identifier for the round (Firestore document ID).
   * This is not stored as a field in Firestore by default, but most
   * handlers treat the document ID as the canonical round ID.
   */
  id?: string;

  /**
   * Optional reference to the gym affiliate that owns or sponsors this round.
   * When a round is created via a gym partner flow, this should be set to
   * the corresponding `gymAffiliates` document ID.
   *
   * If the round is not associated with any gym, this field should be
   * omitted or set to `null` in Firestore.
   */
  gymAffiliateId?: string | null;

  // TODO: As the rounds backend is formalized, add other strongly-typed
  // fields here (e.g., name, creatorUserId, startAt, endAt, status, etc.).
}

/**
 * Helper to map raw Firestore data into a `Round` type. This can be used
 * by any future data access layer to normalize optional fields.
 */
export const roundFromFirestore = (id: string, data: FirebaseFirestore.DocumentData): Round => {
  return {
    id,
    // Preserve gymAffiliateId if present; normalize undefined → null
    gymAffiliateId:
      typeof data.gymAffiliateId === 'string'
        ? data.gymAffiliateId
        : data.gymAffiliateId ?? null,
  };
};

/**
 * Helper to prepare a `Round` for writing to Firestore. This ensures we
 * never write `undefined` values (which Firestore rejects in nested
 * structures) and that `gymAffiliateId` is either a string or null.
 */
export const roundToFirestore = (round: Round): FirebaseFirestore.DocumentData => {
  const { id, gymAffiliateId, ...rest } = round;

  const data: FirebaseFirestore.DocumentData = {
    ...rest,
  };

  if (gymAffiliateId !== undefined) {
    data.gymAffiliateId = gymAffiliateId === null ? null : String(gymAffiliateId);
  }

  return data;
};
