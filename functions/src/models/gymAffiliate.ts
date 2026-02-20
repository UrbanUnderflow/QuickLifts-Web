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

  /**
   * Total number of rounds created by this gym affiliate.
   * Incremented when a new round associated with this gym is created.
   */
  roundsCreated?: number;

  /**
   * Count of unique users who have joined any round associated with this gym.
   * This should count each user at most once per gym affiliate.
   */
  uniqueParticipants?: number;

  /**
   * Optional list of user IDs that have been counted toward uniqueParticipants.
   * This allows us to keep uniqueParticipants accurate when users join
   * multiple rounds for the same gym.
   */
  uniqueParticipantUserIds?: string[];
}
