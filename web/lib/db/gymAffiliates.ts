// web/lib/db/gymAffiliates.ts
// Data-access helpers for gym affiliate records and aggregated stats.
//
// NOTE: This module is written to be compatible with the Next.js App Router
// "web" app. The actual Firestore client/import should be wired up once the
// shared db client for the web app is finalized.

export type GymAffiliateStats = {
  id: string;
  name: string;
  partnerType: string;
  memberSignupCount: number;
  roundsCreated: number;
  lastActivityDate: Date | null;
  // Derived field: true when the gym has not created any rounds in the last 30 days
  // (including the case where there are no rounds at all). This should be computed
  // from lastActivityDate in the real implementation.
  isInactive: boolean;
};

/**
 * getGymAffiliatesWithStats
 *
 * Returns gym affiliate records enriched with:
 * - memberSignupCount: number of members from that gym who have Pulse accounts
 * - roundsCreated: total number of rounds created by that gym
 * - lastActivityDate: timestamp of the most recent round created by that gym
 * - isInactive: whether the last activity is older than 30 days (or no rounds)
 *
 * Implementation details:
 * - This function is intentionally written with a clear interface and
 *   aggregation responsibilities, but the concrete Firestore wiring is left as
 *   a TODO so it can be aligned with the existing web db client patterns.
 *
 * Intended aggregation logic (pseudocode):
 *  1. Fetch all gymAffiliates.
 *  2. For each gym, query rounds where gymAffiliateId == gym.id.
 *  3. Compute:
 *     - roundsCreated = count of matching rounds
 *     - lastActivityDate = max(createdAt) or null
 *     - isInactive = !lastActivityDate || lastActivityDate < now - 30 days
 */
export async function getGymAffiliatesWithStats(): Promise<GymAffiliateStats[]> {
  // TODO: Wire this up to the actual Firestore client for the web app and
  // implement the aggregation + inactivity flag as described above.

  // For now, return an empty array so the calling UI can render a graceful
  // placeholder state. This will be replaced with real aggregation logic in
  // subsequent steps.
  return [];
}
