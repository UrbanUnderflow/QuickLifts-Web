# Partner Onboarding Shared Model — Step 1

## Scope

Completed only the current step: created the shared server-owned partner data model in `server/models/partners.ts` and aligned the older `src/types/Partner.ts` file to re-export from that single source of truth.

## What Changed

### New shared server model

**File:** `server/models/partners.ts`

Added the server-owned partner model with:

- `PartnerType = 'brand' | 'gym' | 'runClub'`
- `Partner` interface
- `PartnerFirestoreData` interface
- `FirestoreTimestampLike` helper type
- `convertPartnerTimestamp(...)`
- `dateToUnixTimestamp(...)`
- `PartnerModel` class

## Shared Partner Shape

The shared `Partner` model now includes the Firestore-backed fields required for onboarding:

- `id: string`
- `type: 'brand' | 'gym' | 'runClub'`
- `name: string`
- `contactEmail: string`
- `onboardingStage: string`
- `invitedAt: Date`
- `firstRoundCreatedAt?: Date | null`

## Why This Matters

Before this change, the repo had a partner type file under `src/types/Partner.ts`, but it was missing `name` and lived on the client side. That created two problems:

1. the onboarding API step would not have a true server-owned contract
2. the existing partner schema was already drifting from the new onboarding requirements

After this change, the server model is the canonical contract and the old `src/types/Partner.ts` file becomes a compatibility shim.

## Compatibility Move

### Updated compatibility export

**File:** `src/types/Partner.ts`

Replaced the duplicated local definitions with re-exports from:

- `../../server/models/partners`

This keeps existing imports from breaking while moving schema ownership to the server model where the onboarding API can use it directly.

## Verification

Performed an import sanity check against `server/models/partners.ts` and confirmed the module exports load successfully, including `PartnerModel` and the timestamp conversion helpers.
