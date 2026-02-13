# Brand Voice Reference Scan (Step 1)

This scan captured every place Solara’s **prior** role label appeared so we could rename it to “Brand Voice.” Use the list below if we ever need to verify the migration again.

1. `src/components/virtualOffice/AgentChatModal.tsx` — role mapping constant.
2. `src/pages/admin/virtualOffice.tsx`
   - Desk positions comment for Solara’s desk.
   - `AGENT_ROLES.solara` entry.
   - `AGENT_PROFILES.solara` title/footer copy.
3. `src/pages/admin/agentChat.tsx` — direct chat role map.
4. Documentation references:
   - `docs/kanban-task-plan-2026-02-11.md` (two references to the old title in the Brand/Creator Translator section).
   - `docs/AGENT_ONBOARDING.md` (role listing example).

All of the above now use “Brand Voice”; keep this note for historical context rather than re-running the scan.