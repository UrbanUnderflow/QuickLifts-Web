// functions/src/computePartnerRetention.ts
//
// Scheduled Cloud Function to compute 30-day retention cohorts for
// partner-sourced users and write aggregated stats into `partnerRetention`.

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import { PartnerRetentionDoc } from "./models/partnerRetention";
import { PartnerSource } from "./models/user";

const db = admin.firestore();

/**
 * Helper: format a Date as `YYYY-MM` in UTC for cohort bucketing.
 */
function formatCohortMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * computePartnerRetention
 *
 * Runs daily and groups users with a `partnerSource` by:
 *  - partnerSource.partnerId
 *  - partnerSource.type
 *  - cohortMonth (derived from createdAt)
 *
 * Step 2 implementation focuses on loading users and computing `totalUsers`
 * per partnerId / cohortMonth pair. Subsequent steps will enrich these groups
 * with activity data and write PartnerRetentionDoc records.
 */
export const computePartnerRetention = functions.pubsub
  .schedule("0 4 * * *") // run daily at 04:00 UTC
  .timeZone("UTC")
  .onRun(async () => {
    const userSnapshots = await db.collection("users").get();

    type CohortKey = string; // `${partnerId}_${cohortMonth}`

    const cohortTotals: Record<CohortKey, {
      partnerId: string;
      partnerType: PartnerSource["type"];
      cohortMonth: string;
      totalUsers: number;
    }> = {};

    userSnapshots.forEach((docSnap) => {
      const data = docSnap.data() as any;
      const partner: PartnerSource | undefined = data.partnerSource;

      if (!partner || !partner.partnerId || !partner.type) {
        return; // skip non-partner-sourced users
      }

      const createdAtValue = data.createdAt;
      let createdAt: Date | null = null;

      if (createdAtValue instanceof admin.firestore.Timestamp) {
        createdAt = createdAtValue.toDate();
      } else if (typeof createdAtValue === "number") {
        // Some code paths store unix seconds; normalize to Date
        createdAt = new Date(createdAtValue * 1000);
      } else if (typeof createdAtValue === "string") {
        const parsed = new Date(createdAtValue);
        if (!isNaN(parsed.getTime())) createdAt = parsed;
      }

      // If createdAt is missing or invalid, skip for cohorting; we don't want
      // to mix undefined dates into month buckets.
      if (!createdAt) return;

      const cohortMonth = formatCohortMonth(createdAt);
      const key: CohortKey = `${partner.partnerId}_${cohortMonth}`;

      if (!cohortTotals[key]) {
        cohortTotals[key] = {
          partnerId: partner.partnerId,
          partnerType: partner.type,
          cohortMonth,
          totalUsers: 0,
        };
      }

      cohortTotals[key].totalUsers += 1;
    });

    // For now, log the computed totals. Step 3/4 will augment this with
    // activeUsers30d and write PartnerRetentionDoc entries.
    const summary: PartnerRetentionDoc[] = Object.values(cohortTotals).map((c) => ({
      partnerId: c.partnerId,
      partnerType: c.partnerType,
      cohortMonth: c.cohortMonth,
      totalUsers: c.totalUsers,
      activeUsers30d: 0,
      retentionRate: 0,
    }));

    console.log("[computePartnerRetention] Computed cohort totals", {
      cohortCount: summary.length,
      examples: summary.slice(0, 5),
    });

    return null;
  });
