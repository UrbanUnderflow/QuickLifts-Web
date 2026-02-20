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

---

### TICKET 2 — ICP Playbook: Community-First Brands
**Goal:** Create a "Pulse for Community-First Brands" playbook that shows how Pulse powers brand-led communities, anchored in the shared narrative spine.

#### Detailed Scope (Step 3 – Brands ICP Playbook)
- **Reference Spine:** Must align to `pulse-for-communities-narrative-spine-v1.md` (record the version this playbook uses).
- **Primary Owner:** Solara (with Nora as spine/metrics reviewer).

#### Hero Community Example (Brands)
- **Working Hero:** A training or supplement brand running a 6-week "Stronger Together" season where each sponsored athlete owns a Pulse block (e.g., at-home, gym-based, recovery-focused).
- **Story Requirements:**
  - Show followers joining through existing brand channels (email, IG, TikTok, app) into athlete-led Pulse blocks.
  - Show how check-ins, small weekly actions, and creator nudges reduce inactivity gaps and increase shared ritual weeks.
  - Make it obvious how creator-led participation is measured (share of reachable followers who join at least one athlete-led block).

#### Behavior Metrics This Playbook Must Express
1. **Inactivity Gap Rate (>3 days) – Brand Context**
   - Define what counts as participation for brand campaigns (e.g., challenge check-ins, logged sessions, content-linked actions).
   - Show how structuring campaigns into Pulse blocks is expected to reduce 4+ day inactivity gaps among opted-in followers.

2. **Community Ritual Weeks – Brand Context**
   - Specify what counts as a brand ritual week (e.g., check-in Fridays, live streams, coordinated drops tied to a Pulse challenge).
   - Ensure at least one play maps directly to increasing the number of ritual weeks per campaign season.

3. **Creator-Led Participation Rate – Brand Context**
   - Define creator-led participation as the share of reachable audience that joins at least one athlete/creator-led Pulse block.
   - Require that every hero concept explicitly states how it drives this rate up (e.g., number of athlete lanes, seeding strategy).

#### Required Use Cases / Challenge Concepts (2–3 Minimum)
The playbook must define at least three concrete plays, each mapped to the metrics above:

1. **Multi-Athlete Seasonal Campaign**
   - Structure: 6–8 week season, each athlete runs their own block under a shared brand umbrella.
   - Metric Mapping: explicitly targets lower inactivity gaps (athlete nudges), more ritual weeks (weekly anchor events), and higher creator-led participation (multiple on-ramps).

2. **Product Launch Micro-Season**
   - Structure: 3–4 week challenge aligned to a new product or flavor, with simple weekly actions and 1–2 live activation moments.
   - Metric Mapping: designed to create a dense cluster of ritual weeks around launch and convert passive product fans into challenge participants.

3. **Evergreen Loyalty Challenge Layer**
   - Structure: always-on monthly or quarterly Pulse challenge for loyalty members or subscribers.
   - Metric Mapping: focuses on long-term reduction of inactivity gaps and sustained creator-led participation across multiple seasons.

Each concept must include:
- Entry point(s) (which channels and CTAs).
- Expected behaviors logged in Pulse.
- Which of the three metrics it is optimized to move and how that will be reported back to partners.

---

### TICKET 3 — ICP Playbook: Gyms & Studios
**Goal:** Create a "Pulse for Gyms & Studios" playbook that translates the shared narrative spine into an on-the-ground playbook for operators running in-person communities.

#### Detailed Scope (Step 3 – Gyms & Studios ICP Playbook)
- **Reference Spine:** Must align to `pulse-for-communities-narrative-spine-v1.md` (record the version this playbook uses).
- **Primary Owner:** Solara (with Nora as spine/metrics reviewer).

#### Hero Community Example (Gyms & Studios)
- **Working Hero:** A strength gym running an 8-week squat cycle, where members join a shared Pulse block (e.g., via QR code at the rig) that tracks coached sessions and at-home accessories.
- **Story Requirements:**
  - Show how Pulse wraps around existing programming and class schedules rather than replacing them.
  - Show missed classes triggering prompts to complete at-home accessories, reducing 4+ day inactivity gaps.
  - Show weekly patterns (e.g., heavy day, volume day, community finisher) that clearly count as ritual weeks.
  - Show members increasing creator-led participation by enrolling in coach-led blocks instead of drifting class-to-class.

#### Behavior Metrics This Playbook Must Express
1. **Inactivity Gap Rate (>3 days) – Gym Context**
   - Define what counts as participation for members (class check-ins, logged workouts, challenge touchpoints).
   - Explicitly show how structuring training cycles into Pulse blocks should reduce 4+ day periods with no logged activity.

2. **Community Ritual Weeks – Gym Context**
   - Define what makes a ritual week for a gym (e.g., minimum of 3 Pulse-tracked touchpoints such as Monday heavy day, Thursday volume, Saturday finisher).
   - Ensure at least one template block is optimized to turn normal programming into ritual-rich weeks.

3. **Creator-Led Participation Rate – Gym Context**
   - Define creator-led participation as the share of active members who join at least one coach/staff-led block or challenge each season.
   - Require that every hero concept shows how coaches use Pulse to move more members into structured blocks.

#### Required Use Cases / Challenge Concepts (2–3 Minimum)
The playbook must define at least three gym-ready plays:

1. **Training Cycle Companion Block (e.g., 8-Week Squat Crew)**
   - Structure: mirrors an existing programming cycle, with 2–3 weekly anchor sessions and optional accessories.
   - Metric Mapping: primary focus on reducing inactivity gaps and increasing ritual weeks.

2. **Onboarding-to-Block Flow for New Members**
   - Structure: first 4–6 weeks for new joiners, automatically plugging them into a starter Pulse block.
   - Metric Mapping: designed to prevent early drop-off by eliminating long gaps in the first month and immediately placing members under a coach-led block.

3. **Seasonal Community Challenge (e.g., Summer Consistency Club)**
   - Structure: 4–6 week consistency-focused challenge layered on top of normal classes.
   - Metric Mapping: focuses on increasing creator-led participation and stacking ritual weeks across the membership base.

Each concept must include:
- How coaches introduce and reinforce Pulse in-class and in follow-ups.
- The specific member behaviors logged in Pulse.
- The target movement in inactivity gaps, ritual weeks, and creator-led participation, described in narrative form (no hard numbers required yet).

---

### TICKET 4 — ICP Playbook: Run Clubs & Movement Crews
**Goal:** Create a "Pulse for Run Clubs & Movement Crews" playbook that shows how Pulse scales and deepens participation in time-bound, recurring group movement.

#### Detailed Scope (Step 3 – Run Clubs ICP Playbook)
- **Reference Spine:** Must align to `pulse-for-communities-narrative-spine-v1.md` (record the version this playbook uses).
- **Primary Owner:** Solara (with Nora as spine/metrics reviewer).

#### Hero Community Example (Run Clubs & Crews)
- **Working Hero:** A city run club running a "Six Weeks to First 10K" block where captains map out three key runs per week in Pulse (easy social, tempo, progressive long run), and runners log both solo and group runs into the same challenge.
- **Story Requirements:**
  - Show runners joining from existing channels (WhatsApp/Discord/IG, post-run announcements) into a Pulse challenge.
  - Show captains using Pulse data to spot and close 4+ day inactivity gaps via direct outreach.
  - Show a clear weekly pattern of club rituals (group runs, speed sessions, long runs) that qualify as ritual weeks.
  - Show high creator-led participation as captains and pace leaders each owning lanes in Pulse.

#### Behavior Metrics This Playbook Must Express
1. **Inactivity Gap Rate (>3 days) – Run Club Context**
   - Define participation as logged runs, group session attendance, or challenge progress updates.
   - Show how captain-led nudges and structured cycles aim to shrink 4+ day periods with no logged runs.

2. **Community Ritual Weeks – Run Club Context**
   - Define ritual weeks as weeks with at least 3 shared run-related rituals (group runs, structured sessions, synced at-home runs logged to the challenge).
   - Ensure at least one core play is explicitly built to maximize the count of ritual weeks across a training season.

3. **Creator-Led Participation Rate – Run Club Context**
   - Define creator-led participation as the share of club members who join at least one captain- or coach-led Pulse block in a season.
   - Require that every hero concept shows how captains recruit and retain runners inside specific Pulse blocks.

#### Required Use Cases / Challenge Concepts (2–3 Minimum)
The playbook must define at least three run-club-ready plays:

1. **Race-Prep Cohort (e.g., 6 Weeks to First 10K / Half / Marathon)**
   - Structure: time-bound training cycle with 3 key weekly runs, integrated with existing club meetups.
   - Metric Mapping: designed to reduce inactivity gaps as race day approaches and to maximize ritual weeks and captain-led participation.

2. **Off-Season Consistency Challenge**
   - Structure: 4–6 week lower-intensity block focused on frequency (e.g., 3 days of movement per week) when the club is between major races.
   - Metric Mapping: aims to prevent post-race drop-off by smoothing out inactivity gaps and maintaining a baseline of ritual weeks.

3. **Virtual + IRL Hybrid Series**
   - Structure: combines virtual check-ins and at-home runs with 1–2 in-person meetups per week, all tracked via Pulse.
   - Metric Mapping: focuses on increasing creator-led participation by giving runners multiple entry points (solo, group, virtual) while still rolling into the same metrics.

Each concept must include:
- How captains and leaders introduce Pulse at runs and in digital channels.
- The specific runner behaviors recorded in Pulse.
- The intended impact on inactivity gaps, ritual weeks, and creator-led participation, stated clearly enough that Scout can later translate into outreach copy and hypotheses for specific partners.

---

### TICKET 5 — Partner A-List: Community-First Brands Lane
**Goal:** Curate an A-list of 10–15 Pulse-fit community-first brand partners, each tagged with why they fit the shared narrative spine.

#### Detailed Scope (Step 4 – Brand Lane Partner A-List)
- **Reference Spine & Playbook:** Must align to `pulse-for-communities-narrative-spine-v1.md` and the Brands ICP playbook (TICKET 2), recording the spine version.
- **Primary Owner:** Scout (with Nora as fit/rubric enforcer and Solara for narrative alignment).
- **Output Artifact:** `docs/deliverables/partners/pulse-brand-lane-a-list.md` (or equivalent agreed path), containing 10–15 candidate entries.

#### Selection Criteria (Applied to Each Brand Prospect)
Use the partner-fit rubric from the spine and make it concrete for brands:
1. **Existing Community Strength**
   - Evidence of dense, recurring engagement (e.g., past challenges, active social, loyalty programs) that Pulse can structure into blocks.
2. **Creator Presence / Athlete Spine**
   - The brand has sponsored athletes, creators, or ambassadors who already lead training content.
3. **Alignment with Behavior Metrics**
   - Clear opportunities to move inactivity gaps, ritual weeks, and creator-led participation using Pulse.
4. **Channel Surface Area**
   - Owned channels where Pulse CTAs can be embedded (email, app, social, communities).
5. **Sage / Brand Research Alignment**
   - No red-flag claims or regulatory gray areas; passes Sage’s research bar.

Each brand in the A-list must list which criteria it satisfies (and which are weak/unknown).

#### Target Structure per A-List Entry
Each entry must include at minimum:
- **Brand Name + Status** (e.g., Unverified unless present in `docs/partnership/lead-source-of-truth.md`, with proper [SOT: LEAD-####, EVID-####] tags when applicable).
- **ICP Lane:** Brands.
- **Fit Summary:** 1–2 bullets tying the brand to the partner-fit rubric.
- **Spine Tagging:** 1–2 bullets explicitly stating how this brand maps to the three behavior metrics (gaps, ritual weeks, creator-led participation).
- **Hero Play Alignment:** which concept(s) from the Brands playbook (TICKET 2) this brand is a natural fit for.

#### Tagging Requirement: Why It Fits the Spine
- Every brand must be tagged with a short
  "Why this fits the Pulse spine" note that:
  - Names at least one behavior metric we can realistically move.
  - Names at least one concrete ritual or challenge concept that would run on Pulse.
  - Avoids ungrounded claims; if the necessary evidence is not in `lead-source-of-truth.md`, mark the claim as **Unverified**.

---

### TICKET 6 — Partner A-List: Gyms & Studios Lane
**Goal:** Curate an A-list of 10–15 Pulse-fit gym and studio partners, each tagged with why they fit the shared narrative spine.

#### Detailed Scope (Step 4 – Gyms & Studios Lane Partner A-List)
- **Reference Spine & Playbook:** Must align to `pulse-for-communities-narrative-spine-v1.md` and the Gyms & Studios ICP playbook (TICKET 3), recording the spine version.
- **Primary Owner:** Scout (with Nora as fit/rubric enforcer and Solara for narrative alignment).
- **Output Artifact:** `docs/deliverables/partners/pulse-gym-studio-lane-a-list.md` (or equivalent agreed path), containing 10–15 candidate entries.

#### Selection Criteria (Applied to Each Gym/Studio Prospect)
1. **Existing Community Strength & Rhythm**
   - Clear member base with recurring class schedules, events, or programs.
2. **Coach / Staff Spine**
   - Recognizable coaches or staff who can lead Pulse blocks and challenges.
3. **Alignment with Behavior Metrics**
   - Potential to reduce gaps between visits, increase ritual weeks through class patterns, and raise coach-led participation.
4. **Operational Readiness & Surfaces**
   - Systems where Pulse CTAs can be integrated (check-in processes, apps, email, signage).
5. **Sage / Brand Alignment**
   - Training philosophy and marketing are aligned with Pulse and pass Sage’s bar.

#### Target Structure per A-List Entry
Each gym/studio entry must include:
- **Name + Status** (Unverified vs. SOT-linked with [SOT: LEAD-####, EVID-####]).
- **ICP Lane:** Gyms & Studios.
- **Fit Summary:** 1–2 bullets against the rubric above.
- **Spine Tagging:** clear mapping to inactivity gaps, ritual weeks, and creator-led participation for that gym.
- **Hero Play Alignment:** which Gyms play concepts (TICKET 3) this partner fits (e.g., squat cycle companion, onboarding block, seasonal consistency challenge).

#### Tagging Requirement: Why It Fits the Spine
- Each gym/studio must carry a spine-fit tag that:
  - Names which behavior metric(s) Pulse can most credibly move first.
  - Names a specific training cycle or challenge concept that would run on Pulse.
  - Marks any unverified assumptions as **Unverified** pending evidence in the lead source-of-truth doc.

---

### TICKET 7 — Partner A-List: Run Clubs & Movement Crews Lane
**Goal:** Curate an A-list of 10–15 Pulse-fit run club and movement crew partners, each tagged with why they fit the shared narrative spine.

#### Detailed Scope (Step 4 – Run Clubs & Crews Lane Partner A-List)
- **Reference Spine & Playbook:** Must align to `pulse-for-communities-narrative-spine-v1.md` and the Run Clubs ICP playbook (TICKET 4), recording the spine version.
- **Primary Owner:** Scout (with Nora as fit/rubric enforcer and Solara for narrative alignment).
- **Output Artifact:** `docs/deliverables/partners/pulse-run-club-lane-a-list.md` (or equivalent agreed path), containing 10–15 candidate entries.

#### Selection Criteria (Applied to Each Run Club / Crew Prospect)
1. **Community Density & Meetups**
   - Existing group runs, events, or race seasons with consistent attendance.
2. **Captain / Leader Structure**
   - Captains, pace leaders, or coaches who already organize routes, paces, and training.
3. **Alignment with Behavior Metrics**
   - Clear opportunity to track and move gaps between runs, increase ritual weeks around regular meetups, and scale captain-led participation.
4. **Hybrid Potential (IRL + Digital)**
   - Active digital channels (WhatsApp, Discord, IG) that can host Pulse CTAs and updates.
5. **Sage / Brand Alignment**
   - Community norms and any affiliated products/events align with Pulse principles.

#### Target Structure per A-List Entry
Each run club/crew entry must include:
- **Name + Status** (Unverified vs. SOT-linked with [SOT: LEAD-####, EVID-####]).
- **ICP Lane:** Run Clubs & Movement Crews.
- **Fit Summary:** 1–2 bullets against the rubric above.
- **Spine Tagging:** narrative of how Pulse can improve inactivity gaps, ritual weeks, and captain-led participation.
- **Hero Play Alignment:** which Run Club concepts (TICKET 4) fit best (race-prep cohort, off-season consistency, virtual+IRL hybrid).

#### Tagging Requirement: Why It Fits the Spine
- Each run club/crew must have a compact spine-fit tag that:
  - Identifies the easiest behavior metric win (e.g., turning existing weekly runs into ritual weeks).
  - Names the starting challenge or season (e.g., “Six Weeks to First 10K” or a consistency block).
  - Marks any data not backed by `docs/partnership/lead-source-of-truth.md` as **Unverified**.

---
