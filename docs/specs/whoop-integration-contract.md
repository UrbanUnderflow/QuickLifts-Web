# WHOOP Integration Loop Contract

## Product Contract

PulseCheck supports WHOOP as a cloud wearable source for recovery, strain, sleep, workout, and biometric context. WHOOP data must flow through the existing Device Registry and Health Context Source Record pipeline so Sports Intelligence, Nora, device monitoring, and mobile device settings do not read vendor payloads directly.

## Done Means

- Backend has WHOOP OAuth start/callback/status/disconnect/sync/webhook Netlify functions.
- Backend requests `offline`, profile, body measurement, cycle, recovery, sleep, and workout read scopes.
- WHOOP sync writes deterministic `health-context-source-records` for `whoop` domains and updates `health-context-source-status`.
- Webhook signatures are validated using `X-WHOOP-Signature` and `X-WHOOP-Signature-Timestamp`.
- The PulseCheck function proxy allows the WHOOP functions.
- Device registry marks WHOOP as an implemented experimental cloud adapter until app approval/production credentials are complete.
- iOS and Android expose WHOOP as a connectable device lane using the same endpoint names.
- Tests cover WHOOP OAuth URL construction, webhook signature verification, and source-record mapping from WHOOP-shaped fixtures.
- Production secret material is loaded from Google Secret Manager, not Netlify function env values. Netlify may carry public config such as `WHOOP_CLIENT_ID`, but `WHOOP_CLIENT_SECRET` and `WHOOP_WEBHOOK_SECRET` should be removed from Netlify once the matching GSM secrets exist.

## Loop Ledger

### 2026-06-29 | Loop 1 | Contract + Backend Vertical Slice

- Planner: use the existing Oura/Polar/Google Health adapter pattern, not a new abstraction.
- Builder target: add WHOOP backend functions and mappers that work without live credentials in tests.
- Evaluator target: run focused Node tests and update the next bottleneck.

## Current Bottlenecks

- Live OAuth cannot be completed until public `WHOOP_CLIENT_ID`, redirect URL, webhook URL, and the GSM secrets `WHOOP_CLIENT_SECRET` / `WHOOP_WEBHOOK_SECRET` are configured.
- WHOOP app approval is required before broad production use beyond the developer app cap.
- Snapshot domain precedence must be monitored once real WHOOP data lands; the first pass ranks WHOOP explicitly but may need sport/program tuning.
