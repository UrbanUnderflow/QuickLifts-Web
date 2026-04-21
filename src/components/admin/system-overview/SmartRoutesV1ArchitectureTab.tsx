import React from 'react';
import { Brain, CloudSun, Database, GitBranch, Map, Route, Server, ShieldCheck, Sparkles, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const POSITION_ROWS = [
  ['Primary goal', 'Recommend runnable routes that fit intent, not generic maps.', 'The value is personalization and confidence, not just showing a polyline.'],
  ['Core routing source', 'Deterministic routing provider', 'Route geometry should come from structured map data and a routing engine rather than model generation.'],
  ['AI role', 'Intent parsing, ranking assist, and recommendation explanations', 'AI can improve usability and personalization, but should not invent roads or route geometry.'],
  ['Source of truth', 'Pulse route service plus saved route records in Firestore', 'Pulse should own request inputs, ranking outcomes, and user feedback even if geometry is produced by an external provider.'],
];

const STACK_ROWS = [
  ['iOS run surface', 'Collect origin, route type, target distance or time, and preference chips.', 'Fit With Pulse iOS'],
  ['Pulse route API', 'Generate candidates, score them, and return the top route options.', 'Next API route or Netlify Function'],
  ['Routing provider', 'Produce route geometry and candidate alternatives.', 'Mapbox Directions API in v1'],
  ['Weather context', 'Add heat, rain, wind, and daylight context to route ranking.', 'Open-Meteo in v1'],
  ['State and analytics', 'Persist saved routes, starts, completions, and route feedback.', 'Cloud Firestore'],
  ['AI layer', 'Translate natural-language requests and explain why a route was chosen.', 'Existing OpenAI integration surface'],
];

const API_ROWS = [
  ['POST /api/routes/recommend', 'Generate 3 ranked route recommendations from an origin and preference set.', 'Input: routeType, origin, targetMiles or targetMinutes, activity, preferences'],
  ['POST /api/routes/save', 'Persist a recommended route to the user profile before the run starts.', 'Input: routeId, route snapshot, labels, score'],
  ['POST /api/routes/feedback', 'Capture thumbs up/down, reroute dislike, or reason tags after usage.', 'Input: routeId, sentiment, reasonTag'],
  ['POST /api/routes/match-completed-run', 'Map-match the completed GPS trace back onto the road graph for cleanup and analysis.', 'Input: recorded coordinates, selectedRouteId?'],
];

const FIRESTORE_ROWS = [
  ['users/{uid}/routePreferences', 'home geohash, default mileage presets, preferred surface, hill tolerance, quiet vs popular bias'],
  ['users/{uid}/savedRoutes', 'routeId, polyline, labels, provider, origin geohash, targetMiles, score, createdAt'],
  ['users/{uid}/routeHistory', 'routeId, startedAt, completedAt, completionRate, offRouteEvents, thumbsRating'],
  ['routeRequests/{requestId}', 'uid, normalized intent, origin, candidate ids, selectedRouteId, ranking factors, createdAt'],
  ['routeTemplates/{geoBucket}/{routeId}', 'cached route geometry plus aggregate popularity, completion, and weather-fit metadata'],
];

const SIGNAL_ROWS = [
  ['Distance fit', 'How closely the route matches the requested distance or duration.', '0.35'],
  ['Preference fit', 'Flat, trail, quiet, popular, or scenic fit to the explicit user request.', '0.20'],
  ['Popularity', 'Completion and repeat-use signal from Pulse users in the same area.', '0.20'],
  ['Safety heuristic', 'Penalize road classes, crossings, and awkward segments; boost trails and calmer corridors.', '0.15'],
  ['Weather fit', 'Bias away from exposed, hilly, or poor-condition routes when context suggests it.', '0.10'],
];

const PROVIDER_ROWS = [
  ['Routing provider', 'Generate 8 to 20 valid candidate routes for loop, out-and-back, or destination modes.', 'Server-side Pulse route API'],
  ['Pulse scoring layer', 'Normalize provider output, compute route scores, and attach explanation labels.', 'Server-side Pulse route API'],
  ['Mobile client', 'Render the chosen route, start navigation-style guidance, and record selection events.', 'Fit With Pulse iOS'],
  ['Post-run cleanup', 'Map-match completed GPS traces and calculate route quality outcomes.', 'Pulse route API'],
];

const REQUEST_FLOW = [
  {
    title: 'Normalize the request',
    body: 'Translate quick chips or natural-language input into a structured route request with route type, target distance or time, and explicit preference weights.',
    owner: 'iOS + route API',
  },
  {
    title: 'Generate candidates',
    body: 'Ask the routing provider for multiple valid route options around the origin rather than a single path. Loop generation should deliberately over-generate so poor shapes can be rejected.',
    owner: 'Route API -> provider',
  },
  {
    title: 'Score and label routes',
    body: 'Rank candidates using distance fit, user preferences, popularity, safety heuristics, and weather context. Attach short labels such as Best Match, Flatter, or Most Popular.',
    owner: 'Pulse scoring layer',
  },
  {
    title: 'Render top 3',
    body: 'Return the best three routes to the client with geometry, summary metrics, and a short why-this-route explanation.',
    owner: 'Route API -> iOS',
  },
  {
    title: 'Learn after the run',
    body: 'Save starts, completions, reroutes, and ratings so future route ranking can improve without changing the deterministic routing source.',
    owner: 'iOS + Firestore',
  },
];

const DEFERRED_ITEMS = [
  'Friend graph and social-route recommendation should wait until Pulse has enough route usage density to make it meaningful.',
  'Full safety claims should be deferred; v1 can use safety heuristics but should not market routes as guaranteed safe.',
  'Auto-reroute during a live run is useful, but should follow after saved-route selection and post-run matching are stable.',
  'A provider abstraction should exist in code, but true multi-provider failover can wait until usage justifies the complexity.',
];

const SmartRoutesV1ArchitectureTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Fit With Pulse"
        title="Smart Routes v1 Architecture"
        version="Version 1.0 | March 11, 2026"
        summary="Architecture artifact for the first-pass smart routing system inside Fit With Pulse. This document defines where route geometry comes from, what Pulse owns in the recommendation stack, how route requests should flow through the backend, and where AI is useful without becoming the routing engine."
        highlights={[
          {
            title: 'Deterministic routes first',
            body: 'Valid route geometry should come from a routing provider backed by map graph data, not from an LLM generating polylines.',
          },
          {
            title: 'Pulse owns ranking',
            body: 'The Pulse layer should decide which route is best for this runner based on fit, preferences, context, and feedback rather than exposing raw provider output directly.',
          },
          {
            title: 'AI is additive, not authoritative',
            body: 'Use AI to interpret fuzzy requests and explain recommendations, but keep route generation and scoring auditable and deterministic.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Fit With Pulse architecture artifact for the v1 smart-route recommendation layer across request capture, route generation, scoring, persistence, and post-run feedback."
        sourceOfTruth="This page is authoritative for the first-pass smart-routes stack, the server-side route recommendation contract, Firestore persistence objects, and the boundary between deterministic routing and AI-assisted personalization."
        masterReference="Use this artifact when designing run routing in Fit With Pulse iOS, deciding where route logic should live, or evaluating whether a feature belongs in the provider layer, the Pulse scoring layer, or the optional AI layer."
        relatedDocs={[
          'Product Handbooks',
          'Backend and Data',
          'End-to-End Flows',
          'Club Activation Architecture',
        ]}
      />

      <SectionBlock icon={GitBranch} title="Strategic Position">
        <DataTable columns={['Decision Area', 'Recommended Position', 'Why']} rows={POSITION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Server} title="Recommended v1 Stack">
        <DataTable columns={['Layer', 'Responsibility', 'Recommended v1']} rows={STACK_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Request-to-Route Flow">
        <StepRail steps={REQUEST_FLOW} />
      </SectionBlock>

      <SectionBlock icon={Route} title="API Contract">
        <DataTable columns={['Endpoint', 'Purpose', 'Minimum Request Shape']} rows={API_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Firestore Model">
        <DataTable columns={['Collection', 'Critical Fields']} rows={FIRESTORE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Sparkles} title="Scoring Signals">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Ranking Rule"
            accent="blue"
            body="Generate multiple valid routes first, then score and rank them. The best recommendation should be the best scored route, not the first provider response."
          />
          <InfoCard
            title="Why This Matters"
            accent="green"
            body="This keeps routing explainable. Product, engineering, and ops can audit why one route beat another by looking at the score breakdown."
          />
        </CardGrid>
        <div className="mt-4">
          <DataTable columns={['Signal', 'Meaning', 'Starting Weight']} rows={SIGNAL_ROWS} />
        </div>
      </SectionBlock>

      <SectionBlock icon={Map} title="Provider and Pulse Responsibilities">
        <DataTable columns={['System', 'Responsibility', 'Owner']} rows={PROVIDER_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Brain} title="AI Role and Hard Limits">
        <CardGrid columns="xl:grid-cols-3">
          <InfoCard title="Good AI use" accent="green" body="Parse fuzzy requests like easy 5k near me, convert them into structured preferences, and generate short explanations for the chosen route." />
          <InfoCard title="Bad AI use" accent="red" body="Do not let AI generate the route geometry, road sequence, or route legality. Those must come from deterministic map and routing data." />
          <InfoCard title="Practical v1 posture" accent="amber" body="Ship the route system without AI dependency if needed. AI should improve usability, not become the blocker for route generation." />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={CloudSun} title="Deliberately Deferred">
        <BulletList items={DEFERRED_ITEMS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="v1 Release Guardrails">
        <BulletList
          items={[
            'Loop routes should be the first supported smart-route type; additional modes can follow once ranking quality is stable.',
            'Route recommendations should return with plain-language labels such as Best Match, Flatter, and Most Popular.',
            'Every selected route should create a saved request record so ranking and adoption can be measured from day one.',
            'User-facing copy should say recommended and popular, not safe guaranteed.',
            'The route API should be a provider abstraction so Mapbox can be swapped later without rewriting the iOS contract.',
          ]}
        />
      </SectionBlock>
    </div>
  );
};

export default SmartRoutesV1ArchitectureTab;
