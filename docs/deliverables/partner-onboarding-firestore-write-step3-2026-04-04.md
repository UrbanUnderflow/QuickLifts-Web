# Partner Onboarding Firestore Write — Step 3

## Scope

Completed only the current step: updated the Firestore write behavior in `src/pages/api/partners/onboard.ts` so the onboarding handler writes the required partner fields into the `partners` collection with correct first-invite and first-round timestamp rules.

## What Changed

### Firestore write target

The handler continues to write to:

- `/partners/{partnerId}`

where `partnerId` resolves from explicit `id` or normalized `contactEmail`.

### Fields written

The write payload now explicitly carries the required Firestore-backed partner fields:

- `type`
- `name`
- `contactEmail`
- `onboardingStage`
- `invitedAt`
- optional `firstRoundCreatedAt`

## Timestamp Semantics

### `invitedAt`

`invitedAt` is written with `serverTimestamp()` only when the partner document is first created.

That preserves first-invite timing so time-to-active can be measured consistently instead of being reset on update.

### `firstRoundCreatedAt`

`firstRoundCreatedAt` is now written with `serverTimestamp()` when either of these is true:

1. the request explicitly passes `firstRoundCreated: true`
2. the normalized `onboardingStage` already indicates the first-round milestone has been reached

The local milestone helper currently treats these stages as first-round milestones:

- `first-round-created`
- `first_round_created`
- `first round created`
- `round-created`
- `round_created`
- `round created`
- `active`
- `live`

On updates, `firstRoundCreatedAt` is only set if it is not already present, so the first-round timestamp remains a true first-seen marker.

## Why This Matters

Before this change, the write path only set `firstRoundCreatedAt` from an explicit boolean flag. That was brittle because the handler could receive a later onboarding stage that clearly means the first round exists, yet still fail to stamp the milestone.

After this change:

- first invite is tracked once
- first round milestone can be inferred from the onboarding stage when appropriate
- existing milestone timestamps are preserved on update

## Verification

Verified directly in code that:

- `invitedAt` is written only on create with `serverTimestamp()`
- `firstRoundCreatedAt` is driven by either explicit flag or first-round stage milestone
- update logic writes `firstRoundCreatedAt` only when it was not already present
- create logic writes `firstRoundCreatedAt` when the milestone condition is satisfied
