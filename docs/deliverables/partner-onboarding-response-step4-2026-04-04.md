# Partner Onboarding Response Contract — Step 4

## Scope

Completed only the current step: updated the response logic in `src/pages/api/partners/onboard.ts` so the handler returns the created or updated partner record from `/partners/{partnerId}` using the shared `Partner` type with persisted id and resolved Firestore timestamp fields.

## What Changed

### Re-read after write remains authoritative

The handler still re-reads the saved document from:

- `/partners/{partnerId}`

after the Firestore write completes.

This keeps the response based on actual persisted state instead of echoing request data.

### Response now uses shared `Partner` type

The response path now builds:

- `const partner: Partner = { ... }`

from the shared server-owned model hydrated via:

- `new PartnerModel(partnerId, finalData)`

That means the response uses the same canonical shape as the Firestore-backed server model.

### Fields returned

The returned `partner` object now includes:

- `id`
- `type`
- `name`
- `contactEmail`
- `onboardingStage`
- `invitedAt`
- `firstRoundCreatedAt`

The timestamp fields come back as resolved values from the saved Firestore document after readback.

### Readback guard added

If the document is unexpectedly missing after `setDoc`, the handler now throws an explicit error instead of constructing a response from undefined data.

## Why This Matters

Before this change, the handler returned a partial hand-built object that:

- omitted `name`
- exposed an extra `playbook` snapshot outside the shared `Partner` contract
- relied on a looser custom response shape

After this change, the response matches the shared server contract and reflects the actual persisted record shape required for onboarding state tracking.

## Verification

Verified directly in code that:

- the handler defines a typed response body
- the response builds `const partner: Partner = { ... }`
- `name` is included in the returned payload
- readback existence is checked before building the response
- the prior ad hoc `playbook` field is no longer included in the returned partner record
