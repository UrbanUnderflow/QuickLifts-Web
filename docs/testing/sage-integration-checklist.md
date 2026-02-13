# Sage Integration Verification Checklist – Feb 11, 2026

## UI Presence
- [ ] Load `/admin/virtualOffice` in dev environment.
- [ ] Confirm Sage appears in the agent desk grid with emoji 🧬 and role “Research Intelligence Envoy.”
- [ ] Open Sage’s presence card to verify the full profile sections render correctly.

## OpenClaw & Intel Feed
- [x] Triggered sample Sage run via `node scripts/verifySageIntegration.js` (with `.env.local` creds).
  - Script updated `agent-presence/sage` (idle status, 🧬 emoji).
  - Created intel feed entry `dpo2hKSTkVA7p570m0k6` (“Verification drop: Recovery trend pulse check”).
- [ ] Load intel feed UI (when available) to confirm entry renders.

## Notes
- Sage persona config lives in `docs/agents/sage-persona.md` and `.agent/workflows/sage-openclaw-config.json`.
- Runner must authenticate with Firebase to write presence + intel entries.
