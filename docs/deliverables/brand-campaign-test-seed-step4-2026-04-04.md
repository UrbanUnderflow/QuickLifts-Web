# Brand Campaign Test Seed — Step 4

## Scope

Completed only the current step: created one real Firestore document in `brandCampaigns` with a live active window so the new home-screen banner has an actual record to read.

## What Was Seeded

**Collection:** `brandCampaigns`

**Document ID:** `gymshark-tier1-test-campaign`

**Fields written:**

- `brandName = "Gymshark"`
- `logoUrl`
- `campaignTitle = "Gymshark Summer Strength Drop — Test Campaign"`
- `ctaText = "Open the co-branded challenge"`
- `ctaLink = "/partners/brands/gymshark"`
- `activeFrom = now minus 1 hour`
- `activeTo = now plus 14 days`

Also included operational metadata:

- `createdAt`
- `updatedAt`
- `testMode = true`
- `notes = "Internal tier-1 test fixture for BrandCampaignBanner verification. Not evidence of a live external partnership."`

## Why This Shape

The banner logic filters on:

- recognized tier-1 brand name
- valid campaign title / CTA fields
- active window containing the current time

This seeded record satisfies all three conditions while staying honest about what it is: an internal test fixture, not a public partnership proof point.

## Partnership Guardrail

This Firestore record is an internal UI test fixture only.

Any real Gymshark partnership status is **Unverified** and should not be presented as fact unless it is first added to `docs/partnership/lead-source-of-truth.md` with canonical evidence IDs.

## Verification

The seed script writes the document and immediately reads it back from Firestore to confirm the persisted fields.

Verified live from Firestore on this run:

- `id = gymshark-tier1-test-campaign`
- `brandName = Gymshark`
- `campaignTitle = Gymshark Summer Strength Drop — Test Campaign`
- `ctaText = Open the co-branded challenge`
- `ctaLink = /partners/brands/gymshark`
- `activeFrom` is already in the past
- `activeTo` is still in the future
- `testMode = true`

## Files

- `scripts/seedBrandCampaignTestCampaign.js`
- `docs/deliverables/brand-campaign-test-seed-step4-2026-04-04.md`
