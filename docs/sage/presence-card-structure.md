# Sage Presence Card Requirements (Step 1)

Source component: `src/pages/admin/virtualOffice.tsx`, `AgentDeskSprite` hover panel (line ~1000+).

## Layout Sections
1. **Header Row**
   - Fields: agent emoji, display name, live status pill.
   - Status pill uses `STATUS_CONFIG` for label + color classes (e.g., `badge = bg-green-500/15 ...`).

2. **Role & Duty Block**
   - Pulls short role string from `AGENT_ROLES[agent.id]` and a descriptive blurb from `AGENT_DUTIES`.
   - Entire block is clickable to open the full profile modal; includes “View full profile” link text and `ExternalLink` icon.

3. **Current Task Section**
   - Shows uppercase label "Current Task" and the `agent.currentTask` value.
   - Hidden when no active task string.

4. **Live Execution Steps / Progress**
   - When `executionSteps.length > 0`, renders `ExecutionStepsPanel` (checklist with status icons, progress %, timestamps).
   - When no steps, falls back to a Notes block (renders `agent.notes`).

5. **Manifesto Monitor Widget**
   - Mini panel showing toggle (`presenceService.toggleManifesto`), injection count, and last injection time.
   - Styling: purple glassmorphism background, BookOpen icon header.

6. **Task History Panel**
   - Embedded `TaskHistoryPanel` component (fetches last ~20 entries via `presenceService.fetchTaskHistory`).
   - Includes filters, timestamp, retries, etc.

7. **Chat Button**
   - Full-width button with `MessageSquare` icon; triggers `(window as any).__openAgentChat(agent)`.

8. **Footer**
   - Left: last heartbeat timestamp (relative) with `Clock` icon.
   - Right: session duration if `sessionStartedAt` present.

## Styling Expectations
- Hover panel attaches to whichever side corresponds to desk orientation (class `hover-detail-panel left/right`).
- Typography uses `text-[10px]` to `text-xs` Tailwind classes embedded in JSX-style strings (Next.js styled-jsx).
- Colors from Tailwind palette (zinc, indigo) plus inline styles.
- Progress badges/pills rely on `STATUS_CONFIG` definitions (`badge`, `glow`, `monitorGlow`).

## Data Requirements for Agents
To render identically to existing agents, each agent presence doc must provide:
- `emoji`, `displayName`, `status`, `currentTask`, `notes`, `executionSteps`, `currentStepIndex`, `taskProgress`, `taskStartedAt`, `sessionStartedAt`, `lastUpdate`.
- Optional manifesto fields: `manifestoEnabled`, `manifestoInjections`, `lastManifestoInjection`.
- Task history accessible via `presenceService.fetchTaskHistory(agentId)`.
- Role/duty text keyed in `AGENT_ROLES` and `AGENT_DUTIES` objects (Sage entry already exists but must stay updated).

This covers the structure we need to match when wiring Sage’s presence card in later steps.