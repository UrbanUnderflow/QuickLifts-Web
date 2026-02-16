# Heartbeat Progress Timeline — Usage & Integration

_Last updated: 2026-02-16_

## Overview
The Progress Timeline is the primary “heartbeat feed” for three-beat updates across every agent. It stitches together:

- **Live Beats** (Firestore: `progress-timeline`) — Act I/II/III + signal spikes with artifacts, color semantics, and lens tags.
- **Hourly Snapshots** (Firestore: `progress-snapshots`) — automation-generated hourly rollups showing which beat closed, current color, and a short note.
- **Nudge Log** (Firestore: `nudge-log`) — Nora’s hourly objective tracker + manual nudges rendered inline in the panel.

UI entry point: Virtual Office → “Progress Timeline” button → `ProgressTimelinePanel`.

## Posting Beats (UI)
1. Open the Virtual Office and click **Progress Timeline** in the HUD.
2. Select the agent and enter the objective code using the `ObjectiveCode-Act` format (e.g., `CR-02-ACTII`). The component uppercases automatically.
3. Choose the beat type (Hypothesis, Work in Flight, Result, Blocker, Signal Spike).
4. Confidence color defaults to Listening (blue); flip to green/yellow/red as you change momentum.
5. **Lens Tag:** Quick-select from the playlist (Delight Hunt → Fundraising Story). A datalist keeps the value synced with this week’s lens, but you can override for off-cycle posts.
6. Attach the artifact (text snippet or URL). Snippets render inline; URLs appear as `Artifact Link` with the Lucide link icon.
7. Publish — the entry renders instantly in the Live Feed column with badges for beat, state (Signals vs. Meanings), lens, and confidence color.

## Firestore Services
Located in `src/api/firebase/progressTimeline/service.ts`.

```ts
await progressTimelineService.publish({
  agentId: 'nora',
  agentName: 'Nora',
  emoji: '⚡️',
  objectiveCode: 'CR-02-ACTII',
  beat: 'work-in-flight',
  headline: 'Coded 50 creator comments — energy trending spark',
  artifactType: 'text',
  artifactText: '45/50 mention “consistency”; 60% cite accountability.',
  lensTag: 'Delight Hunt',
  confidenceColor: 'green',
  stateTag: 'signals',
});
```

`listen()` and `listenSnapshots()` keep the UI synced; both support an optional `limit` for lightweight subscriptions. Hourly snapshots are written via `progressTimelineService.logHourlySnapshot` (used by automation) and display in the right column with time, note, and lane badge.

### Payload schema (Firestore `progress-timeline`)
- `agentId`, `agentName`, optional `emoji`
- `objectiveCode` (always include `Act` suffix in UI)
- `beat` (enum: hypothesis/work-in-flight/result/block/signal-spike)
- `headline` + optional `artifactType/text/url`
- `lensTag`, `confidenceColor`, `stateTag`
- `createdAt` server timestamp

Snapshots live in `progress-snapshots` with `hourIso`, `beatCompleted`, `color`, `stateTag`, and optional `note`. The UI renders the last six entries in the side rail.

## Inline Nudge View
As of Step 3, nudges stream directly into the Live Feed next to three-beat posts. Every entry displays:

- Badge stack (lane + channel + outcome) with confidence color border.
- Timestamps for when Nora nudged and when the agent replied.
- Objective code + message body so idle alerts and hourly prompts read like a Twitter-threaded update.
- “Awaiting response…” chip whenever `respondedAt` is empty so it’s obvious who still owes a beat.

The side panel still shows the latest 8 nudges, but the main feed is now the canonical history. Automation should continue to write to `nudge-log`—the UI handles ordering and rendering automatically.

Nudges are merged with beats in `ProgressTimelinePanel.tsx` via the `feedItems` memo (two listeners: `progressTimelineService.listen` + `nudgeLogService.listen`) which sorts on `createdAt` so entries interleave chronologically.

Automation can call `nudgeLogService.log()` / `updateOutcome()` to insert entries that appear here immediately.

## CSS / Styling Notes
- Component-level styles live inside `ProgressTimelinePanel.tsx` using `styled-jsx` to avoid global leakage.
- Color chip classes follow the semantics defined in `docs/heartbeat/shared-definitions-preflight.md`.
- Lens pills share the same palette as the weekly brief so agents visually recognize the active narrative.

## QA Checklist
- [x] Create a Hypothesis beat with a text artifact → appears in Live Feed with inline snippet.
- [x] Create a Work in Flight beat with a URL artifact → card shows the Link icon + external link.
- [x] Confirm the “Active lens” pills set the input and datalist so there’s always a tag applied.
- [x] Insert an hourly snapshot via Admin SDK → panel shows it in the Snapshot column (ordered by most recent hour).
- [x] Insert a nudge entry → Nudge Log shows the badge stack + timestamps.

Artifacts from this verification run: see `docs/logs/heartbeat-os-verification-2026-02-16.md` for Firestore document IDs.
