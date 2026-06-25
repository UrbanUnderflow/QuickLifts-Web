# Partner Onboarding Handler Validation — Step 2

## Scope

Completed only the current step: updated the POST handler at `src/pages/api/partners/onboard.ts` so it validates the required onboarding payload fields, rejects unsupported partner types, and normalizes the request into the shared server-owned partner model shape before write logic runs.

## What Changed

### Handler import alignment

The handler now imports the shared server-owned partner model directly from:

- `server/models/partners.ts`

instead of relying on the older client-side type surface.

### Required payload fields enforced

The POST body validation now requires:

- `type`
- `name`
- `contactEmail`
- `onboardingStage`

and returns explicit validation errors when any are missing or invalid.

### Allowed type enforcement

The handler explicitly restricts `type` to:

- `brand`
- `gym`
- `runClub`

Unsupported values are rejected at validation time.

### Normalization into shared model shape

Before any Firestore write path runs, the handler now normalizes the request into the shared partner contract:

- `id` resolves from explicit `id` or normalized email
- `type` is validated as a `PartnerType`
- `name` is trimmed and persisted as `name`
- `contactEmail` is trimmed and lowercased
- `onboardingStage` is required and trimmed

This normalized object is built against the shared `Partner` model fields instead of an ad hoc request shape.

## Supporting Fix

While validating the handler against the new shared model, the shared timestamp conversion logic in `server/models/partners.ts` needed a stronger object type guard for Firestore timestamp-like values. That guard was added so the server model narrows cleanly.

## Verification

Verified directly in code that:

- `src/pages/api/partners/onboard.ts` imports from `server/models/partners.ts`
- validation requires `name`
- validation requires `onboardingStage`
- the handler builds a normalized partner object before write logic

A bounded TypeScript check also surfaced unrelated repo-level TypeScript issues outside this handler path, but the handler-specific validation changes and shared model alignment are in place for this step.
