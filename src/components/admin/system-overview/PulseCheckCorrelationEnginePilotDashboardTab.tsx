import React from 'react';
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  Filter,
  FlaskConical,
  LayoutPanelTop,
  ShieldCheck,
  Users,
  Waypoints,
} from 'lucide-react';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  RuntimeAlignmentPanel,
  SectionBlock,
} from './PulseCheckRuntimeDocPrimitives';

const SCOPE_ROWS = [
  ['Team pilot index', 'Top-level team surface showing currently active pilots for that team.', 'Lets operators see which pilots are live before drilling into one pilot dashboard.'],
  ['Pilot detail dashboard', 'Primary dashboard scoped to one `pilotId`.', 'All KPIs, alerts, findings, and hypotheses on the page must resolve inside that pilot only.'],
  ['Cohort filter', 'Optional drill within one pilot using `cohortId`.', 'Supports subgroup reads without treating cohorts as separate pilot systems.'],
  ['Athlete drill-down', 'Athlete view entered from inside a pilot.', 'Shows the athlete only as a participant in that pilot, not as a whole-product analytics profile.'],
];

const DIRECTORY_ROWS = [
  ['Pilot name + status', 'Show active pilots first; keep completed and archived pilots in a separate history lane.', 'This is an active monitoring surface, not a retrospective archive by default.'],
  ['Team + organization context', 'Preserve `organizationId` and `teamId` in the directory filters and breadcrumb.', 'Pilots live inside teams; the dashboard should not invent a new top-level container.'],
  ['Key health summary', 'Show active athletes, wearable connect rate, stable-pattern share, stale-data rate, and open alerts per pilot.', 'Makes it possible to scan which active pilots need attention before opening detail.'],
  ['Direct drill-in', 'Every pilot card or row should open the pilot-scoped dashboard detail view.', 'The directory exists to get operators into the right pilot quickly.'],
];

const ROUTE_ROWS = [
  ['Active pilot directory', '`/admin/pulsecheckPilotDashboard`', 'Lists active pilots only and acts as the top-level admin entry point.'],
  ['Pilot detail dashboard', '`/admin/pulsecheckPilotDashboard/[pilotId]`', 'Owns pilot overview, engine health, findings, hypotheses, and research readout for one pilot.'],
  ['Pilot athlete drill-down', '`/admin/pulsecheckPilotDashboard/[pilotId]/athletes/[athleteId]`', 'Explains one athlete only in the context of the selected pilot.'],
];

const TAB_ROWS = [
  ['Pilot Overview', 'Executive summary for one pilot', 'Active pilot athletes, stable-pattern share, average evidence maturity, stale data, contradictions, top findings, latest alerts, and pilot summary narrative.'],
  ['Engine Health', 'Operational plus trust posture for one pilot', 'System health and evidence quality layers with pilot-scoped denominators and alerting.'],
  ['Findings', 'What the pilot is learning and whether it is useful', 'Insight production, outcome validation, and adoption metrics for the pilot.'],
  ['Hypotheses', 'Research-style governance for the pilot', 'Pilot hypotheses, leading indicators, current status, confidence, review notes, and review history.'],
  ['Research Readout', 'AI-assisted interpretation of governed pilot evidence', 'Manual `Generate AI Readout`, frozen evidence frame, claim discipline, limitations, and reviewer resolution for one pilot.'],
];

const LAYER_ROWS = [
  ['System health', 'Is the pilot data flow running?', 'Connection rates, stale sources, failed recomputes, missing snapshots, and export issues.'],
  ['Evidence quality', 'Is there enough trustworthy signal to personalize?', 'Maturity stages, linked days, scored sims, source mix, diversity, and contradictions.'],
  ['Insight production', 'What stable patterns is the engine discovering?', 'Pattern families, thresholds, projection volume, confidence distribution, and suppressed outputs.'],
  ['Outcome validation', 'Are the learned relationships predictive and useful?', 'Within-athlete comparisons, protocol effectiveness by body state, and milestone outcomes by context flag.'],
  ['Adoption', 'Are athletes and coaches engaging with the outputs?', 'Connect rate, recommendation engagement, follow-through, coach view rate, and override posture.'],
  ['Hypothesis governance', 'Are the pilot beliefs holding up honestly?', 'Leading indicators, status, confidence, evidence notes, and review cadence.'],
];

const TILE_ROWS = [
  ['Pilot athletes active', 'Active pilot athletes only, not all team members.'],
  ['Wearables connected', 'Connected wearables among enrolled pilot athletes.'],
  ['Athletes with stable patterns', 'Pilot athletes with at least one stable pattern.'],
  ['Average evidence maturity', 'Mean maturity across active pilot athletes.'],
  ['Projection success rate', 'Recommendation generated divided by recommendation attempted inside this pilot.'],
  ['Stale data rate', 'Pilot-scoped stale-source share.'],
  ['Contradiction rate', 'Pilot-scoped contradiction pressure for active patterns.'],
  ['Hypothesis status summary', 'Rollup of current hypothesis states for this pilot.'],
];

const SOURCE_ROWS = [
  ['Provisioning model', 'Pilot, PilotCohort, and PilotEnrollment define the dashboard scope and denominator pool.'],
  ['Correlation engine objects', 'Evidence records, pattern models, recommendation projections, and assessment context flags provide the core evaluation layer.'],
  ['Health-context ops telemetry', 'Source freshness, sync posture, and recompute failure data power system-health alerts.'],
  ['Profile snapshots and exports', 'Milestone context flags and pilot-scoped snapshot lineage support validation and exports.'],
  ['Assignment and interaction telemetry', 'Recommendation engagement, coach overrides, protocol follow-through, and dashboard usage support adoption metrics.'],
  ['Governed pilot read model', 'Frozen pilot dashboard snapshots or equivalent read-model payloads define the allowed evidence frame for Research Readout generation.'],
];

const SCOPING_RULES = [
  'The primary scope key is `pilotId`. Team and organization are navigation and filtering context, not the metric denominator.',
  'Every athlete shown in the dashboard must have an active `PilotEnrollment` for that pilot. No enrollment means no presence in the dashboard.',
  'Use `PilotEnrollment` and active pilot-athlete definitions for denominators. Do not fall back to raw team membership counts.',
  'Cohorts refine the read within a pilot. They do not replace the pilot as the root monitoring scope.',
  'Completed or archived pilots should not mix into the active monitoring default. Show them in a history mode later.',
  'If pre-pilot baseline or longitudinal history is shown for context, it must be clearly labeled as context and not merged silently into pilot-only KPIs.',
];

const RELEASE_ROWS = [
  ['V1', 'Pilot directory, pilot overview, engine health, evidence quality, athlete drill-down basics, manual hypothesis tracking, and manual Research Readout generation.', 'Gets operators a trustworthy active-pilot monitoring surface plus an auditable AI-assisted interpretation layer without waiting for full automation.'],
  ['V2', 'Outcome validation, adoption metrics, review queue, auto-generated pilot summary, and assisted hypothesis updates.', 'Unlock once enough pilot telemetry and usage events exist to make these reads real rather than speculative.'],
];

const PulseCheckCorrelationEnginePilotDashboardTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Physiology-Cognition Correlation Engine"
        title="Correlation Engine Pilot Dashboard"
        version="Version 1.0 | March 20, 2026"
        summary="Pilot-native monitoring and evaluation surface for the Physiology-Cognition Correlation Engine. This dashboard is rooted in active pilots, not the whole system. It should show which pilots are currently running, let operators drill into one pilot, and answer whether that pilot is operating, learning, and validating as planned."
        highlights={[
          {
            title: 'Pilot Scope Is Primary',
            body: 'This is a dashboard for active pilots inside teams. It is not a global engine analytics surface and it is not a team-wide dashboard by default.',
          },
          {
            title: 'PilotEnrollment Defines Inclusion',
            body: 'An athlete appears in a pilot dashboard only when they have an active PilotEnrollment in that pilot. Outside-pilot usage does not belong here.',
          },
          {
            title: 'Learning, Trust, And Outcome',
            body: 'The dashboard exists to show whether the pilot is running correctly, whether the insights are believable, and whether the pilot is helping athletes in the way the team expected.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Pilot-scoped monitoring and evaluation artifact for the correlation engine. It defines the active-pilot directory, the pilot detail dashboard, the drill-down behavior, and the scope rules that keep the surface tied to Pilot, Cohort, and PilotEnrollment instead of drifting into whole-system analytics."
        sourceOfTruth="This document is authoritative for the Correlation Engine Pilot Dashboard structure, pilot directory behavior, tab layout, overview tiles, drill-down model, and scope boundary. It is not authoritative for the engine object model, confidence rules, or onboarding object definitions."
        masterReference="Use this page when designing or implementing pilot dashboard surfaces, pilot-level KPI cards, pilot filters, athlete drill-down behavior, or pilot-health reporting. Use the data-model and onboarding artifacts when the question is where the underlying scope keys and canonical joins come from."
        relatedDocs={[
          'Physiology-Cognition Correlation Engine',
          'Correlation Data Model Spec',
          'Correlation Engine Engineering Task Breakdown',
          'Pilot Research Readout Implementation Spec',
          'Team & Pilot Onboarding',
          'Profile Snapshot & Export Spec',
          'Coach Dashboard IA',
        ]}
      />

      <SectionBlock icon={Waypoints} title="Scope Model">
        <DataTable columns={['Surface', 'Scope', 'Rule']} rows={SCOPE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={LayoutPanelTop} title="Active Pilot Directory">
        <DataTable columns={['Directory Element', 'Behavior', 'Why']} rows={DIRECTORY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Filter} title="Admin Route Contract">
        <DataTable columns={['Surface', 'Route', 'Rule']} rows={ROUTE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Pilot Detail Tab Structure">
        <DataTable columns={['Tab', 'Primary Job', 'Contents']} rows={TAB_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BarChart3} title="Evaluation Layers">
        <DataTable columns={['Layer', 'Primary Question', 'Meaning']} rows={LAYER_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Activity} title="Overview Tiles">
        <DataTable columns={['Tile', 'Pilot-Scoped Meaning']} rows={TILE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Users} title="Pilot Scoping Rules">
        <InfoCard title="Non-Negotiable Scope Boundary" accent="red" body={<BulletList items={SCOPING_RULES} />} />
      </SectionBlock>

      <SectionBlock icon={Filter} title="Data Source Mapping">
        <DataTable columns={['Source Layer', 'How It Feeds The Dashboard']} rows={SOURCE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={FlaskConical} title="Release Phasing">
        <DataTable columns={['Phase', 'Scope', 'Why']} rows={RELEASE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Athlete Drill-Down Rule"
            accent="green"
            body="Athlete drill-down should be opened from a pilot context and keep that pilot context visible. The page should explain the athlete as a participant in that pilot, not as a generic all-time PulseCheck user."
          />
          <InfoCard
            title="History Rule"
            accent="amber"
            body="Completed and archived pilots are valuable, but they belong in a separate history mode. Mixing them into the active directory by default makes it harder to understand which pilots need action right now."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Design Principle">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Pilot Intelligence, Not Infra Logging"
            accent="blue"
            body="The pilot dashboard should feel like a pilot intelligence surface: what this pilot is learning, whether the learning can be trusted, and whether it is helping athletes. Raw operational counters matter, but they belong in support of that bigger evaluation question."
          />
          <InfoCard
            title="Intentional Feedback And Motion"
            accent="green"
            body="Important user actions should acknowledge themselves immediately and clearly. Copy, save, generate, refresh, and review actions should produce visible feedback on the control itself or nearby. Motion should stay subtle and intentional: enough to confirm state change and guide attention, never enough to feel decorative, noisy, or ambiguous."
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckCorrelationEnginePilotDashboardTab;
