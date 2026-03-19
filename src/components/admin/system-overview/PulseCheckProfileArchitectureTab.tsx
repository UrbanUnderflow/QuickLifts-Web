import React from 'react';
import { Brain, Compass, Database, History, Shield, Users, Waypoints, Workflow, FileText, Download } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';
import ArtifactPageLibrary, { ArtifactPageEntry } from './ArtifactPageLibrary';
import PulseCheckProfileSnapshotExportSpecTab from './PulseCheckProfileSnapshotExportSpecTab';

const SURFACE_ROWS = [
  ['Today', 'Action surface', 'What should I do today?'],
  ['Nora', 'Coaching and assignment explanation surface', 'What is my current coaching dialogue?'],
  ['Profile', 'Stable identity, context, progress, settings, and access surface', 'Who am I here, and how am I developing?'],
];

const IA_ROWS = [
  ['1. Top Identity', 'Preferred name, team context, sport, season phase, primary goal, and primary challenge'],
  ['2. Mental Performance Profile', 'Subtle trend wrapper, pillars, skills, modifiers, and trends'],
  ['3. Program Pathway', 'Current emphasis, Nora explanation, next milestone, and Trial Milestones'],
  ['4. Profile History / Snapshots', 'Baseline, Midpoint, Endpoint, Retention, and current comparison views'],
  ['5. Nora Rhythm', 'Check-in timing, notification settings, and reflection cadence'],
  ['6. Membership & Access', 'Organizations, teams, pilots, cohorts, invite rights, and visibility scope'],
  ['7. Consent & Support', 'Research consent, escalation consent, clinician pathway, and support route summary'],
  ['8. Account & Integrations', 'Auth, wearables, and active org or team switching'],
];

const PROFILE_LAYER_ROWS = [
  ['Top layer', 'Quiet overall trend wrapper', 'Direction and recent change only; do not treat it as the dominant score.'],
  ['Second layer', 'Three official pillars', 'Focus, Composure, and Decision are the first real scores an athlete sees.'],
  ['Third layer', 'Named trainable skills', 'Readable skill-level strengths and growth areas under each pillar.'],
  ['Fourth layer', 'Cross-cutting modifiers', 'Readiness, Consistency, Fatigability, and Pressure Sensitivity.'],
  ['Trend layer', 'Longitudinal movement', 'Support at least 7-day, 30-day, and program-level trajectories.'],
];

const PATHWAY_ROWS = [
  ['Current emphasis', 'The skill or skill family Nora is actively prioritizing now.'],
  ['Nora explanation', 'One athlete-readable coaching sentence translating why that emphasis is active.'],
  ['Next milestone', 'Upcoming checkpoint, program transition, or focus change.'],
  ['Trial Milestones', 'Next Baseline, Midpoint, Endpoint, or Retention checkpoint visible as an upcoming event.'],
];

const SNAPSHOT_MOMENT_ROWS = [
  ['Onboarding', 'Onboarding system', 'Created once when account setup is complete and the athlete is ready for Baseline.'],
  ['Baseline', 'Trial system', 'Created when a valid Baseline Trial session is scored and finalized.'],
  ['Midpoint', 'Trial system', 'Created when a valid Midpoint Trial session is scored and finalized.'],
  ['Endpoint', 'Trial system', 'Created when a valid Endpoint or post-training Trial session is scored and finalized.'],
  ['Retention', 'Trial system', 'Created when a valid Retention Trial session is scored and finalized.'],
  ['Manual staff checkpoint', 'Authorized staff action', 'Additive snapshot created only through an explicit role-gated staff action.'],
];

const SNAPSHOT_DECISION_ROWS = [
  ['Trigger ownership', 'Each snapshot type has exactly one owner system. No other system may create that snapshot type.'],
  ['Payload scope', 'Store milestone-safe profile summaries plus state context at capture, including `assessmentContextFlag`, not full session logs or conversation transcripts.'],
  ['Idempotency', 'Maintain one canonical snapshot per athlete, milestone, and pilot enrollment. Retries or corrections supersede prior canonicals instead of creating duplicate truths.'],
  ['Nora explanation governance', 'The explanation stays template-bound, max two sentences, performance-only, and refreshes only on emphasis changes or milestone shifts.'],
  ['Research export alignment', 'Primary exports include canonical snapshots by default; superseded snapshots live in a separate audit dataset.'],
];

const PROFILE_GROUP_ROWS = [
  ['identity', 'Preferred name, display name, email, and photo'],
  ['athleteContext', 'Sport, position, season phase, and other stable setup context'],
  ['athleteChallenge', 'Primary mental-performance challenge / bottleneck pattern'],
  ['athleteGoal', 'Primary performance goal / desired outcome'],
  ['membership', 'Active org, team, pilot, cohorts, and role'],
  ['mentalPerformanceProfile', 'Pillar scores, skill scores, modifiers, trends, and narrative'],
  ['programPathway', 'Current emphasis, Nora explanation, next milestone, and Trial Milestones'],
  ['profileHistory', 'Milestone snapshots and default comparison views'],
  ['noraRhythm', 'Check-in time, notifications, and reflection cadence'],
  ['permissionsVisibility', 'Visibility scope and invite rights'],
  ['consentSupport', 'Research consent, escalation consent, and support route summary'],
  ['integrationsAccount', 'Wearables, auth state, and active context switching'],
];

const UPDATE_BEHAVIOR_ROWS = [
  ['Durable source of truth', 'preferredName, sport, role, team, consent status', 'Changes only through explicit user, staff, or admin action.'],
  ['Derived but persisted', 'profileNarrative, trendSummary, currentEmphasis, supportRouteSummary', 'Recomputed after scoring windows or milestone events, not continuously.'],
  ['Milestone snapshots', 'profileHistory snapshots', 'Immutable once created; they can only be marked superseded.'],
  ['Display-only computed', 'Overall trend arrow, strongest skill, largest growth area, modifier chips', 'Computed at render time and never persisted as source of truth.'],
];

const ROLE_ROWS = [
  ['Athlete', 'Own identity, context, full mental-performance profile, settings, consents, and support route summary.'],
  ['Coach', 'Roster-facing profile access through the coach surface only if permitted by visibility scope.'],
  ['Performance staff', 'Pilot and cohort context plus performance profile and support visibility when permitted.'],
  ['Clinician', 'Support routing context, relevant consent, and linked athlete context only.'],
  ['Admin', 'Membership, permissions, org or team controls, and other administrative views.'],
];

const FIRST_SCROLL_QUESTIONS = [
  'What am I best at right now?',
  'What is my biggest current growth area?',
  'How have I changed over the last month or current program?',
  'How do I tend to break under pressure: distraction, fatigue, evaluative threat, or ambiguity?',
  'Am I becoming more consistent, or just occasionally great?',
  'What is Nora training next, and why?',
];

const OUT_OF_SCOPE_ITEMS = [
  'No social feed or community posting surface.',
  'No dense real-time gameplay data that belongs in Today or sim summaries.',
  'No single combined safety-performance severity score.',
  'No generic mood-journaling page pretending to be Profile.',
  'No duplicate coach-dashboard panels.',
];

const OPERATIONAL_LOCK_ITEMS = [
  'Snapshot creation must be idempotent in practice: one canonical snapshot per athlete, milestone, and pilot enrollment, with retries or corrections superseding rather than duplicating.',
  'The Nora explanation generator must remain template-bound: validator-enforced structure, max two sentences, and performance-language-only output.',
  'Research export must use canonical snapshots by default, with superseded snapshots available only in the audit dataset.',
  'The first profile scroll must stay focused on the six core profile questions before lower-priority settings, membership, or account controls.',
];

const ProfileArchitectureOverviewDoc: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Product Surface"
        title="Profile Architecture & Data Model"
        version="Profile IA v1.3 + Data Model v1.2 | March 2025"
        summary="System overview artifact for the Pulse Check athlete and staff profile. This page defines Profile as the stable identity and development surface, the locked information architecture, the milestone snapshot model, and the field-level rules that keep Profile useful for athletes, staff, and research workflows."
        highlights={[
          {
            title: 'Profile Is Not Another Dashboard',
            body: 'Today owns daily action, Nora owns coaching dialogue, and Profile owns durable identity, context, progress, settings, and access.',
          },
          {
            title: 'First Scroll Must Answer Six Questions',
            body: 'The profile layout is only valid if the athlete can understand strengths, growth area, change over time, pressure pattern, consistency, and Nora direction within the first scroll.',
          },
          {
            title: 'Snapshots And Explanations Are Locked',
            body: 'Snapshot ownership, idempotency, canonical export behavior, and template-bound Nora explanations are implementation rules, not optional UX preferences.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        sectionLabel="Artifact Alignment"
        role="Source-of-truth overview for Pulse Check profile information architecture, field grouping, snapshot rules, and implementation boundaries."
        sourceOfTruth="This document is authoritative for what Profile stores, what it derives, how snapshot history behaves, and which product questions the profile surface must answer. It is not authoritative for raw sim metric computation, escalation policy, or full Nora conversation behavior."
        masterReference="Use this page when designing or implementing the Profile surface, snapshot creation flow, profile exports, or role-gated profile visibility. Use the runtime, taxonomy, onboarding, and permissions artifacts when the question shifts to upstream computation or access policy."
        relatedDocs={[
          'Runtime Architecture v1.0',
          'State Signal Layer v1.2',
          'Nora Assignment Rules v1.1',
          'Permissions & Visibility Model',
          'Team & Pilot Onboarding',
          'Coach Dashboard IA',
          'Profile Snapshot & Export Spec',
        ]}
      />

      <SectionBlock icon={Compass} title="Core Design Rule And Product Position">
        <InfoCard
          title="Core Rule"
          accent="purple"
          body="Profile is a stable Me surface, not a second dashboard. It should hold identity, context, durable mental-performance development, permissions, consent, support routing, and account controls while leaving daily work to Today and conversational guidance to Nora."
        />
        <DataTable columns={['Surface', 'Primary Job', 'User Question It Answers']} rows={SURFACE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Recommended Information Architecture">
        <DataTable columns={['Card', 'Contents']} rows={IA_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Challenge vs Goal"
            accent="purple"
            body="Primary challenge means the bottleneck or breakdown pattern Nora should train around. Primary goal means the outcome the athlete is trying to achieve. They should never be stored or explained as the same field."
          />
          <InfoCard
            title="Planner Weighting"
            accent="green"
            body="Primary goal can shape explanation, tie-breaks, and context framing, but it should never outrank the athlete's actual readiness, recent performance data, or safety state."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Brain} title="Mental Performance Profile And First-Scroll Questions">
        <DataTable columns={['Profile Layer', 'Meaning', 'Display Rule']} rows={PROFILE_LAYER_ROWS} />
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Top-Line Score Treatment"
            accent="blue"
            body="The overall wrapper behaves like a quiet trend signal. The first real numbers the athlete sees should be the three pillar scores, not a giant composite that averages away meaning."
          />
          <InfoCard
            title="Initial Scroll Focus"
            accent="green"
            body={<BulletList items={FIRST_SCROLL_QUESTIONS} />}
          />
        </CardGrid>
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Primary Mental Challenge"
            accent="amber"
            body="The bottleneck pattern Nora is trying to reduce. This is the thing that tends to break down when the athlete is under pressure, distracted, fatigued, or otherwise off balance."
          />
          <InfoCard
            title="Primary Performance Goal"
            accent="green"
            body="The outcome the athlete wants to reach. This frames the destination Nora is helping toward, but it should not replace the current-state read."
          />
          <InfoCard
            title="How Nora Uses Both"
            accent="purple"
            body="Challenge should steer training emphasis and intervention choice. Goal should shape framing, milestone language, and what success is meant to look like once the athlete is safe to train."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Waypoints} title="Program Pathway And Nora Explanation">
        <DataTable columns={['Element', 'Required Meaning']} rows={PATHWAY_ROWS} />
        <CardGrid columns="md:grid-cols-2 xl:grid-cols-4">
          <InfoCard title="Template-Based" accent="amber" body="Generate the Nora explanation from approved sentence templates or from output that passes a template validator." />
          <InfoCard title="Max Two Sentences" accent="amber" body="If more context is needed, it belongs in the conversational Nora surface, not in the Profile card." />
          <InfoCard title="Performance Language Only" accent="red" body="Use skill and training language, never diagnostic, clinical, or speculative emotional-state language." />
          <InfoCard title="Refresh Cadence" accent="blue" body="Refresh only when Nora changes active emphasis or a milestone shifts the pathway, not after every session." />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={History} title="Profile History And Snapshot System">
        <DataTable columns={['Snapshot Type', 'Owner', 'Trigger Condition']} rows={SNAPSHOT_MOMENT_ROWS} />
        <DataTable columns={['Locked Decision', 'Implementation Rule']} rows={SNAPSHOT_DECISION_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="What Snapshots Store"
            accent="blue"
            body="Snapshots store pillar scores, skill score summaries, modifier summaries, trend summary at capture, profile narrative at capture, and state context at capture, including milestone `assessmentContextFlag` when available."
          />
          <InfoCard
            title="What Snapshots Do Not Store"
            accent="red"
            body="Snapshots do not clone raw per-session logs, full histories, conversation transcripts, or escalation records. Those systems remain joined by timestamp when needed."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Top-Level Data Model And Refresh Rules">
        <DataTable columns={['Group', 'Purpose']} rows={PROFILE_GROUP_ROWS} />
        <DataTable columns={['Category', 'Examples', 'Update Behavior']} rows={UPDATE_BEHAVIOR_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Users} title="Role Gating And What Stays Out Of Profile">
        <DataTable columns={['Role', 'Profile Access Scope']} rows={ROLE_ROWS} />
        <InfoCard title="Out Of Scope By Design" accent="red" body={<BulletList items={OUT_OF_SCOPE_ITEMS} />} />
      </SectionBlock>

      <SectionBlock icon={Shield} title="Operational Lock Checks">
        <InfoCard
          title="Implementation Checks To Preserve"
          accent="green"
          body={<BulletList items={OPERATIONAL_LOCK_ITEMS} />}
        />
      </SectionBlock>
    </div>
  );
};

const PROFILE_SYSTEM_PAGES: ArtifactPageEntry[] = [
  {
    id: 'profile-architecture',
    label: 'Profile Architecture',
    subtitle: 'Profile IA, field schema, milestone snapshots, and explanation rules.',
    icon: FileText,
    accent: '#c084fc',
    render: () => <ProfileArchitectureOverviewDoc />,
  },
  {
    id: 'profile-snapshot-export',
    label: 'Snapshot & Export Spec',
    subtitle: 'Canonical snapshot storage, revision handling, and research export contract.',
    icon: Download,
    accent: '#38bdf8',
    render: () => <PulseCheckProfileSnapshotExportSpecTab />,
  },
];

const PulseCheckProfileArchitectureTab: React.FC = () => {
  return (
    <ArtifactPageLibrary
      eyebrow="Pulse Check · Profile System"
      title="Profile System Library"
      summary="Profile parent artifact with internal pages for information architecture, milestone snapshot rules, and the canonical export contract."
      entries={PROFILE_SYSTEM_PAGES}
    />
  );
};

export default PulseCheckProfileArchitectureTab;
