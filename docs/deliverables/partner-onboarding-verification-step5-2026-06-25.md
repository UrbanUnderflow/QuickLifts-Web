# Partner Onboarding Verification — Step 5

## Scope

Completed only the current step: verified the shared partner model export, the onboarding API import/POST behavior, and a live handler execution that wrote a partner document to Firestore and returned the same saved record in the API response.

## What Had To Be Fixed During Verification

The live verification surfaced a real backend issue:

1. `src/pages/api/partners/onboard.ts` was using the client Firestore SDK inside a server API route, which produced `permission-denied` on live write.
2. After switching to the Admin SDK path, the route still treated Admin `DocumentSnapshot.exists` like the client function form.

Both issues were fixed in the handler before final verification.

## Verification Method

### Code-shape checks

Confirmed:

- `server/models/partners.ts` exports the shared partner model
- `src/pages/api/partners/onboard.ts` imports the shared model from `server/models/partners.ts`
- the route accepts `POST`

### Live runtime verification

Ran a live handler verification script:

- `scripts/verifyPartnerOnboardRuntime.ts`

with project Firebase env vars loaded from `.env.local`.

This script:

1. invokes `src/pages/api/partners/onboard.ts` directly with a mocked POST request
2. submits a unique test partner payload
3. reads `/partners/{partnerId}` back from Firestore using Firebase Admin
4. prints the request body, API response, and saved Firestore document

## Live Verification Result

### Request sent

- `id = verify-partner-1782383918502`
- `type = brand`
- `name = Verification Partner`
- `contactEmail = verify+1782383918502@example.com`
- `onboardingStage = first-round-created`

### API response

- `statusCode = 200`
- `success = true`
- `partnerId = verify-partner-1782383918502`
- `partner.id = verify-partner-1782383918502`
- `partner.type = brand`
- `partner.name = Verification Partner`
- `partner.contactEmail = verify+1782383918502@example.com`
- `partner.onboardingStage = first-round-created`
- `partner.invitedAt = 2026-06-25T10:38:38.789Z`
- `partner.firstRoundCreatedAt = 2026-06-25T10:38:38.789Z`

### Firestore readback

Verified document exists at:

- `/partners/verify-partner-1782383918502`

Verified stored fields:

- `type = brand`
- `name = Verification Partner`
- `contactEmail = verify+1782383918502@example.com`
- `onboardingStage = first-round-created`
- `invitedAt` present as Firestore timestamp
- `firstRoundCreatedAt` present as Firestore timestamp

The response and Firestore document matched on the required partner fields and timing semantics.

## Files Involved In Final Verification

- `server/models/partners.ts`
- `src/pages/api/partners/onboard.ts`
- `scripts/verifyPartnerOnboardRuntime.ts`

## Conclusion

The partner onboarding API is now verified end to end:

- shared `Partner` model exists on the server
- onboarding route imports and uses that model
- POST handler writes partner records to `/partners/{partnerId}`
- `invitedAt` is persisted on first invite
- `firstRoundCreatedAt` is persisted when the first-round milestone is reached
- response returns the persisted partner record using the shared model shape
