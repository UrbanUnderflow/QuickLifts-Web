// functions/src/models/partnerRetention.ts
//
// Firestore schema model for partner retention aggregate documents.
// These documents are written by the scheduled `computePartnerRetention`
// Cloud Function and consumed by the web partner dashboard and analytics
// tooling.

/**
 * PartnerRetentionDoc
 *
 * Aggregated 30-day retention metrics for a given partner cohort.
 * Each document represents users sourced from a specific partner (brand,
 * gym, or run club) who signed up in a specific cohort month.
 */
export interface PartnerRetentionDoc {
  /** ID of the associated partner document (e.g., in `partners` or `gymAffiliates`). */
  partnerId: string;

  /** High-level partner type used for segmentation (aligned with PartnerSource.type). */
  partnerType: "brand" | "gym" | "runClub";

  /**
   * Cohort month identifier in `YYYY-MM` format (UTC).
   * Represents the month in which the user accounts in this cohort were created.
   */
  cohortMonth: string;

  /**
   * Number of users in this cohort who have been active at least once in the
   * last 30 days at the time the aggregation was computed.
   */
  activeUsers30d: number;

  /**
   * Total number of users in this partner + cohortMonth cohort (regardless of
   * recent activity).
   */
  totalUsers: number;

  /**
   * 30-day retention rate for this cohort, defined as
   * `activeUsers30d / totalUsers`. Stored as a number between 0.0 and 1.0.
   */
  retentionRate: number;
}

export default PartnerRetentionDoc;
