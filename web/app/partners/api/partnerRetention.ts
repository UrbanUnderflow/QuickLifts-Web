// web/app/partners/api/partnerRetention.ts
// Data-access helper for partner retention metrics used by the partner dashboard.
//
// This module is written to be compatible with the Next.js App Router "web" app.
// Once the shared Firestore client for the web app is finalized, the TODO
// section below should be wired to the real `partnerRetention` collection.
//
// Intended Firestore shape (proposed):
//   Collection: partnerRetention
//   Document id: auto or `${partnerId}_${yyyy-MM-dd}`
//   Fields:
//     - partnerId: string
//     - date: Timestamp (UTC, day-level granularity)
//     - retentionRate30d: number  // 0.0–1.0 representing 30-day behavior retention
//
// Query semantics for this helper:
//   - Filter by partnerId
//   - Filter to the last 30 calendar days (inclusive)
//   - Order by date ascending so charts can plot directly

export type PartnerRetentionPoint = {
  /** ISO-8601 date string (yyyy-MM-dd) representing the day of the metric. */
  date: string;
  /** 30-day behavior/usage retention for that day (0.0–1.0). */
  retentionRate: number;
};

/**
 * getPartnerRetention
 *
 * Returns a 30-day time series of behavior/usage retention for a given partner.
 *
 * This function intentionally exposes a narrow, UI-friendly shape so the
 * partner dashboard can render charts and threshold styling without needing
 * to know about Firestore internals.
 */
export async function getPartnerRetention(
  partnerId: string
): Promise<PartnerRetentionPoint[]> {
  if (!partnerId) {
    return [];
  }

  // TODO: Wire this to the actual Firestore client for the web app.
  //
  // Pseudocode for the intended implementation:
  //
  //   const db = getWebFirestoreClient();
  //   const now = new Date();
  //   const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  //
  //   const q = query(
  //     collection(db, "partnerRetention"),
  //     where("partnerId", "==", partnerId),
  //     where("date", ">=", Timestamp.fromDate(thirtyDaysAgo)),
  //     orderBy("date", "asc")
  //   );
  //
  //   const snapshot = await getDocs(q);
  //
  //   return snapshot.docs.map((doc) => {
  //     const data = doc.data();
  //     const date = (data.date as Timestamp).toDate();
  //     return {
  //       date: date.toISOString().slice(0, 10), // yyyy-MM-dd
  //       retentionRate: Number(data.retentionRate30d ?? 0),
  //     };
  //   });
  //
  // Until the shared client is available, we return an empty series so that
  // the dashboard can render a graceful "no data" state.

  return [];
}

