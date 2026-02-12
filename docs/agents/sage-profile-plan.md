# Sage Virtual Office Profile Plan – Feb 12, 2026

## Existing Structure (virtualOffice.tsx)
- **AGENT_ROLES**: simple `agentId -> title` map (e.g., Nora = "Director of System Ops").
- **AGENT_DUTIES**: `agentId -> one-line summary` used in hover cards.
- **AGENT_PROFILES**: detailed object with `title`, `location`, `sections[]`, optional `footer`. Each section has `title` + `bullets[]` (Nora/Scout/Solara follow this format).

## Implication for Sage
- Need to add Sage entries to both AGENT_ROLES and AGENT_DUTIES with 🧬 emoji noted in the presence doc.
- Create `AGENT_PROFILES['sage']` mirroring Nora’s structure (3-4 sections + creed footer) so the modal shows intel feed stewardship, field research, insight packaging cadence.
- No code changes needed yet; this note documents the structure before editing.
