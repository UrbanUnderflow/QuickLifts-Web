# Virtual Office Agent Setup Notes (Feb 11, 2026)

## Agent Presence Data
- Agents (Nora, Scout, Solara) are surfaced in the Virtual Office by listening to Firestore collection `agent-presence` (see `src/api/firebase/presence/service.ts`).
- Each agent document stores `displayName`, `emoji`, `status`, `currentTask`, execution steps, manifesto settings, etc.
- Presence updates happen via `presenceService.updateAgentPresence/startTask/...`; UI components such as `GroupChatModal`, `RoundTable`, `MeetingMinutesPreview`, etc., read from this feed.
- To add Sage, we need a new document in `agent-presence` (either via CLI or programmatic bootstrap) with the right display name + emoji so Sage appears in `presenceService.listen` consumers.

## Virtual Office UI Dependencies
- `src/components/virtualOffice/GroupChatModal.tsx` subscribes to `presenceService.listen` and expects agent objects with `id`, `displayName`, `emoji`, and `status` to render avatars and message routing.
- `src/components/virtualOffice/RoundTable.tsx` (not yet inspected) likely does similar; all components assume `agent-presence` as the single source of truth.

## OpenClaw Instances
- No static configuration file in this repo defines Nora/Scout/Solara; they are provisioned externally (likely via OpenClaw runner) and simply publish into `agent-presence`.
- To keep parity, Sage’s OpenClaw instance must authenticate with Firebase and use `presenceService` to update its status; once the instance exists, the UI will automatically pick it up.

**Implication:** Step 2 will involve defining Sage’s persona + credentials, creating the OpenClaw runner config, then ensuring Sage writes a presence doc so the Virtual Office displays it.
