# Partnership Pulse Dashboard — Hampton Activation Panel

## Purpose
System-first partnership validation: Hampton shows the proof architecture (“Lead: Hampton — access pending”), while Oura/Fencing B tiles display live telemetry (“Backup: Oura — cadence in progress”) so leadership sees alignment → ritual → proof on whichever partner actually feeds data. Architecture docs anchor the system, but tiles only earn green badges when prospects deliver real signals.

## Data Inputs
- **Alignment Score (@Scout):** Partner readiness metric (0-100). Includes signal notes (audience fit, ritual appetite). Manual entry for Hampton pilot.
- **Week-One Proof Gauge (@Sage):** Breath cadence delta (%), load/lightness ratio, recovery trend. Ingest via Sage’s telemetry feed and update daily.
- **Partner Sentiment (Qualitative):** Short-form reflections from Hampton leads after activations, stored alongside the other metrics for context.
- **Activation Capsule (@Solara):** Latest Hampton quote, hero CTA snippet, activation asset (clip/image). Pulled from Solara’s narrative feed.
- **Partner Feedback Loop:** Quick sentiment form + ritual feedback notes captured after each activation to feed back into the kit.
- **Week-One Proof Gauge (@Sage):** Breath cadence delta (%), load/lightness ratio, recovery trend. Ingest via Sage’s telemetry feed and update daily.
- **Partner Sentiment (Qualitative):** Short-form reflections from Hampton leads after activations, stored alongside the other metrics for context.
- **Activation Capsule (@Solara):** Latest capsule (Oura live tile flagged “Behavior-first,” Momentum Partner B on deck, Hampton labeled “Awaiting verbatims”) with quote, hero CTA snippet, activation asset (clip/image), promise verb badge, signal confidence notch, telemetry legend mapping each metric to a ritual/feature, “story freshness” timestamp capped at weekly cadence (to honor longitudinal proof), behavior-first narrative headline with an audience halo kicker, and a “Raw Quote → Pulse Shorthand” translation row showing source and label. Capsule language locks based on Scout’s drop (“quotes available” vs “no access logged”) so sentiment dots don’t sit in limbo, and each quote now carries a provenance badge (“exclusive interview” vs “public signal”) so the dashboard shows Pulse’s moat at a glance. Every version bump includes a delta line (e.g., “+2 verbatims,” “cadence sample doubled”) so the label explains the momentum.
- **Partner Feedback Loop:** Quick sentiment form + ritual feedback notes captured after each activation to feed back into the kit.
- **Operational Status (Nora):** Runner heartbeat timestamp, cadence flag (green/yellow/red), upcoming activation checklist state.
- **Signal Validation Log (Nora):** Single source of truth for which cues (breath cadence, softness adoption, sentiment) are live vs missing, owner tagged per gap. Also logs cohort correlation signals (e.g., “Hampton-associated athletes show +18% Pulse adoption”) so the dashboard highlights network clustering even without causal proof, plus a “co-invest hypothesis + measurement plan” row so brands see how to validate the next signal with us. Network badge flips green the moment Hampton-linked athletes echo the softness cue (log entries with timestamp + snippet). Oura cadence export is the only path to a green tile tonight—until @Scout logs it, the dashboard stays yellow with “not landed yet” spelled out. Hampton remains “architecture defined, access pending”; fencing verbatims get flagged as “Parallel lane” when they land.

## Layout
1. **Overview Strip:** Lead Horse tile (currently Oura) showing alignment score pill, heartbeat status, next ritual checkpoint, plus badges indicating “Leading signals live” vs “Lagging sentiment pending.” Hampton sits in the Translation panel labeled “Proof architecture: access constrained.”
2. **Proof Gauge Module:** Dual dial for breath cadence + load deltas with weekly trend sparkline.
3. **Activation Capsule Strip:** Two sub-capsules with explicit status:
   - **Hampton — system spine, proof pending (access constrained).** Summary line: “Access pending; cadence + network badges gray until primary audio lands.”
   - **Oura — Lead: cadence v0.9, quote pending.** Summary line: “Lead tile when cadence file confirmed; stays yellow until both cadence + quote paths are in repo.”
   If no partner delivers, capsule copy states “No live proof tonight — stall logged.” Includes quote, CTA copy, asset thumbnail, tags for “strategic lightness,” “loading the spring,” etc., inline badges (e.g., “Sentiment pending”) so gaps sit next to the quote slot, and a Story Update Note (“Baseline unchanged; story updated Oct 4”) so version deltas read like receipts; version tags only advance when real proof arrives (v1.0 = shippable, v1.1 = depth added) and must include the specific delta (“+2 quotes, cadence sample doubled”).
4. **Action Panel:** Manual log for the five signals (alignment, activation adoption, partner sentiment, audience response, recovery cues) with note fields + timestamped entries.
5. **Signals Pending Lane:** List of partners/signals still awaiting data (e.g., Hampton verbatims) so gaps are visible and owners are nudged, including status tags and owners. Dashboard runs system-first: whichever partner clears the most gates with real data moves into the Lead Horse tile (green lane); others stay in the Translation lane (yellow) until their signals land. Each entry shows “Last drop: <timestamp>” so stale lanes auto-demote. Network Adoption Signal lines track second-order cues (e.g., Hampton’s athletes mentioning softness unprompted) with timestamps + snippets.

## Workflow
- Daily (AM): Scout enters alignment score updates + sentiment.
- Daily (AM): Sage syncs telemetry metrics into Proof Gauge.
- Daily (PM): Solara drops fresh quote and asset into the capsule strip.
- Nora audits heartbeat + action panel entries; unresolved flags piped to Orchestrator.

## Next Steps
- Build lightweight dashboard view (Next.js admin module) reading from a JSON file or Firestore doc storing these fields.
- After Hampton week-one completes, generalize schema for multi-partner view. Keep Oura lane green-ish as long as cadence data flows nightly; keep Hampton lane gray with “access pending” badge until primary quotes land.
- Create a simple “What we know about Hampton” summary doc (signals captured so far + gaps) so stakeholders can reference current proof without reading the full gate/sensor system.
