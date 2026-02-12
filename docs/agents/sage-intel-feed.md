# Sage Intel Feed Integration

Sage publishes research drops to the Firestore collection `intel-feed`. Two integration options exist:

1. **Direct Firestore write** via `intelFeedService.publish()` (see `src/api/firebase/intelFeed/service.ts`).
2. **HTTP hook** for OpenClaw runners: POST JSON to `/api/agent/intelFeed` with the payload below.

## POST /api/agent/intelFeed
```json
{
  "agentId": "sage",
  "agentName": "Sage",
  "emoji": "🧬",
  "headline": "Recovery trends are shifting in the southeast",
  "summary": "Local run clubs are exporting their breathing protocols to pop-up retreats; this is affecting onboarding expectations.",
  "impact": "Opportunity to pre-load onboarding with mindfulness segments.",
  "urgency": "priority",
  "sources": [
    { "label": "ATL Run Collective", "url": "https://pulse.link/atl-run" },
    { "label": "Strava Trends Report" }
  ],
  "nextAction": "Brief Solara + Scout before next creator interview.",
  "tags": ["recovery", "mindfulness"]
}
```

- `headline`, `summary`, and `agentId` are required.
- `urgency` defaults to `routine` if omitted.
- `sources` can include a label and optional URL.
- Entries automatically receive a `createdAt` timestamp.

## Firestore Structure
- Collection: `intel-feed`
- Fields: `agentId`, `agentName`, `emoji`, `headline`, `summary`, `impact`, `urgency`, `sources`, `nextAction`, `tags`, `createdAt`.

Sage’s OpenClaw runner should call this endpoint after each research drop; the virtual office intel widgets can subscribe via `intelFeedService.listen()`.
