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

`web/app/home.tsx` renders `<BrandCampaignBanner />` at the top of the home feed.

During verification, I found two runtime blockers and fixed both:

1. the live app serves `/home` through the `src/pages` router, so `web/app/home.tsx` needed a real page-router bridge
2. anonymous client Firestore reads to `brandCampaigns` were denied, so the live route needed a server-side campaign fetch

`src/pages/home.tsx` now resolves the active tier-1 campaign server-side and passes it into the home surface as initial banner props.

### 3. Active Firestore campaign exists and matches the expected banner fields

**Collection:** `brandCampaigns`

**Document ID:** `gymshark-tier1-test-campaign`

Confirmed live values:

- `brandName = Gymshark`
- `campaignTitle = Gymshark Summer Strength Drop — Test Campaign`
- `ctaText = Open the co-branded challenge`
- `ctaLink = /partners/brands/gymshark`
- `logoUrl` present
- active window check = `true`

This means the record is eligible for the tier-1 active-window selection logic.

### 4. Browser/runtime verification

Started the local app server and opened:

- `http://localhost:3020/home`

Confirmed in the rendered DOM:

- banner region exists: `aria-label="Gymshark brand campaign banner"`
- rendered text includes:
  - `Gymshark · Gymshark Summer Strength Drop — Test Campaign`
  - `Open the co-branded challenge`
- rendered link href = `/partners/brands/gymshark`
- rendered logo alt = `Gymshark logo`

### 5. Console outcome

After the server-side home-route fix:

- `/home` returns `200`
- `/_next/data/development/home.json` returns `200`
- the prior `Missing or insufficient permissions` banner-read failure is no longer the source of truth for the route render path

## Guardrail

This verification uses an internal test fixture in Firestore.

Any real Gymshark partnership status remains **Unverified** and should not be represented as a live commercial relationship without source-of-truth evidence.

## Files

- `web/app/home.tsx`
- `src/pages/home.tsx`
- `docs/deliverables/brand-campaign-banner-step5-verification-2026-06-25.md`
