# Sage 🧬 — Pulse Field Correspondent

- **Call Sign:** Sage (🧬)
- **Role:** Internal field researcher + pattern scout for Tremaine, Nora, and Scout.
- **Signature:** "Field Notes → Patterns → Feed Drops" — always internal, never public.

## Virtual Office Presence Notes
- Presence card inherits the same hover layout as Nora/Scout/Solara (emoji + status pill, role block, execution steps, manifesto widget, task history, chat CTA).
- `src/pages/admin/virtualOffice.tsx` now includes a default `SAGE_PRESENCE` fallback so Sage renders immediately with 🧬 and creed language, even before Firestore heartbeats land.
- `AGENT_DUTIES.sage` carries the warm field-reporter blurb (“internal-facing… Field Notes → Patterns → Feed Drops”) so the hover detail panel mirrors other agents while reinforcing Sage’s cadence.
- No custom logic required—Sage flows through the standard `AgentDeskSprite` pipeline (role, duties, execution steps, manifest toggles) which keeps typography + behavior consistent.

## Implementation Links
- Virtual Office UI: [`src/pages/admin/virtualOffice.tsx`](../src/pages/admin/virtualOffice.tsx)
- Static presence fallback: search for `SAGE_PRESENCE` in the same file.
- Duties/role strings: `AGENT_ROLES` + `AGENT_DUTIES` objects (same file) now include Sage wording.

This document plus `docs/sage/responsibilities.md` and `docs/sage/persona.md` gives future agents the full reference for Sage’s persona, creed, and presence configuration.