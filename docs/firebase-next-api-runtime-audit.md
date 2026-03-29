# Firebase Next API Runtime Audit

Updated: March 29, 2026

## Confirmed Production Finding

On March 29, 2026, the live Netlify `Next.js Server Handler` was observed serving a Firebase-backed route with no Firebase server env visibility:

- `hasSecretKey: false`
- `hasClientEmail: false`
- `hasProjectId: false`
- `hasServiceAccount: false`

This was captured while hitting `/api/vision-pro/reset-sounds` before the production mitigation was applied.

## Current Runtime Posture

The project no longer treats Firebase-backed Next API routes as direct residents of the raw Netlify Next runtime.

The current mitigation stack is:

1. Keep the public URL under `/api/...`
2. Redirect high-risk Firebase-backed routes through Netlify function entrypoints in `netlify.toml`
3. Use the shared `firebase-next-api` bridge for route families that still execute the original Next handler logic
4. Use dedicated Netlify functions for the special audio routes

## Working Production Pattern

There are now two production-safe patterns in the repo:

- Dedicated Netlify function redirect
  - `/api/vision-pro/reset-sounds` -> `/.netlify/functions/vision-pro-reset-sounds`
  - `/api/audio/run-alerts` -> `/.netlify/functions/audio-run-alerts`

- Shared Firebase Next bridge
  - `/.netlify/functions/firebase-next-api`
  - receives `originalPath`
  - adapts the Netlify event into Next-style `req`/`res`
  - executes the original route handler on the validated Netlify function runtime

The shared PulseCheck proxy is also fixed:

- `/api/pulsecheck/functions/[name]` no longer loads Netlify function modules inside the Next runtime
- it forwards supported calls to `/.netlify/functions/{name}`

## Current Audit Snapshot

- Firebase-backed Next API routes discovered: `36`
- Mitigated via Netlify function redirect or bridge: `36`
- Still at risk on Netlify Next runtime: `0`

## Mitigated Routes

- `/api/admin/group-meet`
- `/api/admin/group-meet/[requestId]`
- `/api/admin/group-meet/[requestId]/finalize`
- `/api/admin/group-meet/[requestId]/invites/[token]/resend`
- `/api/admin/group-meet/[requestId]/recommend`
- `/api/admin/group-meet/[requestId]/schedule`
- `/api/admin/group-meet/contacts`
- `/api/admin/pulsecheck/pilot-research-readout/generate`
- `/api/admin/pulsecheck/pilot-research-readout/review`
- `/api/admin/system-overview/share-links`
- `/api/admin/system-overview/share-links/[token]`
- `/api/agent/kickoff-mission`
- `/api/audio/run-alerts`
- `/api/backfill-badges`
- `/api/group-meet/[token]`
- `/api/invest/analytics`
- `/api/invest/record-view`
- `/api/migrate/fitness-seeker-leads`
- `/api/outreach/activate-campaign`
- `/api/outreach/add-leads`
- `/api/outreach/create`
- `/api/outreach/create-campaign`
- `/api/outreach/deploy-campaign`
- `/api/outreach/sync-campaign-settings`
- `/api/pitch/analytics`
- `/api/pitch/record-view`
- `/api/pulsecheck/admin-activation/redeem`
- `/api/pulsecheck/team-invite/redeem`
- `/api/reset-badges`
- `/api/review/capture-reply`
- `/api/review/send-draft-reminder`
- `/api/shared/system-overview/[token]/unlock`
- `/api/surveys/notify-completed`
- `/api/vision-pro/reset-sounds`
- `/api/wunna-run/analytics`
- `/api/wunna-run/record-view`

## Live Probe Status

Representative live probes now exist in:

- `npm run probe:firebase-next-api:live`

The probe intentionally checks for the credential-resolution failure signature rather than business-success status, because several of these routes are auth-protected or input-sensitive and may still return `4xx` or `5xx` for normal application reasons.

The important current result is:

- representative Firebase-backed Next API routes no longer surface `Firebase Admin credentials unresolved`

## Recommended Next Steps

1. Keep the `firebase-next-api` bridge as the default mitigation for Firebase-backed Next API families that still need the original handler logic.
2. Keep the dedicated Netlify-function redirects for special public routes such as audio endpoints.
3. Continue running:
   - `npm run audit:firebase-next-api`
   - `npm run probe:firebase-next-api:live`
4. Expand live probe coverage from credential-failure detection into route-specific success assertions for the most business-critical bridged APIs.
5. Treat new Firebase-backed `src/pages/api/**` routes as incomplete unless they are either:
   - added to the bridge/redirect layer, or
   - explicitly proven safe on the Netlify Next runtime.
