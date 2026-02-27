# System Overview Handbook Maintenance Guide

## Purpose

This handbook documents the full Pulse system and is rendered from static typed content in:

- `src/content/system-overview/schema.ts`
- `src/content/system-overview/manifest.ts`
- `src/content/system-overview/products/*.ts`
- `src/content/system-overview/flows.ts`

The runtime page is:

- `src/pages/admin/systemOverview.tsx`

## Update SLA

Target maintenance time: **under 30 minutes** for normal updates.

## Required Update Checklist

1. Update relevant product feature inventory and dependencies in `products/*.ts`.
2. Update cross-product flow impacts in `flows.ts` when behavior changes.
3. Update backend, data collection, integrations, ownership, risks, or glossary in `manifest.ts`.
4. Refresh `executiveSummary.whatChangedRecently` and `lastUpdated` in `manifest.ts`.
5. Run validation:
   - `node scripts/validate-system-overview-content.js`
6. Run build verification:
   - `npm run build`
7. Include handbook updates in the same PR as the system change.

## Field Requirements for Every Feature Entry

Each feature object in every product file must include:

- `id`
- `name`
- `persona`
- `outcome`
- `entryPoints`
- `dependentServices`
- `firestoreCollections`
- `integrations`
- `owner`
- `releaseChannel`
- `status`
- `sourceRefs`

Do not leave placeholder values. If a field is intentionally empty, use an explicit value such as `[]` for arrays.

## Source Reference Rules

- Every `sourceRefs.path` must exist.
- Use paths relative to `QuickLifts-Web` repo root.
- For sibling repos in this workspace, use `../iOS/...` or `../Pulse-Android/...`.

## Security Rules

- The page is protected by both:
  - `AdminRouteGuard`
  - passcode gate in `systemOverview.tsx`
- Do not add `/admin/systemOverview` back to `AuthWrapper` public routes.

## When to Update Immediately

Update the handbook in the same day when any of the following change:

- New product feature launches or feature removals.
- Firestore collection shape/ownership changes.
- Billing or entitlement flow changes.
- Agent workflow protocol changes.
- Ownership handoff or release cadence changes.

## Validation Script

`node scripts/validate-system-overview-content.js` checks:

- Manifest section shape tokens exist.
- Product feature blocks include required fields.
- Source reference paths exist on disk.

If validation fails, fix content before merging.
