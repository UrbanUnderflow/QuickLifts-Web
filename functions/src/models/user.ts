// functions/src/models/user.ts
// Canonical Firestore schema model for documents in the `users` collection.
//
// NOTE:
// - This interface is intentionally focused on fields that backend Cloud
//   Functions rely on for auth, attribution, and analytics. It does not need
//   to mirror every single client-side field from src/api/firebase/user/types.ts,
//   but it should stay consistent with what we persist to `/users/{uid}`.
// - New backend features that read or write user documents should import this
//   type instead of re-declaring ad-hoc shapes.

/**
 * PartnerSource
 *
 * Attribution metadata for users who joined via a Pulse partner channel.
 * This enables retention + revenue metrics segmented by channel.
 */
export interface PartnerSource {
  /**
   * High-level channel type used for analytics segmentation.
   * - `brand`   → partner is a brand (e.g., apparel, supplement, recovery)
   * - `gym`     → partner is a gym or training facility
   * - `runClub` → partner is a run club or similar endurance community
   */
  type: "brand" | "gym" | "runClub";

  /**
   * ID of the associated partner document.
   * Typically corresponds to the doc ID in `partners` or `gymAffiliates`.
   */
  partnerId: string;
}

/**
 * User
 *
 * Minimal backend representation of a user document in Firestore.
 * Extend this interface as backend logic needs additional fields.
 */
export interface User {
  /** Firestore document ID / auth UID. */
  id: string;

  /** Primary auth identifier. */
  email: string;

  /** Display name shown in the product. */
  displayName?: string;

  /** Optional username/handle used in URLs and social features. */
  username?: string;

  /**
   * Optional partner attribution for this user.
   * Set once at account creation when the user signs up via a partner link
   * or invite code, and treated as immutable thereafter.
   */
  partnerSource?: PartnerSource;

  /** Timestamps stored as JavaScript Date objects in backend logic. */
  createdAt?: Date;
  updatedAt?: Date;
}

export default User;
