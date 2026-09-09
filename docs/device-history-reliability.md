# Daily wearable history reliability

## Scope

Cloud connections share durable athlete/provider/day jobs, per-connection leases, retry backoff, and exact athlete/day snapshot verification. Existing provider importers remain responsible for fetching and mapping data. The scheduled worker runs all four providers independently each minute. Existing Google Health and Polar schedules use the same queue. WHOOP webhook jobs are consumed alongside catch-up jobs.

Each connection schedules today and the previous seven days. A saved scheduling cursor adds up to 31 older days per scan after an extended scheduler outage. Jobs survive failed requests and interrupted workers. A missing or wrong-account snapshot cannot be marked complete. Disconnected connections are cancelled. Oura background imports do not send notifications.

Apple Health remains a phone-mediated source. The iPhone registers observers, requests background delivery, and checks the full recent window on app entry and resume. Android checks Health Connect history on sign-in and resume. OS permissions, device connectivity, and provider upload delays still affect availability; these changes cannot guarantee that an offline device has uploaded data.

## Evidence and release status

- September 5 and 6 WHOOP snapshots were recovered with the existing production importer and verified for the exact requested days.
- 45 worker/provider checks passed locally, including emulator-backed persistence, disconnected accounts, overlap protection, missing snapshots, and outage catch-up.
- Android build and unit tests passed after resume catch-up was added.
- The focused iPhone build passed, installed, and launched. After Apple Health authorization, new source records for September 1 through 7 were verified in production Firebase. This proves foreground catch-up on the physical phone; unattended OS delivery remains unverified.
- Data sources labels build on both platforms and the focused iPhone update is installed.
- The isolated backend release was published on September 7. Production home and PulseCheck pages returned HTTP 200 after publication.
- The first scheduled execution advanced all four provider states. WHOOP and Google Health completed exact-day saves after publication; Polar and Oura reported waiting for data and remain retryable.
- The first draft was held back because its website runtime was incomplete. A clean dependency copy fixed packaging; only the corrected draft was published.
- Other provider live API behavior and physical BLE delivery have not been established by the mock adapter checks.

## Operational follow-up

Inspect per-provider worker state, queued job age, repeated errors, and last completed day. Waiting-for-data remains retryable rather than silently successful. Worker throughput is bounded to one job per provider per minute, with additional legacy Google Health/Polar ticks; increase capacity with bounded workers if queue age grows. The current queued-job scan should be replaced with an indexed bounded query as volume grows. Preserve minimum-data logging: provider, counts, and generic failure status only.

Deployment must start from the currently published web commit plus these wearable changes, preserving the website and edge routing while excluding unreleased Nora changes. Native changes require a new app build.


## Release evidence

Published Netlify deploy: `6a9f3520b73f33ecb6521c4e`, from production baseline `7084d083ea2822280ee138a9104282c295078166` plus scoped wearable changes. No unreleased Nora changes were included. The focused native checkout contains onboarding, wearable catch-up, and data-source labels only.

The manual local WHOOP check lacked runtime secret access. An authenticated request through the deployed function succeeded, followed by a successful scheduled import. Local credential diagnostics must not be interpreted as a production credential failure.
