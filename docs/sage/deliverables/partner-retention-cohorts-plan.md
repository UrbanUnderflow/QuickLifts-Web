# Partner-Sourced Retention Cohorts — Implementation Plan

## 1. Question & Scope

**Question:** How do we compute reliable 30-day retention metrics segmented by partner channel (brand, gym, runClub) so we can track whether partnership-sourced users are hitting the 40% monthly retention target?

**Scope:**
- Use existing Firestore collections (`users` + an activity collection) to derive:
  - Cohort-level stats by `partnerSource.partnerId` and `cohortMonth`.
  - 30-day activity-based retention for each cohort.
- Persist results into a dedicated `partnerRetention` collection for downstream use (dashboards, analytics).
- Keep logic server-side in Cloud Functions; clients only **read** `partnerRetention`.

Out of scope (for this implementation):
- Fine-grained per-user timelines or daily churn curves.
- Advanced statistical smoothing; we’ll compute raw ratios and handle smoothing in downstream analytics if needed.

---

## 2. Source Data & Assumptions

### 2.1 Users (`/users`)

We’ve already extended the user schema to include:

```ts
partnerSource?: {
  type: 'brand' | 'gym' | 'runClub';
  partnerId: string;
};
```

and we have `createdAt` on user docs (Date / Timestamp / unix seconds depending on the writer).

**Assumptions:**
- `partnerSource` is set at **signup** and immutable thereafter (enforced via security rules and validators).
- `createdAt` reflects the account creation time (or is close enough for monthly cohorting).

### 2.2 Activity (`/sessions` or `/activityLogs`)

We need a minimal activity signal to call a user "active" in the last 30 days.

**Baseline assumption (for implementation):**
- We use a `sessions` collection with documents that include:
  - `userId` (or `uid`): string
  - `lastActiveAt`: Firestore Timestamp

If the actual collection is named differently (e.g., `activityLogs`), we will adapt the query in a single place in the function.

**Definition of active:**
- User is considered active in the last 30 days if they have **any** session document with `lastActiveAt >= now - 30 days`.
- We do not double-count multiple sessions; we only care that at least one exists in the window.

---

## 3. Cohort Definition

**Cohort axis:**
- `partnerId` — from `user.partnerSource.partnerId`
- `partnerType` — from `user.partnerSource.type`
- `cohortMonth` — month bucket derived from `createdAt` in **UTC** using `YYYY-MM` format.

**Cohort membership:**
- A user belongs to exactly one cohort per partner: `(partnerId, cohortMonth)` where `cohortMonth` is the month of their account creation.

**Metrics per cohort:**
- `totalUsers` — number of users in that cohort.
- `activeUsers30d` — number of those users who are active at least once in the last 30 days.
- `retentionRate` — `activeUsers30d / totalUsers` (float between 0 and 1).

---

## 4. Function Design

### 4.1 Entry point & schedule

- Implement `computePartnerRetention` in `functions/src/computePartnerRetention.ts`.
- Export it from `functions/index.js` for Firebase to discover.
- Schedule via Pub/Sub:
  - Cron: `0 4 * * *` (daily at 04:00 UTC) to avoid peak hours and stay consistent.

### 4.2 Algorithm Overview

1. **Load partner-sourced users**
   - Query `/users`.
   - Filter to docs with non-null `partnerSource.partnerId` and valid `partnerSource.type`.
   - Normalize `createdAt` to `Date` (support `Timestamp`, unix seconds, ISO string).
   - Compute `cohortMonth = YYYY-MM (UTC)`.
   - Group users into cohorts keyed by `${partnerId}_${cohortMonth}`.
   - Track for each cohort:
     - `partnerId`, `partnerType`, `cohortMonth`.
     - `totalUsers` (increment per user).
     - `userIds` (Set of user IDs in that cohort) — needed for the activity join.

2. **Load recent activity**
   - Compute `since = now - 30 days`.
   - Query `sessions` (or `activityLogs`) where `lastActiveAt >= since`.
   - Extract unique `userId`/`uid` values into `activeUserIds` (Set<string>).

3. **Join & compute metrics**
   - For each cohort:
     - `activeUsers30d = count(userIds ∩ activeUserIds)`.
     - `retentionRate = totalUsers > 0 ? activeUsers30d / totalUsers : 0`.
   - Construct `PartnerRetentionDoc` for each cohort.

4. **Write aggregates (Step 4)**
   - For each `PartnerRetentionDoc`, upsert into `/partnerRetention/{partnerId_cohortMonth}` with:
     - `partnerId`, `partnerType`, `cohortMonth`, `activeUsers30d`, `totalUsers`, `retentionRate`.
   - Optionally include a `computedAt` timestamp if we want to track when the snapshot was generated.

### 4.3 Data volume & performance considerations

- For now, we can tolerate a full scan of `/users` once per day; partner-sourced users are a subset.
- Activity query is bounded by a 30-day window, which keeps `sessions` query manageable.
- We use in-memory maps and Sets for aggregation; if this becomes too large, we can:
  - Shard by partner or month.
  - Add a filter on `createdAt` (e.g., last N months) to avoid recomputing very old cohorts daily.

---

## 5. Edge Cases & Safety

- Users without `partnerSource` → ignored; they belong to no partner cohort.
- Users with invalid or missing `createdAt` → ignored for cohorting (we avoid mis-bucketing).
- If the `sessions` query fails (e.g., collection missing or permissions), we:
  - Log a warning.
  - Treat `activeUsers30d = 0` for this run rather than breaking the function.
- If `totalUsers = 0` (shouldn’t happen if we only create cohorts with users), we guard and set `retentionRate = 0`.

---

## 6. Testing Strategy (for later execution step)

- **Unit-ish tests with firebase-functions-test:**
  - Seed `/users` with:
    - Partner-sourced users across different months and partner types.
    - Non-partner users.
  - Seed `/sessions` with lastActiveAt inside and outside the 30-day window.
  - Invoke `computePartnerRetention` handler directly.
  - Assert that:
    - Cohorts are created only for partner-sourced users.
    - `totalUsers` per cohort matches the seeded data.
    - `activeUsers30d` and `retentionRate` match expected values.

- **Integration / smoke test:**
  - Deploy to a dev project.
  - Manually create a few users with `partnerSource` and synthetic sessions.
  - Trigger `computePartnerRetention` via `firebase functions:shell` or wait for schedule.
  - Inspect `/partnerRetention` for correct aggregates.

---

## 7. Implementation Checklist

1. [x] Define `PartnerRetentionDoc` in `functions/src/models/partnerRetention.ts`.
2. [x] Implement `computePartnerRetention` skeleton with user cohorting.
3. [x] Add activity join logic to compute `activeUsers30d` + `retentionRate` per cohort.
4. [ ] Implement Firestore writes to `/partnerRetention/{partnerId_cohortMonth}`.
5. [ ] Add Jest / firebase-functions-test-based integration test in `functions/src/__tests__/computePartnerRetention.test.ts`.
6. [ ] Wire `computePartnerRetention` export in `functions/index.js` and deploy to dev.

This plan keeps the retention computation fully server-side, tightly coupled to the `partnerSource` field we just added to user profiles, and produces a clean `partnerRetention` dataset that the partner dashboard can read without complex joins at request time.