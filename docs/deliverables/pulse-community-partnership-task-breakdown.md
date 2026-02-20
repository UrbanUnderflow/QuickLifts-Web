# Pulse Community Partnership Task Breakdown

## Top-Level Artifacts & Ticket Stubs (Step 1)

### TICKET 1 — Shared "Pulse for Communities" Narrative Spine
**Goal:** Define a single, coherent "Pulse for Communities" narrative spine that all community-facing materials use as their source of truth.

#### Detailed Scope (Step 2)
- **Reference Artifact:** `docs/deliverables/pulse-for-communities-narrative-spine-v1.md` is the canonical spec this ticket maintains and evolves.
- **Purpose:** Create and maintain the master narrative and metric spine that every ICP playbook, partner A-list, and pitch artifact must plug into. This is the upstream source of truth; no downstream ticket can redefine metrics or core story.

#### Required Sections
1. **Core One-Liner**
   - A concise statement (1–2 sentences) that positions Pulse as the challenge layer for communities across brands, gyms, and run clubs.
   - Must be written in language that can be dropped directly into pitch decks, one-pagers, and internal docs.

2. **Expanded Narrative**
   - A 2–4 paragraph story that:
     - Explains Pulse as the engine that turns fragmented audiences into durable communities of practice.
     - Describes how Pulse plugs into existing channels (social, email, apps, chats) instead of replacing them.
     - Ties the human story (showing up with my people) to measurable behavior change.
   - This section should be ICP-agnostic: Brands, Gyms, and Run Clubs are examples, not separate narratives.

3. **Global Behavior Metrics**
   - Define the three non-negotiable behavior metrics that travel into every ICP:
     - **Inactivity Gap Rate (>3 days)** — how often members experience 4+ day gaps with no meaningful Pulse-tracked participation during a block/season.
     - **Community Ritual Weeks** — percentage of weeks that hit a minimum threshold of shared community rituals or challenge touchpoints.
     - **Creator-Led Participation Rate** — share of the reachable community that joins at least one creator/coach-led Pulse challenge or block in a season.
   - For each metric, include:
     - Plain-language definition.
     - How Pulse measures it (at a high level).
     - What "good" movement looks like over time (directional targets, not hard numbers at this stage).

4. **ICP Metric Applications (Brands, Gyms, Run Clubs)**
   - For each of the three ICPs, specify how the three global metrics show up in their world:
     - What counts as an inactivity gap for that ICP.
     - What counts as a ritual week for that ICP.
     - What counts as creator-led participation for that ICP.
   - Output should be phrase-able as short bullets that Solara can reuse verbatim in each playbook.

5. **Narrative Vignettes (One Scene per ICP)**
   - Draft one short, concrete vignette per ICP (Brands, Gyms, Run Clubs) that:
     - Shows what a Pulse-powered season or block looks like on the ground.
     - Naturally references all three behavior metrics in story form (gaps closing, ritual weeks stacking, creator-led participation rising).
   - These vignettes are the human translation of the metrics and should be written so a partner could repeat them back after a first meeting.

6. **Partner-Fit Rubric (Cross-ICP)**
   - Define a shared rubric that any prospect must be scored against before being considered a Pulse-fit partner, including:
     - Existing community density and rhythm.
     - Presence of a creator/coach/captain spine.
     - History of challenges or rituals we can formalize.
     - Openness to shared KPIs and data.
     - Surface area for distribution we can instrument.
     - Brand and research alignment (Sage gate).
   - This rubric must be framed explicitly in terms of the three global behavior metrics.

7. **Plug-In Requirements for Other Agents**
   - Document explicit rules for how downstream artifacts must use this spine, including:
     - **Solara (ICP Playbooks):**
       - Must open each playbook with a restatement of the core one-liner.
       - Must map every play/use case to at least one of the three behavior metrics.
       - Must use the ICP metric definitions from this spine verbatim.
     - **Scout (Partner Lists & Outreach):**
       - Must tag each prospect with partner-fit rubric signals.
       - Must state a simple hypothesis for which metrics Pulse can move for that partner.
       - Must avoid advancing prospects that fail the Sage/brand alignment criteria.

8. **Status & Ownership Block**
   - Include a section in the narrative spine doc that tracks:
     - Current version (e.g., v1, v1.1).
     - Owners: Nora (spec + enforcement), Solara (ICP playbooks), Scout (partner research & lists).
     - Next actions for how this spine should be wired into partner discovery, pitch templates, and ICP playbooks.

#### Dependencies & Source-of-Truth Mapping
- **Upstream of all other tickets:**
  - TICKET 2 (Brands playbook), TICKET 3 (Gyms & Studios playbook), TICKET 4 (Run Clubs playbook), and TICKET 5–7 (partner A-lists per lane) are all **downstream** of this narrative spine.
  - None of those tickets may redefine the core one-liner, the three global behavior metrics, or the partner-fit rubric; they may only apply and extend them for their lane.
- **Change Management:**
  - Any material change to the core one-liner, global metrics, or partner-fit rubric must be reflected in `pulse-for-communities-narrative-spine-v1.md` (or its next version) **before** updating ICP playbooks or partner lists.
  - When this ticket ships an updated spine version, downstream tickets should log a "spine version" they are aligned to (e.g., "Aligned to Pulse for Communities spine v1.1").

### TICKET 2 — ICP Playbook: Community-First Brands
**Goal:** Create a "Pulse for Community-First Brands" playbook that shows how Pulse powers brand-led communities, anchored in the shared narrative spine.

### TICKET 3 — ICP Playbook: Gyms & Studios
**Goal:** Create a "Pulse for Gyms & Studios" playbook that translates the shared narrative spine into an on-the-ground playbook for operators running in-person communities.

### TICKET 4 — ICP Playbook: Run Clubs & Movement Crews
**Goal:** Create a "Pulse for Run Clubs & Movement Crews" playbook that shows how Pulse scales and deepens participation in time-bound, recurring group movement.

### TICKET 5 — Partner A-List: Community-First Brands Lane
**Goal:** Curate an A-list of 10–15 Pulse-fit community-first brand partners, each tagged with why they fit the shared narrative spine.

### TICKET 6 — Partner A-List: Gyms & Studios Lane
**Goal:** Curate an A-list of 10–15 Pulse-fit gym and studio partners, each tagged with why they fit the shared narrative spine.

### TICKET 7 — Partner A-List: Run Clubs & Movement Crews Lane
**Goal:** Curate an A-list of 10–15 Pulse-fit run club and movement crew partners, each tagged with why they fit the shared narrative spine.
