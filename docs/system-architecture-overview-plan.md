# System Architecture Overview Page – Planning Doc

_Last updated: 2026-02-11_

## Goal
Create `/admin/systemOverview`, an interactive "living map" of Pulse’s entire system architecture. The page should help teammates (and new agents) instantly understand:

- Surfaces (iOS, Android, Web, PulseCheck) and their ownership/status
- Backend services (Firebase products, Netlify Functions, Stripe/RevenueCat integrations)
- Data flows between surfaces/services
- Agent infrastructure (Virtual Office, agent presence, messaging, runners)
- Integration points (Brevo, Instantly, Mixpanel, etc.)

The experience should be visual-first: nodes, lanes, and animated context with hoverable detail panels. It must be data-driven so future expansion (new services, agents) is easy.

## Content requirements

1. **Top-level summary cards**
   - Number of active surfaces, backend services, integrations, agents.
   - Quick health indicators (e.g., last deploy, presence heartbeat).

2. **System map**
   - Nodes grouped by layer: Client Surfaces → Backend & Data Layer → Integrations → Agents.
   - Data flow arrows (e.g., QuickLifts iOS → Firebase Auth → Firestore).
   - Hover/Click reveals detail panel (owner, repo, environment URLs, status, todo links).

3. **Detailed sections**
   - Surfaces table: repo links, build status, release cadence.
   - Backend services breakdown: Firestore collections, Netlify functions, cron jobs.
   - Agent infrastructure: Virtual Office presence, active runners, outstanding commands.
   - Integrations: Brevo, Stripe, RevenueCat, OpenAI, Instantly, etc. Include credential source (Netlify env, Secrets manager).

4. **Automation hooks**
   - Pull data from local config/Firetore where possible (e.g., `agent-presence`, `kanbanTasks`).
   - Provide manual JSON fallback for static items (e.g., surfaces list) with clear TODO to tie into API later.

## Component plan

```
/admin/systemOverview
├── Page wrapper (AdminRouteGuard, head)
├── SummaryGrid
│   ├── <SummaryCard title="Surfaces" value=... />
│   ├── <SummaryCard title="Backend Services" ... />
│   └── ...
├── SystemMapCanvas
│   ├── <Layer title="Client Surfaces">[Node...]</Layer>
│   ├── <Layer title="Backend/Data">[Node...]</Layer>
│   ├── <Layer title="Integrations">[Node...]</Layer>
│   └── <Layer title="Agents">[Node...]</Layer>
│   ├── <Connections> (SVG lines between reference IDs)
│   └── <DetailPanel> (shows info for selected node)
├── DetailSections
│   ├── <SurfaceTable />
│   ├── <BackendTable />
│   ├── <AgentStatusPanel />
│   └── <IntegrationsTable />
└── Data hooks (useEffect)
    ├── fetchSurfaces() – hard-coded JSON (phase 1)
    ├── fetchBackend() – static + Firestore meta (e.g., Cloud Functions count)
    ├── subscribeAgents() – Firestore `agent-presence`
    └── fetchIntegrations() – static list referencing env sources
```

### Data structures

```ts
interface SystemNode {
  id: string;
  name: string;
  layer: 'surface' | 'backend' | 'integration' | 'agent';
  status: 'stable' | 'degraded' | 'planned';
  description: string;
  owner?: string;
  repo?: string;
  link?: string;
}

interface Connection {
  from: string; // node id
  to: string;   // node id
  type: 'data' | 'auth' | 'event';
}
```

### Visual design
- Dark admin theme (same palette as Virtual Office).
- Layers rendered as rows with light gradients; nodes as rounded cards with subtle glow based on status.
- Connections drawn via SVG `<path>` with arrowheads.
- Panel slides in from right on node select.

## Implementation phases

1. **Planning (current)**
   - Document requirements (this file), data model, and component tree.

2. **Implementation**
   - Build `/admin/systemOverview` page skeleton.
   - Create reusable components (SummaryGrid, SystemMapCanvas, DetailPanel, data hooks).
   - Seed with initial static data + Firestore agent presence subscription.

3. **Verification**
   - Ensure map renders, hover/selection works, detail tables show correct info.
   - Cross-check with current documentation; update Kanban + handbook.

## Open questions / future enhancement
- Should we store system metadata in Firestore/JSON so agents can update without code? (Likely yes—maybe `system-nodes` collection.)
- Hook into deployment status (Netlify API, GitHub actions) for real-time health.
- Add filters (by owner, by priority) and export option.

---
_This document satisfies Step 1 (analysis/planning). Proceed next with implementation per plan._
