import React from 'react';
import { Compass, GitBranch, Settings2, ShieldAlert, Sparkles, Users } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const hostSettingsRows = [
  ['Onboarding enabled', 'Turns club activation on for the host.', 'All creator clubs can opt in without changing the base join flow.'],
  ['Required onboarding questions', 'Host selects from a shared question bank.', 'Start with curated system questions, not a freeform builder.'],
  ['Introduction required', 'Controls whether the member must post an intro to complete activation.', 'Uses a structured intro template owned by the host.'],
  ['Introduction template', 'Host-customizable prompt for the first post.', 'Should feel club-native while still producing consistent structure.'],
  ['Pairing enabled', 'Turns on accountability pairing inside the club.', 'Generic label and behavior so this works across creator clubs.'],
  ['Pairing mode', 'Manual or assisted.', 'Assisted suggests pairs from onboarding data; host confirms.'],
];

const memberStateRows = [
  ['joined', 'Member has entered the club and can be counted as a member.'],
  ['onboarded', 'Required club onboarding answers have been submitted.'],
  ['introduced', 'Required intro post has been completed.'],
  ['paired', 'Member has an active pairing assigned by the host.'],
];

const questionBankRows = [
  ['Fitness level', 'single select', 'Useful for matching pace, expectations, and confidence level.'],
  ['Primary goal', 'single select', 'Core signal for compatibility and motivation.'],
  ['Preferred workout type', 'multi select', 'Lets hosts match by modality and interests.'],
  ['Weekly availability', 'multi select', 'Most important operational signal for pairing.'],
  ['Location / neighborhood', 'short text or select', 'Needed when clubs have in-person meetups.'],
  ['Accountability style', 'single select', 'Matches communication preferences and support style.'],
];

const pairingRiskRows = [
  ['Compatibility mismatch', 'System should not imply that pairing is safety-vetted or guaranteed to be a fit.', 'Use opt-in pairing, host confirmation, and a simple rematch path.'],
  ['Known conflict between members', 'Hosts need a way to avoid pairing people who should not be matched.', 'Support a lightweight do-not-pair rule or host override list.'],
  ['Unsafe behavior at an event', 'Pairing should not be treated as a substitute for event operations or supervision.', 'Require club code of conduct, removal rights, and incident escalation workflow.'],
  ['Misleading product claims', 'Marketing the feature as screened, verified, or guaranteed creates avoidable exposure.', 'Position pairing as community/accountability support, not safety certification.'],
];

const PulseClubActivationArchitectureTab: React.FC = () => {
  return (
    <div className="space-y-8">
      <DocHeader
        eyebrow="Pulse Community"
        title="Club Activation Architecture"
        version="v1 First-Pass Artifact"
        summary="System-level artifact for how creator clubs should turn a passive join into an activated member relationship. This document defines the first-pass operating model for configurable club onboarding, structured introductions, and host-controlled member pairing."
        highlights={[
          {
            title: 'Reusable across clubs',
            body: 'The host-facing model must work for any creator club and remain part of the shared product architecture rather than a one-off implementation.',
          },
          {
            title: 'Activation before expansion',
            body: 'The first pass focuses on getting a new member from join to belonging. It deliberately avoids rewards, event RSVPs, and larger lifecycle systems.',
          },
          {
            title: 'Host-configurable guardrails',
            body: 'Creators should be able to require onboarding, require introductions, and run pairing with simple settings rather than custom ops every time.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        sectionLabel="Artifact Position"
        role="Source-of-truth artifact for the first-pass club activation layer inside Pulse Community."
        sourceOfTruth="This document governs the reusable host settings, member state model, and sequencing for onboarding, intro completion, and pairing across creator clubs."
        masterReference="Use this page when designing club activation features, auditing creator club onboarding behavior, or deciding whether a proposed club need should become a shared platform primitive."
        relatedDocs={[
          'Product Handbooks section in the System Overview',
          'QuickLifts Web club surfaces',
          'QuickLifts iOS club flows',
          'Pulse Android club parity work',
        ]}
      />

      <SectionBlock icon={Compass} title="Operating Principle">
        <CardGrid columns="xl:grid-cols-3">
          <InfoCard
            title="Activation is a layer"
            accent="blue"
            body="Club activation should sit on top of the existing club object, membership object, and chat surface. It should not require a separate club type."
          />
          <InfoCard
            title="Joins happen fast"
            accent="green"
            body="Members should still be able to join immediately. Activation state determines whether they have completed the host's required setup, not whether they technically exist in the club."
          />
          <InfoCard
            title="Pairing is host-owned"
            accent="amber"
            body="The first pass should not auto-run opaque matching logic. The system can suggest pairings, but the host remains the final decision-maker."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Settings2} title="Host Configuration Surface">
        <DataTable
          columns={['Setting', 'Purpose', 'First-Pass Rule']}
          rows={hostSettingsRows}
        />
      </SectionBlock>

      <SectionBlock icon={Sparkles} title="Activation Sequence">
        <StepRail
          steps={[
            {
              title: 'Join',
              body: 'The member joins the club through the existing club entry flow and is immediately created as an active club member.',
              owner: 'Existing club system',
            },
            {
              title: 'Onboarding',
              body: 'If the host has onboarding enabled, the member is routed into the required club questionnaire built from the shared question bank.',
              owner: 'Club activation layer',
            },
            {
              title: 'Introduction',
              body: 'If the host requires introductions, the member is prompted to post a structured introduction using the host template after onboarding is complete.',
              owner: 'Club activation layer',
            },
            {
              title: 'Pairing',
              body: 'If the host enables pairing, the system exposes unmatched members and suggested pairings using onboarding answers as inputs, then waits for host confirmation.',
              owner: 'Host + assisted tooling',
            },
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={Compass} title="Event Acquisition and App Conversion">
        <div className="space-y-4">
          <InfoCard
            title="Recommended funnel"
            accent="blue"
            body="For a cold audience, the first gate should be interest, not app install. Web should capture intent quickly, while the app should handle belonging, activation, and club participation."
          />
          <StepRail
            steps={[
              {
                title: 'Discover on web',
                body: 'Runner sees the event page, understands the run, and hits a low-friction reserve or RSVP action without being forced to install the app first.',
                owner: 'Growth surface',
              },
              {
                title: 'Capture light RSVP',
                body: 'Collect only the minimum contact details needed to hold intent and send follow-up. Do not front-load the full club setup here.',
                owner: 'Event acquisition layer',
              },
              {
                title: 'Push into the app',
                body: 'Immediately after RSVP, deliver a clear join-in-Pulse action through app-linking so the runner can enter the club, complete onboarding, introduce themselves, and prepare for pairing.',
                owner: 'Club activation layer',
              },
              {
                title: 'Keep event-day fallback',
                body: 'If the runner still has not installed the app, event-day QR or check-in links should still let them enter through the web fallback so the event itself is never blocked by install friction.',
                owner: 'Operational fallback',
              },
            ]}
          />
          <CardGrid columns="xl:grid-cols-2">
            <InfoCard
              title="Product stance"
              accent="green"
              body="Use web for intent and the app for belonging. The app should feel like the place where the club comes alive, not the thing that prevents someone from saying yes to the first run."
            />
            <InfoCard
              title="First-pass policy"
              accent="amber"
              body="Do not require app install before RSVP for broad or cold-audience events. App-first gating can be tested later once deep linking, event landing, and activation completion rates are stronger."
            />
          </CardGrid>
        </div>
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Member State Model">
        <div className="space-y-4">
          <InfoCard
            title="Keep the state model small"
            accent="purple"
            body="The first pass should track only the activation states needed for onboarding and pairing. Broader CRM-style club lifecycle tracking is intentionally out of scope."
          />
          <DataTable
            columns={['State', 'Meaning']}
            rows={memberStateRows}
          />
        </div>
      </SectionBlock>

      <SectionBlock icon={Users} title="Question Bank and Pairing Inputs">
        <div className="space-y-4">
          <DataTable
            columns={['Question', 'Type', 'Why it matters']}
            rows={questionBankRows}
          />
          <CardGrid columns="xl:grid-cols-2">
            <InfoCard
              title="Onboarding question policy"
              accent="blue"
              body="The first pass should reuse a curated system question bank so hosts can configure activation quickly. A full custom form builder can come later if demand justifies the complexity."
            />
            <InfoCard
              title="Pairing input policy"
              accent="green"
              body="Pairing suggestions should only use fields the host has explicitly enabled for activation. The host should be able to understand why two members were suggested together."
            />
          </CardGrid>
        </div>
      </SectionBlock>

      <SectionBlock icon={Users} title="First-Pass Requirements">
        <BulletList
          items={[
            'Any creator should be able to enable or disable onboarding at the club level.',
            'Hosts should be able to choose required onboarding questions from a shared question bank.',
            'Hosts should be able to require a structured intro and customize the intro prompt.',
            'The system should explicitly track whether a member is joined, onboarded, introduced, and paired.',
            'Pairing should support manual and assisted modes; assisted suggestions should be based on onboarding responses.',
            'The architecture should stay reusable across creator clubs without introducing club-specific data paths.',
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={ShieldAlert} title="Pairing Risk and Mitigation Model">
        <div className="space-y-4">
          <InfoCard
            title="System posture"
            accent="red"
            body="Pairing is a community and accountability feature, not a safety certification system. The product should not imply that matched members have been screened, verified, or guaranteed to be compatible."
          />
          <DataTable
            columns={['Risk', 'Why it matters', 'First-pass mitigation']}
            rows={pairingRiskRows}
          />
          <BulletList
            items={[
              'Pairing should be opt-in rather than automatically forced on every member.',
              'Hosts should be able to decline, unpair, or rematch members quickly.',
              'The product should support a basic do-not-pair control before scale.',
              'Every club using pairing should also have a code of conduct and clear event removal rights.',
              'Event waiver, terms, and conduct language should be reviewed by counsel before broad rollout.',
            ]}
          />
        </div>
      </SectionBlock>

      <SectionBlock icon={Compass} title="Deliberately Deferred">
        <CardGrid columns="xl:grid-cols-3">
          <InfoCard title="Rewards and gamification" accent="amber" body="No activation rewards, unlock logic, or progression economy in the first pass." />
          <InfoCard title="Event RSVP and capacity" accent="amber" body="Important for later club operations, but separate from the activation layer and not required to validate onboarding or pairing." />
          <InfoCard title="Auto-rematch logic" accent="red" body="Ghosting, rematch automation, and health scoring for pair quality are explicitly deferred until manual and assisted pairing patterns are validated." />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseClubActivationArchitectureTab;
