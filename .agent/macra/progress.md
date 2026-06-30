# Macra Progress Log

This file is the durable progress trace for Macra agent operations. Add dated entries instead of relying on chat memory.

## 2026-06-29

- Established Macra as the active operating mission for OpenClaw agents.
- Set the North Star to making Macra's trial-start path repeatable without breaking trust.
- Recorded the latest saved AppsFlyer/Scoreboard read: 533 onboarding starts, 448 reached paywall, 317 pressed paywall CTA, 94 initiated checkout, 5 trial starts, 3 purchases, and 3 subscribes for roughly 2026-05-27 through 2026-06-25.
- Recorded the key growth signal: Apple Search Ads produced 3 trials from 127 starts, while organic produced 2 trials from 406 starts.
- Identified the most urgent data issue: `/admin/experiments` results are stale from 2026-06-16 and still reflect the retired hard-paywall configuration even though the live config is now `variant_a`.

## 2026-06-30

- Created `docs/ops/macra-operating-snapshot-2026-06-30.md` from read-only Firestore/admin-source checks.
- Found that AppsFlyer/Scoreboard coverage is stale through 2026-06-25, so the June 28-30 source split and full funnel cannot be confirmed from AppsFlyer yet.
- Cross-checked `Macra-purchase-logs`: 2026-06-29 has 2 trial-success rows, while 2026-06-28 has 0 and 2026-06-30 has 0 as of the read.
- Logged Nora's no-change decision for the 72-hour validation window: no onboarding/paywall/pricing/allocation/retargeting/ASA spend changes until coverage is refreshed and the signal is validated.
- Posted the PulseCommand Macra Update to Firestore `agent-commands/Zig5W41vZd56Omg1BdPM`; operator push found no registered devices (`sent=0`, `failed=0`).
