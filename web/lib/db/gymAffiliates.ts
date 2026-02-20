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
};

/**
 * getGymAffiliatesWithStats
 *
 * Returns gym affiliate records enriched with:
 * - memberSignupCount: number of members from that gym who have Pulse accounts
 * - roundsCreated: total number of rounds created by that gym
 * - lastActivityDate: timestamp of the most recent round created by that gym
 *
 * Implementation details:
 * - This function is intentionally written with a clear interface and
 *   aggregation responsibilities, but the concrete Firestore wiring is left as
 *   a TODO so it can be aligned with the existing web db client patterns.
 */
export async function getGymAffiliatesWithStats(): Promise<GymAffiliateStats[]> {
  // TODO: Wire this up to the actual Firestore client for the web app.
  // Expected collection layout (to be confirmed against Firestore):
  // - Collection "gymAffiliates": documents with fields such as
  //   { name: string, partnerType: string, memberSignupCount: number }
  // - Collection "rounds": documents with fields such as
  //   { gymAffiliateId: string, createdAt: Timestamp }
  //
  // Pseudocode for the intended implementation:
  // 1. Fetch all gymAffiliates.
  // 2. For each gym, query rounds where gymAffiliateId == gym.id.
  // 3. Compute:
  //    - roundsCreated = count of matching rounds
  //    - lastActivityDate = max(createdAt) or null
  // 4. Return an array of GymAffiliateStats.

  // For now, return an empty array so the calling UI can render a graceful
  // placeholder state. This will be replaced with real aggregation logic in
  // subsequent steps.
  return [];
}
