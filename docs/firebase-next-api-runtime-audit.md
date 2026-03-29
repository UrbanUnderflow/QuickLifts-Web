# Firebase Next API Runtime Audit

Updated: March 29, 2026

## Confirmed Production Finding

On March 29, 2026, the live `Next.js Server Handler` on Netlify was observed serving a Firebase-backed route with this credential diagnostic:

- `hasSecretKey: false`
- `hasClientEmail: false`
- `hasProjectId: false`
- `hasServiceAccount: false`

This was recorded while hitting `/api/vision-pro/reset-sounds` before it was redirected to a Netlify function.

## What This Means

The current Netlify Next.js runtime should not be treated as a production-safe home for Firebase-backed `src/pages/api/**` routes in this project.

The shared Firebase Admin code is working correctly. The production failure is runtime env visibility inside Netlify's `Next.js Server Handler`.

## Working Production Pattern

The working pattern on the current stack is:

1. Keep the public URL under `/api/...`
2. Redirect that path in `netlify.toml`
3. Serve the actual handler from `netlify/functions/**`
4. Let the function use `netlify/functions/config/firebase.js`

This pattern is now confirmed live for:

- `/api/vision-pro/reset-sounds` -> `/.netlify/functions/vision-pro-reset-sounds`
- `/api/audio/run-alerts` -> `/.netlify/functions/audio-run-alerts`

There is also a related proxy pattern now explicitly fixed:

- `/api/pulsecheck/functions/[name]` no longer loads Netlify function modules inside the Next runtime
- it now forwards supported requests to `/.netlify/functions/{name}`
- this keeps the PulseCheck app URL stable while executing on the validated Netlify function runtime

## Current Audit Snapshot

- Firebase-backed Next API routes discovered: `38`
- Mitigated via Netlify function redirect: `2`
- Still at risk on Netlify Next runtime: `36`

## Mitigated Routes

- `/api/vision-pro/reset-sounds`
- `/api/audio/run-alerts`

## Remaining At-Risk Next API Routes

- `/api/admin/_auth`
- `/api/admin/group-meet/[requestId]`
- `/api/admin/group-meet/[requestId]/finalize`
- `/api/admin/group-meet/[requestId]/invites/[token]/resend`
- `/api/admin/group-meet/[requestId]/recommend`
- `/api/admin/group-meet/[requestId]/schedule`
- `/api/admin/group-meet/contacts`
- `/api/admin/group-meet`
- `/api/admin/pulsecheck/pilot-research-readout/generate`
- `/api/admin/pulsecheck/pilot-research-readout/review`
- `/api/admin/system-overview/share-links/[token]`
- `/api/admin/system-overview/share-links/_auth`
- `/api/admin/system-overview/share-links`
- `/api/agent/kickoff-mission`
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
- `/api/wunna-run/analytics`
- `/api/wunna-run/record-view`

## Recommended Next Steps

1. Do not ship new Firebase-backed Next API routes on Netlify without either a redirect to a Netlify function or explicit proof that the runtime sees Firebase env vars.
2. Do not load Firebase-backed Netlify function modules inside `src/pages/api/**` proxy routes. Forward to `/.netlify/functions/*` instead.
3. Migrate the remaining `36` routes in batches, starting with the highest business risk:
   - admin auth and share-link routes
   - group-meet scheduling and invite flows
   - outreach and investor tracking endpoints
   - PulseCheck redemption and review routes
4. Keep the compact Netlify Firebase contract:
   - `FIREBASE_SECRET_KEY`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PROJECT_ID`
5. Continue using the shared Firebase Admin registry and Netlify adapter so migration work remains mechanical rather than route-specific.
