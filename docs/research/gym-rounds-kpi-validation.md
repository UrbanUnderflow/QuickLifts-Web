# Validation: Gym Member Activation KPIs for Rounds

This document summarizes what has been implemented for gym member activation KPIs around rounds, and what still requires manual, environment-specific validation.

## 1. Implemented Instrumentation (Quick Recap)

### 1.1 Gym affiliate schema

**File:** `functions/src/models/gymAffiliate.ts`

Fields relevant to KPIs:

- `memberSignupCount: number`
- `roundsCreated?: number`
- `uniqueParticipants?: number`
- `uniqueParticipantUserIds?: string[]`

These are used as follows:

- `roundsCreated`: incremented when a round associated with a gym is created (integration point depends on canonical round creation handler).
- `uniqueParticipants`: incremented when a new user (per-gym) joins any gym-associated round.
- `uniqueParticipantUserIds`: set of user IDs that have been counted, enforcing uniqueness.

### 1.2 Participation → uniqueParticipants

**File:** `netlify/functions/join-challenge.js`

Behavior on successful join:

- Load challenge from `sweatlist-collection/{challengeId}`.
- After writing `user-challenge/{userChallengeId}`:
  - If `challenge.gymAffiliateId` is present:
    - Run a transaction on `gymAffiliates/{gymAffiliateId}`:
      - Read `uniqueParticipantUserIds` and `uniqueParticipants`.
      - If `userId` is **not** in `uniqueParticipantUserIds`:
        - Append `userId`.
        - Increment `uniqueParticipants` by 1.
      - If already present: log + no-op.

Result: `uniqueParticipants` is a count of distinct users who have joined at least one round for a given gym affiliate.

### 1.3 Partner-facing data loader

**File:** `web/lib/partners/getGymKpis.ts`

- `getGymKpisForAffiliate(gymAffiliateId)` → reads `gymAffiliates/{gymAffiliateId}` and returns:
  - `gymAffiliateId`
  - `gymName`
  - `memberSignupCount`
  - `roundsCreated`
  - `uniqueParticipants`

- `getGymKpisForUser(userId)` → resolves the current user's affiliate via:
  - `gymAffiliateId` field on the user document, or
  - `gymInviteCode` → lookup in `gymAffiliates` by `inviteCode`.

### 1.4 Partner dashboard UI

**Files:**

- `web/components/partners/GymKpiPanel.tsx`
- `web/app/partners/dashboard.tsx`

`GymKpiPanel`:

- Accepts `userId` (current partner user).
- Calls `getGymKpisForUser(userId)`.
- Renders a small grid with:
  - Gym name
  - Rounds Created
  - Unique Participants

`dashboard.tsx`:

- Imports and renders `GymKpiPanel` in a "Gym Activation Snapshot" section.
- Currently uses a placeholder user ID: `"__REPLACE_WITH_CURRENT_USER_ID__"`.
  - This must be swapped for a real authenticated user ID when integrating with partner auth.

---

## 2. Automated / Programmatic Checks (This Environment)

Due to environment constraints (no Netlify deploy from this process), end-to-end behavior through the live Netlify functions cannot be fully executed here. However, we can validate the shape of the data and the static logic.

### 2.1 Static checks

- `gymAffiliates` documents are verified to contain:
  - `gymId`, `gymName`, `partnerId`, `inviteCode`, `memberSignupCount`.
- Code paths:
  - `join-challenge.js` includes a conditional block for `challenge.gymAffiliateId` and transactional updates for `uniqueParticipants` and `uniqueParticipantUserIds`.
  - `getGymKpisForAffiliate` and `getGymKpisForUser` use Firestore client API from `src/api/firebase/config` and return fields typed as `GymKpis`.
  - `GymKpiPanel` correctly consumes `GymKpis` and handles loading, error, and no-data states.
  - `dashboard.tsx` compiles conceptually with the new import and layout.

Static review confirms:

- No obvious type mismatches for the added fields.
- KPI names and semantics match the plan (`gym-rounds-kpi-instrumentation-plan.md`).

---

## 3. Manual Validation Plan (Post-Deploy)

After deploying Netlify functions and the Next.js frontend, run the following tests.

### 3.1 Pre-conditions

1. **Deploy Netlify functions** with the updated `join-challenge.js`:

   ```bash
   netlify deploy --prod --dir=out  # or your existing deployment command
   ```

   Ensure the build includes the modified `netlify/functions/join-challenge.js`.

2. **Ensure a gym affiliate exists**:

   - `gymAffiliates/{gymAffiliateId}` with:
     - `gymName`
     - `memberSignupCount`
     - `roundsCreated` (0 or existing value)
     - `uniqueParticipants` (0 or existing value)
     - Optionally `uniqueParticipantUserIds`.

3. **Ensure at least one challenge/round is associated with the gym**:

   - `sweatlist-collection/{challengeId}` document should include:
     - `gymAffiliateId: <gymAffiliateId>`

### 3.2 Unique Participants KPI

**Goal:** Confirm that `uniqueParticipants` increments once per distinct user joining any gym-associated round.

1. Pick a gym (`gymAffiliateId`) and a challenge (`challengeId`) where the challenge doc has `gymAffiliateId` set.
2. Choose 3 distinct test users (`userId1`, `userId2`, `userId3`).
3. For each user, perform a join via the front-end flow or direct Netlify function call:

   - Front-end: use the normal "join challenge" UI.
   - Direct: send POST to the `/.netlify/functions/join-challenge` endpoint with the appropriate payload.

4. After all 3 users have joined:

   - Check `gymAffiliates/{gymAffiliateId}` in Firestore:
     - `uniqueParticipants` should have increased by 3 compared to the baseline.
     - `uniqueParticipantUserIds` should contain all three user IDs.

5. Have one of the same users join another round associated with the same gym:

   - Confirm that `uniqueParticipants` and `uniqueParticipantUserIds` **do not** change for that user.

### 3.3 Partner Dashboard KPIs

1. Deploy the web app with updated `web/app/partners/dashboard.tsx` and `GymKpiPanel`.
2. Wire `GymKpiPanel` to a real authenticated user ID for a gym operator:

   ```tsx
   // Rough example with context/hook (implementation-specific):
   const { user } = useAuth();
   <GymKpiPanel userId={user?.uid ?? ""} />
   ```

3. Log in as a gym operator whose user document has:

   - `gymAffiliateId` set to that affiliate, or
   - At least `gymInviteCode` that matches an affiliate.

4. Open `web/app/partners/dashboard` and confirm:

   - The "Gym" name matches the affiliate.
   - "Rounds Created" matches `gymAffiliates/{gymAffiliateId}.roundsCreated` (may be 0 if not yet incremented).
   - "Unique Participants" matches `gymAffiliates/{gymAffiliateId}.uniqueParticipants`.

### 3.4 Rounds Created KPI (optional extension)

If/when the canonical round creation handler is identified and instrumented:

1. Create a new round/challenge for the gym affiliate.
2. Confirm:
   - Round/challenge doc has `gymAffiliateId` set.
   - `gymAffiliates/{gymAffiliateId}.roundsCreated` increments by 1.
   - Dashboard "Rounds Created" reflects the new value.

---

## 4. Known Limitations & Future Improvements

- **`uniqueParticipantUserIds` size:** For very large gyms with many participants, this array can grow large. If it becomes an issue, consider:
  - Moving to a `gymAffiliates/{id}/participants` sub-collection and computing `uniqueParticipants` via aggregation.
  - Periodic summarization jobs that compress this information.

- **`roundsCreated` hook:** The instrumentation plan assumes a single place where gym rounds are created. Once that path is cemented (Netlify function or Cloud Function), additional transactional increments should be added there.

- **Auth wiring for `GymKpiPanel`:** Currently uses a placeholder user ID. Proper wiring to the real partner/gym operator auth context is required for production.

---

## 5. Files Touched by This Work

For quick reference, these are the main files touched as part of the overall KPI instrumentation:

- `functions/src/models/gymAffiliate.ts` — KPI fields added.
- `netlify/functions/join-challenge.js` — transactional updates to `uniqueParticipants` and `uniqueParticipantUserIds` on joins.
- `web/lib/partners/getGymKpis.ts` — loader returning `roundsCreated` and `uniqueParticipants` per affiliate/user.
- `web/components/partners/GymKpiPanel.tsx` — UI component for gym KPIs.
- `web/app/partners/dashboard.tsx` — integrates `GymKpiPanel` into the partner dashboard.
- `docs/research/gym-rounds-kpi-instrumentation-plan.md` — design/plan.
- `docs/research/gym-rounds-kpi-validation.md` — this validation summary.
