# Plan: Instrument Gym Member Activation KPIs for Rounds

**Scope.** Define how to instrument backend + web to measure gym partner activation around rounds:

- Tag rounds with `gymAffiliateId` when created via a gym partner.
- Track **roundsCreated** and **uniqueParticipants** per gym in `gymAffiliates`.
- Surface KPIs in the partner dashboard for gym operators and internal admins.

This plan focuses on the behavioral model, data model, and integration points. Execution and verification are covered in later steps.

---

## 1. Behavioral Model & KPIs

### 1.1 KPIs to track per gym affiliate

**Core KPIs:**

1. `roundsCreated`
   - Definition: Total count of Pulse rounds (or challenges) that are explicitly associated with a given gym affiliate.
   - Purpose: Measures how actively the gym is using Pulse to run structured challenges/rounds.

2. `uniqueParticipants`
   - Definition: Count of distinct users who have joined at least one round associated with that gym affiliate.
   - Purpose: Measures penetration of Pulse within the gym’s member base; directly feeds the "50% of members create Pulse accounts" objective.

**Secondary fields (supporting the KPIs):**

- `uniqueParticipantUserIds: string[]`
  - Definition: The set of user IDs counted toward `uniqueParticipants` for that gym.
  - Purpose: Ensures we do **not double-count** members who join multiple rounds for the same gym.

### 1.2 Behavioral assumptions

- A "gym round" is any challenge/round where the canonical challenge/round document includes `gymAffiliateId`.
- A user should only be counted once toward `uniqueParticipants` per gym, regardless of how many rounds they join with that gym.
- Participation events are primarily handled by the existing **join-challenge** path (`netlify/functions/join-challenge.js`) which writes to `user-challenge`.

---

## 2. Data Model Changes

### 2.1 `gymAffiliates` collection

**Existing schema (from previous task):**

- `gymId: string`
- `gymName: string`
- `partnerId: string` (doc ID in `partners` collection)
- `inviteCode: string`
- `memberSignupCount: number`

**Additions for round KPIs:**

- `roundsCreated?: number`
  - Default: `0` when unset.
  - Incremented when a new round associated with this gym is created.

- `uniqueParticipants?: number`
  - Default: `0` when unset.
  - Incremented only when a **new** user (not previously counted for this gym) joins any gym-associated round.

- `uniqueParticipantUserIds?: string[]`
  - Used to track which users have already been counted toward `uniqueParticipants`.
  - Must be updated transactionally along with `uniqueParticipants` to avoid race conditions.

### 2.2 Round / challenge documents

There are two relevant document types:

1. **Canonical challenge/round doc** (currently lives in `sweatlist-collection` for join-challenge.js)
   - Add optional `gymAffiliateId?: string` to the challenge schema.
   - When a challenge/round is created as part of a gym partner’s flow, the backend should set this field.

2. **User challenge / user-round doc** (`user-challenge` collection)
   - Already exists (`join-challenge.js` writes these).
   - Does not need to store `gymAffiliateId`, as it can be derived from the parent challenge; but we may propagate it in the future for easier querying.

### 2.3 Round model in functions

- `functions/src/models/round.ts` defines:

```ts
export interface Round {
  id?: string;
  gymAffiliateId?: string | null;
}
```

- Keep this as the canonical type for any new rounds-related Cloud Functions module (`functions/src/rounds.ts`) that might be introduced later.

---

## 3. Backend Integration Points

### 3.1 Round creation → `roundsCreated`

**Desired behavior:**

- When a new challenge/round is created for a gym affiliate, increment `roundsCreated` for that gym.

**Integration point:**

- Identify or introduce a canonical, server-side round/challenge creation handler. Candidates:
  - A Netlify function responsible for creating documents in `sweatlist-collection` / `rounds`.
  - A Cloud Function (`functions/src/rounds.ts`) invoked from the frontend or via Firestore triggers.

**Plan:**

1. Add `gymAffiliateId` to the round creation payload when the following conditions hold:
   - The request payload includes `gymAffiliateId` **or**
   - The creator user has a `gymAffiliateId` on their `users/{userId}` document.

2. When writing the round/challenge document:
   - Persist `gymAffiliateId` directly on the round/challenge doc.

3. After successfully creating the round/challenge doc:
   - Run a Firestore transaction on `gymAffiliates/{gymAffiliateId}`:

   ```ts
   tx.update(gymAffiliateRef, {
     roundsCreated: (data.roundsCreated ?? 0) + 1,
     lastActivityDate: new Date(), // optional, if we want recency
   });
   ```

   - This ensures `roundsCreated` reflects the count of gym-associated rounds.

### 3.2 User joins round → `uniqueParticipants`

**Current participation path:**

- Netlify function: `netlify/functions/join-challenge.js`
  - Accepts `{ username, challengeId, sharedBy }`.
  - Looks up the user by `username`, and the challenge by `challengeId`.
  - Creates a `user-challenge/{userChallengeId}` document.

**Enhancement plan (already partially implemented in a prior step):**

1. Ensure challenge docs in `sweatlist-collection` have `gymAffiliateId` when relevant.
2. In `join-challenge.js`, after `user-challenge` creation:
   - If `challenge.gymAffiliateId` exists:
     - Start a Firestore transaction on `gymAffiliates/{gymAffiliateId}`.
     - Load `uniqueParticipantUserIds` and `uniqueParticipants`.
     - If `userId` is **not** in `uniqueParticipantUserIds`:
       - Append `userId` to `uniqueParticipantUserIds`.
       - Increment `uniqueParticipants` by 1.
     - Else: log and skip increment.

This guarantees per-gym uniqueness and safely handles concurrent joins.

---

## 4. Web / Dashboard Integration

### 4.1 Data loader

**File:** `web/lib/partners/getGymKpis.ts` (already created in previous execution step)

Responsibilities:

- `getGymKpisForAffiliate(gymAffiliateId)`
  - Reads `gymAffiliates/{gymAffiliateId}` and returns:
    - `gymName`
    - `memberSignupCount`
    - `roundsCreated`
    - `uniqueParticipants`

- `getGymKpisForUser(userId)`
  - Resolves the user’s gym affiliate via `gymAffiliateId` or `gymInviteCode`.
  - Delegates to `getGymKpisForAffiliate`.

### 4.2 Partner dashboard UI

**File:** `web/app/partners/dashboard.tsx`

- Admin-facing onboarding table is already implemented.
- Add a **Gym Activation Snapshot** section using a dedicated component:
  - `web/components/partners/GymKpiPanel.tsx`
  - Uses `getGymKpisForUser` to show per-gym KPIs:
    - `Rounds Created`
    - `Unique Participants`

**Open TODO:**

- The current implementation uses a placeholder user ID (`"__REPLACE_WITH_CURRENT_USER_ID__"`).
- When wiring this for real gym operators, replace with the authenticated user’s ID from the auth context.

---

## 5. Validation Plan (End-to-End)

After backend + frontend changes are implemented and deployed:

1. **Seed / verify gym affiliate**
   - Ensure `gymAffiliates/{gymId}` exists with:
     - `memberSignupCount`
     - `roundsCreated` (initially 0)
     - `uniqueParticipants` (initially 0)

2. **Create a gym-associated round**
   - Use the gym partner flow to create a new round/challenge that sets `gymAffiliateId` on the round/challenge doc.
   - Confirm in Firestore:
     - New round doc has `gymAffiliateId`.
     - `gymAffiliates/{gymId}.roundsCreated` increased by 1.

3. **Join the round with multiple test users**
   - For each of 2–3 distinct users:
     - Ensure the user has `gymAffiliateId` or `gymInviteCode` linking them to the gym.
     - Call the join endpoint (e.g., UI or direct POST to `/.netlify/functions/join-challenge`).
   - Confirm in Firestore:
     - `user-challenge` docs created.
     - `gymAffiliates/{gymId}.uniqueParticipants` increased by the number of **distinct** test users.
     - `uniqueParticipantUserIds` array contains their user IDs.

4. **Check partner dashboard**
   - Load `web/app/partners/dashboard`.
   - Wire `GymKpiPanel` to a real userId for a gym operator.
   - Confirm the panel displays:
     - Correct `Gym` name.
     - `Rounds Created` matching Firestore.
     - `Unique Participants` matching Firestore.

---

## 6. Risks & Open Questions

- **Storage of `uniqueParticipantUserIds`:**
  - Pros: Simplifies uniqueness logic.
  - Cons: Potentially large arrays for very active gyms.
  - Mitigation: For now, acceptable; if it grows too large, consider:
    - Moving to a separate `gymAffiliateParticipants` sub-collection.
    - Computing `uniqueParticipants` via aggregation instead of storing the list.

- **Where is the canonical round creation endpoint?**
  - Currently, challenge participation is clearly defined (`join-challenge.js`), but round/challenge creation is more fragmented.
  - This plan assumes a single server-side creation path that can be instrumented to increment `roundsCreated` and tag `gymAffiliateId`.

---

## Summary

This plan defines:

- **KPIs:** `roundsCreated`, `uniqueParticipants`, and supporting `uniqueParticipantUserIds` per gym affiliate.
- **Data model:** Extensions to `gymAffiliates` and round/challenge docs to carry `gymAffiliateId`.
- **Backend integration:**
  - Round creation increments `roundsCreated`.
  - User joins increment `uniqueParticipants` exactly once per user per gym.
- **Dashboard integration:**
  - `getGymKpisForUser` / `getGymKpisForAffiliate` loaders.
  - `GymKpiPanel` surfaced in the partner dashboard for clear gym-level activation KPIs.

This gives a clear blueprint for implementing, verifying, and iterating on gym activation instrumentation in the Pulse rounds ecosystem.
