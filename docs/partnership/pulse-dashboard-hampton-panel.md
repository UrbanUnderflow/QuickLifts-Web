# Partnership Pulse Dashboard — Hampton Activation Panel

## Purpose
Translate Hampton’s pilot signals into a living telemetry view so leadership sees alignment → ritual → proof in one heartbeat stream.

## Data Inputs
- **Alignment Score (@Scout):** Partner readiness metric (0-100). Includes signal notes (audience fit, ritual appetite). Manual entry for Hampton pilot.
- **Week-One Proof Gauge (@Sage):** Breath cadence delta (%), load/lightness ratio, recovery trend. Ingest via Sage’s telemetry feed and update daily.
- **Activation Capsule (@Solara):** Latest Hampton quote, hero CTA snippet, activation asset (clip/image). Pulled from Solara’s narrative feed.
- **Operational Status (Nora):** Runner heartbeat timestamp, cadence flag (green/yellow/red), upcoming activation checklist state.

## Layout
1. **Overview Strip:** Hampton card showing alignment score pill, heartbeat status icon, next ritual checkpoint.
2. **Proof Gauge Module:** Dual dial for breath cadence + load deltas with weekly trend sparkline.
3. **Activation Capsule Strip:** Quote, CTA copy, asset thumbnail, plus tags for “strategic lightness,” “loading the spring,” etc.
4. **Action Panel:** Manual log for the five signals (alignment, activation adoption, partner sentiment, audience response, recovery cues) with note fields + timestamped entries.

## Workflow
- Daily (AM): Scout enters alignment score updates + sentiment.
- Daily (AM): Sage syncs telemetry metrics into Proof Gauge.
- Daily (PM): Solara drops fresh quote and asset into the capsule strip.
- Nora audits heartbeat + action panel entries; unresolved flags piped to Orchestrator.

## Next Steps
- Build lightweight dashboard view (Next.js admin module) reading from a JSON file or Firestore doc storing these fields.
- After Hampton week-one completes, generalize schema for multi-partner view.
