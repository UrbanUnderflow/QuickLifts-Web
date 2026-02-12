# Sage Integration Verification Checklist – Feb 11, 2026

## UI Presence
- [ ] Load `/admin/virtualOffice` in dev environment.
- [ ] Confirm Sage appears in the agent desk grid with emoji 🧬 and role “Research Intelligence Envoy.”
- [ ] Open Sage’s presence card to verify the full profile sections render correctly.

## OpenClaw & Intel Feed
- [ ] Trigger a sample Sage run (or mock the OpenClaw hook) that POSTs to `/api/agent/intelFeed` with headline, summary, and source.
- [ ] Confirm Firestore `intel-feed` collection receives the entry and the timestamps are recorded.
- [ ] Optionally wire a temporary UI snippet to `intelFeedService.listen()` to view the drop.

## Notes
- Sage persona config lives in `docs/agents/sage-persona.md` and `.agent/workflows/sage-openclaw-config.json`.
- Runner must authenticate with Firebase to write presence + intel entries.
