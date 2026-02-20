// Firestore schema model for gym affiliate documents.
// NOTE: This interface describes the shape of documents in the
// `gymAffiliates` collection. It is intentionally minimal and focused
// on the fields required for affiliate tracking and signup attribution.

export interface GymAffiliate {
  /**
   * Stable identifier for the gym within Pulse's domain.
   * This may be a slug, UUID, or doc ID from a separate `gyms` collection.
   */
  gymId: string;

  /**
   * Human-readable gym name (e.g., "Downtown Strength Co.").
   */
  gymName: string;

  /**
   * ID of the associated partner in the `partners` collection.
   * Stored as a string (doc ID) rather than a Firestore DocumentReference
   * so it can be used easily in both backend functions and client code.
   */
  partnerId: string;

  /**
   * Unique invite code that gym members enter during signup.
   * Used to attribute new user accounts to this gym affiliate.
   */
  inviteCode: string;

  /**
   * Count of members who have signed up via this affiliate.
   * This should be incremented when a new user is created with a
   * valid gymAffiliateId reference.
   */
  memberSignupCount: number;
}
