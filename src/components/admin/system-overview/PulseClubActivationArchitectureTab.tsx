import React from 'react';
import { Compass, GitBranch, Settings2, Sparkles, Users } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const hostSettingsRows = [
  ['Onboarding enabled', 'Turns club activation on for the host.', 'All creator clubs can opt in without changing the base join flow.'],
  ['Required onboarding questions', 'Host selects from a shared question bank.', 'Start with curated system questions, not a freeform builder.'],
  ['Introduction required', 'Controls whether the member must post an intro to complete activation.', 'Uses a structured intro template owned by the host.'],
  ['Introduction template', 'Host-customizable prompt for the first post.', 'Should feel club-native while still producing consistent structure.'],
  ['Pairing enabled', 'Turns on accountability pairing inside the club.', 'Generic label and behavior so this works beyond FWB.'],
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
            title: 'Generic, not FWB-specific',
            body: 'The host-facing model must work for any creator club. FWB is the first proving ground, not a special-case branch in the product architecture.',
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
        masterReference="Use this page when designing club activation features, auditing creator club onboarding behavior, or deciding whether a proposed FWB need should become a generic club primitive."
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
            'The architecture should stay reusable across creator clubs without introducing FWB-only data paths.',
          ]}
        />
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
