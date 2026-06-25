# Brand Campaign Banner End-to-End Verification — Step 5

## Scope

Completed only the current step: verified the banner export surface, the live `/home` runtime path, and the active `brandCampaigns` Firestore document that drives the co-branded home banner.

## What Was Verified

### 1. Component export exists

**File:** `web/components/BrandCampaignBanner.tsx`

Confirmed:

- named export exists: `export function BrandCampaignBanner(...)`
- default export exists: `export default BrandCampaignBanner`

### 2. Home runtime path renders the banner first

**Files:**

- `web/app/home.tsx`
- `src/pages/home.tsx`

`web/app/home.tsx` already renders `<BrandCampaignBanner />` at the top of the home feed.

During verification, I found that the live app runtime serves `/home` through the `src/pages` router, so `web/app/home.tsx` alone was not mounted as a real route. I added a thin bridge page:

- `src/pages/home.tsx` → re-exports `../../web/app/home`

That makes the runtime route truthful instead of theoretical.

### 3. Active Firestore campaign exists and matches the expected banner fields

**Collection:** `brandCampaigns`

**Document ID:** `gymshark-tier1-test-campaign`

Confirmed live values:

- `brandName = Gymshark`
- `campaignTitle = Gymshark Summer Strength Drop — Test Campaign`
- `ctaText = Open the co-branded challenge`
- `ctaLink = /partners/brands/gymshark`
- `logoUrl` present
- `activeFrom` is before now
- `activeTo` is after now

This means the record is eligible for the tier-1 active-window selection logic.

### 4. Browser/runtime verification

Started the local app server and opened:

- `http://localhost:3020/home`

After adding the page-router bridge, the route resolves through the actual runtime path instead of 404ing.

## Guardrail

This verification uses an internal test fixture in Firestore.

Any real Gymshark partnership status remains **Unverified** and should not be represented as a live commercial relationship without source-of-truth evidence.

## Files

- `src/pages/home.tsx`
- `docs/deliverables/brand-campaign-banner-step5-verification-2026-06-25.md`
