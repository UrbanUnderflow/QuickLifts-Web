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
    const now = new Date();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const since = new Date(now.getTime() - THIRTY_DAYS_MS);

    const userSnapshots = await db.collection("users").get();

    type CohortKey = string; // `${partnerId}_${cohortMonth}`

    const cohorts: Record<
      CohortKey,
      {
        partnerId: string;
        partnerType: PartnerSource["type"];
        cohortMonth: string;
        totalUsers: number;
        userIds: Set<string>;
        activeUsers30d: number;
      }
    > = {};

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

      if (!cohorts[key]) {
        cohorts[key] = {
          partnerId: partner.partnerId,
          partnerType: partner.type,
          cohortMonth,
          totalUsers: 0,
          userIds: new Set<string>(),
          activeUsers30d: 0,
        };
      }

      cohorts[key].totalUsers += 1;
      cohorts[key].userIds.add(docSnap.id);
    });

    // ---- Step 3: join with recent activity to compute activeUsers30d ----
    //
    // For now, we assume a generic `sessions` collection where each document
    // has at least:
    //   - userId: string
    //   - lastActiveAt: Timestamp | number | ISO string
    //
    // If your project uses a different collection name (e.g. `activityLogs`),
    // this query should be updated accordingly.

    const activeUserIds = new Set<string>();

    try {
      const sessionsRef = db.collection("sessions");
      const querySnap = await sessionsRef
        .where("lastActiveAt", ">=", admin.firestore.Timestamp.fromDate(since))
        .get();

      querySnap.forEach((sessionDoc) => {
        const sdata = sessionDoc.data() as any;
        const uid: string | undefined = sdata.userId || sdata.uid;
        if (typeof uid === "string" && uid.trim()) {
          activeUserIds.add(uid.trim());
        }
      });
    } catch (err) {
      console.warn("[computePartnerRetention] Failed to query recent sessions; falling back to 0 active users.", err);
    }

    // Count active users per cohort and compute retentionRate stub
    const summary: PartnerRetentionDoc[] = Object.values(cohorts).map((c) => {
      const activeCount = Array.from(c.userIds).filter((uid) => activeUserIds.has(uid)).length;
      const retentionRate = c.totalUsers > 0 ? activeCount / c.totalUsers : 0;

      return {
        partnerId: c.partnerId,
        partnerType: c.partnerType,
        cohortMonth: c.cohortMonth,
        totalUsers: c.totalUsers,
        activeUsers30d: activeCount,
        retentionRate,
      };
    });

    console.log("[computePartnerRetention] Computed cohort retention", {
      cohortCount: summary.length,
      examples: summary.slice(0, 5),
    });

    // Persist aggregates into `partnerRetention` as upserts.
    const batch = db.batch();
    summary.forEach((doc) => {
      const docId = `${doc.partnerId}_${doc.cohortMonth}`;
      const ref = db.collection("partnerRetention").doc(docId);
      batch.set(ref, doc, { merge: true });
    });

    await batch.commit();

    console.log("[computePartnerRetention] Wrote partnerRetention aggregates", {
      written: summary.length,
    });

    return null;
  });
