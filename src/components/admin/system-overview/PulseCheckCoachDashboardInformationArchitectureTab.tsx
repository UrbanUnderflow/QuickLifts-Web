import React from 'react';
import { BellRing, LayoutPanelTop, Shield, Users, Workflow, BarChart3, Eye } from 'lucide-react';
import { BulletList, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const AUDIENCE_ROWS = [
  ['Head coach / athletic director', 'What is happening across the roster right now?', 'High-level state distribution, major support flags, competition readiness, and escalations requiring awareness.'],
  ['Position coach / event coach', 'Which athletes need adjustment today?', 'Unit-level readiness, recent volatility, assigned interventions, and athlete-specific trend context.'],
  ['Sport psychologist / mental performance staff', 'Where is state instability recurring and what is working?', 'State patterns, protocol responsiveness, sim trends, and persistent-red support signals.'],
  ['Athletic trainer / support staff', 'Who needs coordinated follow-up?', 'Support visibility, recurring fatigue or emotional load, and safety-lane coordination where authorized.'],
];

const PANEL_ROWS = [
  ['State / Readiness', 'How is the athlete or roster showing up today?', 'Overall readiness, four state dimensions, confidence, protocol demand, support flags.'],
  ['Performance / Profile', 'How are they performing over time?', 'Family trends, skill movement, recent session behavior, protocol-to-performance lift, trial movement.'],
  ['Escalation / Safety', 'Is there a safety or clinical issue requiring awareness?', 'Tiered escalation status, coach-notified state, safety mode, handoff status, privacy-safe alerts.'],
];

const STRUCTURE_ROWS = [
  ['A. Header + filters', 'Set context', 'Team or unit selector, date range, practice or competition context, roster segment, readiness band, support flag, and escalation visibility filters.'],
  ['B. Follow-up summary block', 'Immediate first read', 'Unread counts, what changed most recently, suggested review items, awareness-only updates, privacy-safe safety visibility, and a clear path into the full coach notification center.'],
  ['C. Roster overview strip', 'Immediate scan', 'Counts of Green / Yellow / Red, persistent-red athletes, protocol demand, new Tier 1 alerts, active Tier 2 or Tier 3 visibility notices.'],
  ['D. State / readiness panel', 'See current roster condition', 'State distribution, top movers, readiness map by unit, protocol demand patterns.'],
  ['E. Performance / profile panel', 'See skill and trend context', 'Recent sim-family trends, trial movement, protocol responsiveness, athlete-level trend cards.'],
  ['F. Escalation / safety panel', 'See authorized safety awareness', 'Privacy-safe escalation notifications, status by tier, safety mode markers, handoff state where authorized.'],
  ['G. Coach notification center', 'Review what changed and whether to intervene', 'Unread Nora auto-assignments, post-session updates, read/archive state, and deep links into the relevant coach surface.'],
  ['H. Athlete detail drawer / page', 'Investigate a specific athlete', 'Single-athlete state, profile, recent sessions, protocols, assigned work, support flags, and permitted safety visibility.'],
];

const PRIVACY_ROWS = [
  ['General coach', 'Tier label, athlete name, alert status, coach-notified state, safety mode, follow-dashboard instructions messaging.', 'Conversation content, clinical summary, diagnostic interpretation, detailed handoff payloads.'],
  ['Authorized support staff', 'General coach view plus support-lane patterning and coordination status.', 'Sensitive conversation detail unless separately authorized.'],
  ['Clinical / administrative authorized view', 'Operational escalation status, consent / handoff state, and workflow coordination fields.', 'Unnecessary roster-wide exposure of sensitive content.'],
];

const WORKFLOW_ROWS = [
  ['Dashboard landing scan', 'Understand what needs attention before scanning the full roster.', 'Follow-up summary block -> open latest follow-up or notification center.'],
  ['Pre-practice scan', 'See if the roster is generally ready and who needs adjustment.', 'Header filters -> roster overview strip -> state/readiness panel.'],
  ['Notification review', 'Review what Nora changed and whether the coach should intervene.', 'Coach notification center -> assignment or athlete destination surface.'],
  ['Pre-game scan', 'Understand readiness concentration, support flags, and any active escalation awareness before competition.', 'Roster overview strip -> state panel -> safety panel.'],
  ['Athlete follow-up', 'Open a single athlete to see recent state, work, and trend context.', 'Athlete card -> detail drawer/page.'],
  ['Support coordination', 'Identify repeated red-state patterns without collapsing into clinical alerting.', 'State panel persistent-red section -> staff support queue.'],
  ['Escalation response', 'Acknowledge and act on privacy-safe escalation notice.', 'Safety panel -> authorized escalation workflow.'],
];

const NOTIFICATION_ROWS = [
  ['Indicator', 'Roster readiness shifted slightly downward', 'Low-emphasis dashboard metric', 'Awareness only'],
  ['Action prompt', '5 athletes routed to Regulation before work', 'Medium-emphasis summary chip', 'Coach may adjust session framing'],
  ['Coach follow-up item', 'Nora assigned a lighter sim after check-in', 'Notification-center card with rationale and direct open action', 'Coach reviews, overrides, or lets the assignment stand'],
  ['Coach session update', 'Next rep moved to Reset after a completed session', 'Notification-center card plus push notification', 'Coach understands what changed and why before next contact'],
  ['Support flag', 'Athlete persistent-red for 3 sessions', 'Distinct support badge or queue', 'Follow-up or coordinate support'],
  ['Safety alert', 'Tier 2 or Tier 3 escalation visible to coach', 'High-emphasis but privacy-safe alert', 'Follow documented escalation workflow'],
];

const TRIAGE_ROWS = [
  ['Review suggested', 'Actionable Nora auto-assignments or post-session changes that may warrant coach intervention.', 'Warm/high-emphasis lane with direct review CTA.'],
  ['Awareness only', 'Informational athlete and Nora updates that matter, but do not imply intervention by default.', 'Cool/medium-emphasis lane that supports quick scanning.'],
  ['Safety visibility', 'Privacy-safe Tier 1 to Tier 3 awareness that should never be confused with routine performance follow-up.', 'Separate red safety lane with minimum-necessary wording only.'],
];

const DATA_ROWS = [
  ['State snapshot', 'State / readiness panel, support flags, athlete header cards.'],
  ['Nora assignment output', 'Recent work, protocol demand, assignment rationale, and current plan context.'],
  ['Coach notifications', 'Coach notification center, unread badge, and deep links into assignment review.'],
  ['Performance-state flags', 'Athlete trend interpretation, readiness context, support diagnostics.'],
  ['Family and trial metrics', 'Performance / profile panel and athlete detail trends.'],
  ['Escalation status + coach notifications', 'Escalation / safety panel and roster strip notifications.'],
  ['Protocol completion / responsiveness', 'State panel support widgets and performance-context interpretation.'],
];

const PulseCheckCoachDashboardInformationArchitectureTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Product Surface"
        title="Coach Dashboard Information Architecture"
        version="Version 1.0 | March 10, 2026"
        summary="Coach-facing product-surface artifact for roster-level Pulse Check visibility. This page translates the runtime architecture into a daily operating view that helps staff understand what is happening, why it matters, and what action is appropriate."
        highlights={[
          {
            title: 'Three-Panel Model Is Non-Negotiable',
            body: 'State, performance, and safety must remain visually and structurally separate so staff do not confuse different meanings.',
          },
          {
            title: 'Minimum-Necessary Visibility',
            body: 'The dashboard should show staff what they need to know and what action to take next, not every sensitive detail behind the system.',
          },
          {
            title: 'Built for Daily Coaching Use',
            body: 'The IA should support rapid roster reads, athlete follow-up, support coordination, and privacy-safe escalation awareness without becoming a generic analytics surface.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        sectionLabel="Product Alignment"
        role="Coach-facing information architecture artifact for dashboard structure, workflow organization, panel hierarchy, and privacy boundaries."
        sourceOfTruth="This document is authoritative for coach dashboard hierarchy, panel structure, workflow support, and visibility boundaries. It is not authoritative for state schema, routing logic, or escalation policy."
        masterReference="Use this page when designing or reviewing coach-facing Pulse Check surfaces. Use the runtime artifacts when the question is how state, routing, or escalation logic actually works under the hood."
        relatedDocs={[
          'Runtime Architecture v1.0',
          'State & Escalation Orchestration v1.2',
          'Escalation Integration Spec v1.1',
          'Permissions & Visibility Model',
        ]}
      />

      <SectionBlock icon={Users} title="Primary Dashboard Audiences">
        <DataTable columns={['Audience', 'Primary Question', 'Dashboard Emphasis']} rows={AUDIENCE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={LayoutPanelTop} title="Core IA Principle: Three-Panel Model">
        <DataTable columns={['Panel', 'Primary Question', 'Key Outputs']} rows={PANEL_ROWS} />
        <InfoCard
          title="Critical Separation"
          accent="red"
          body="A low-readiness week is not the same thing as poor skill development. Poor skill development is not the same thing as a safety event. The dashboard must make those distinctions structurally obvious."
        />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Recommended Top-Level Dashboard Structure">
        <DataTable columns={['Dashboard Zone', 'Purpose', 'Recommended Contents']} rows={STRUCTURE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Shield} title="Privacy and Safety Visibility Boundaries">
        <DataTable columns={['Viewer', 'Can See', 'Cannot See']} rows={PRIVACY_ROWS} />
        <InfoCard
          title="Privacy Rule"
          accent="blue"
          body="The dashboard should answer what this staff member needs to know and what action they should take next. It should not answer what exactly the athlete said in a sensitive conversation."
        />
      </SectionBlock>

      <SectionBlock icon={Eye} title="Coach Workflows the IA Must Support">
        <DataTable columns={['Workflow', 'What the Coach Needs to Do', 'Dashboard Path']} rows={WORKFLOW_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BellRing} title="Notifications and Alert Treatments">
        <DataTable columns={['Type', 'Example', 'Display Treatment', 'Action Expectation']} rows={NOTIFICATION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BellRing} title="Dashboard Follow-Up Triage Lanes">
        <DataTable columns={['Lane', 'What Belongs Here', 'Display Treatment']} rows={TRIAGE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BarChart3} title="Data-to-Display Mapping">
        <DataTable columns={['Data Source', 'Primary Destination in Dashboard']} rows={DATA_ROWS} />
      </SectionBlock>

      <SectionBlock icon={LayoutPanelTop} title="Initial Release Scope">
        <InfoCard
          title="Pilot-Focused First Release"
          accent="green"
          body={
            <BulletList
              items={[
                'Roster overview strip',
                'State / readiness panel',
                'Basic athlete detail view',
                'Privacy-safe escalation / safety panel',
                'Protocol demand summary',
                'Support-flag visibility for persistent red',
                'Core filters by unit, readiness band, and support / safety status',
              ]}
            />
          }
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckCoachDashboardInformationArchitectureTab;
