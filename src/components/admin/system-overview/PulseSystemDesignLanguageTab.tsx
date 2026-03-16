import React from 'react';
import { Eye, Layers3, MessageSquareQuote, Palette, PenTool, ShieldCheck, Sparkles, SwatchBook, Wand2 } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const CORE_QUESTIONS = [
  ['1. What is happening to me right now?', 'The user should immediately understand the current moment, step, or state they are in.'],
  ['2. Why am I seeing this?', 'The screen should explain why this moment matters without exposing internal system logic.'],
  ['3. What do I need to do next?', 'The next action should be obvious, human, and low-friction.'],
  ['4. What happens after this?', 'The user should know what is coming next so the flow feels trustworthy.'],
];

const VOICE_ROWS = [
  ['Human first', 'Speak to the person using the product, not to the internal team that built it.'],
  ['Clear over clever', 'Use plain language before branded or conceptual language.'],
  ['Warm but grounded', 'Sound calm, confident, and helpful without becoming fluffy or performative.'],
  ['Guiding, not narrating architecture', 'Explain the user moment, not the system design behind it.'],
  ['Respectful of attention', 'Say only what the user needs in this moment, then get out of the way.'],
];

const COPY_DO_ROWS = [
  ['Explain the moment', 'Start with the current user situation before describing product logic.'],
  ['Use earned concepts only', 'Introduce terms only after the user has enough context to understand them.'],
  ['Name the benefit', 'Connect each step to a user benefit like clarity, readiness, personalization, or progress.'],
  ['Write for the next click', 'Copy should help the user confidently take the next action.'],
  ['Use direct language', 'Prefer “This helps us personalize your training” over abstract system phrasing.'],
];

const COPY_DONT_ROWS = [
  ['Do not expose internal modeling language', 'Avoid terms like pilot, lane, branch, rollout structure, first-release, or runtime unless the user truly needs them.'],
  ['Do not explain implementation states', 'The user does not need to hear about how the backend categorizes the current flow.'],
  ['Do not over-qualify early', 'Avoid introducing research, edge cases, or future states before the user understands the present one.'],
  ['Do not sound like an operations doc', 'If the copy reads like an admin handbook, it is not ready for a customer-facing screen.'],
  ['Do not stack overlapping concepts', 'If onboarding, consent, baseline, readiness, and pathway all appear at once, simplify.'],
];

const DESIGN_ROWS = [
  ['Copy and UI must answer the same question', 'The layout, hierarchy, CTA text, and helper copy should all reinforce the same user understanding.'],
  ['One screen, one dominant action', 'A user should not have to guess between competing CTAs. The screen should make the primary next step obvious.'],
  ['If there are multiple actions, show the order', 'When a flow has more than one valid action, the UI must explain which one happens first, which one is optional, and which ones can wait.'],
  ['Headlines should orient, not label databases', 'Titles should feel like guidance, not container names or portal states.'],
  ['Supporting copy should reduce anxiety', 'Use calm explanatory copy that makes the next step feel safe and manageable.'],
  ['Visual emphasis should follow meaning', 'The biggest text and strongest contrast should point to the user’s real next action.'],
  ['System terms belong in internal docs first', 'Internal architecture may shape the product, but it should not leak into the first user read.'],
];

const VISUAL_POSTURE_ROWS = [
  ['Dark luxury fitness', 'Premium, modern, energetic, and intentional. The product should feel elevated, not generic.'],
  ['Chromatic glass depth', 'Layered glass surfaces, subtle transparency, and color-tinted light give the UI atmosphere and hierarchy.'],
  ['Glow as hierarchy', 'Glow is used to guide attention toward key actions and focal objects, not to decorate every surface.'],
  ['Color carries meaning', 'Accent color should communicate category, status, or emphasis, never random decoration.'],
  ['Motion with purpose', 'Animation should orient, confirm, or reward, not distract.'],
];

const VISUAL_PATTERN_ROWS = [
  ['Glass surface', 'Blurred dark surface with a light top reflection and subtle inner highlight.', 'Primary cards, modals, command surfaces, and premium containers.'],
  ['Chromatic border wash', 'Gradient or tinted edge that gives depth and identity to a surface.', 'High-emphasis cards, feature callouts, hero surfaces, and selected states.'],
  ['Subtle radial glow', 'Low-opacity light source behind a focal element.', 'Icons, hero objects, key metrics, and active controls away from body text.'],
  ['Pill badges', 'Compact fill + stroke badge treatment for state, mode, or category.', 'Status, labels, mode chips, and compact metadata.'],
  ['Shimmer/loading surface', 'Reserved motion pattern for loading, not for permanent decoration.', 'Async states, placeholders, and transitions into content.'],
];

const COLOR_RULE_ROWS = [
  ['Primary green', 'Core brand emphasis and primary CTA energy.', 'Primary action, main highlight, and signature Pulse moments.'],
  ['Blue / cyan', 'Secondary energy and clarity.', 'Supporting actions, informational emphasis, cardio/run-adjacent cues.'],
  ['Purple', 'Stretch, reflection, and softer mental-space moments.', 'Recovery, flexibility, narrative, or secondary focus surfaces.'],
  ['Red / amber', 'Danger, urgency, warning, and destructive flows.', 'Errors, fatigue, destructive actions, and caution states.'],
  ['Charcoal / black / slate', 'Foundation and structure.', 'Backgrounds, containers, dividers, and secondary text.'],
];

const CONTRAST_RULES = [
  'Never use dark text on dark surfaces.',
  'Never use white text on bright green or teal surfaces; use dark text there.',
  'Do not put aggressive glows behind text.',
  'Glow opacity should stay low near copy and headings.',
  'The strongest color contrast should belong to the real primary action.',
];

const MOTION_RULES = [
  'Motion should help the user notice where to focus or what changed.',
  'Entrance animations should feel smooth and premium, not bouncy by default.',
  'Hover and press states should confirm interactivity, not create noise.',
  'Loading effects should signal waiting and then get out of the way.',
  'If motion makes the screen harder to read, it is not helping.',
];

const INTERNAL_LANGUAGE_SIGNS = [
  'The screen explains how the system classifies the user instead of what the user is doing.',
  'The copy sounds like a PM or engineering note rather than a coach, guide, or product companion.',
  'The text introduces future states before explaining the current state.',
  'The user benefit is implied but never said plainly.',
  'A first-time user would need translation from an internal teammate to understand the screen.',
];

const REVIEW_CHECKLIST = [
  'Can a first-time user answer “What is happening to me right now?” within the first five seconds?',
  'Can the user tell what we want them to do first without comparing multiple CTAs?',
  'If more than one action is visible, is the order obvious?',
  'Would this still make sense if the user had never heard our internal nouns for the system?',
  'Does the screen say why this step matters in plain language?',
  'Is the CTA written in the same tone as the rest of the screen?',
  'Did we remove any concept that has not been earned yet?',
  'Does the screen sound like Pulse speaking to a person, not Pulse documenting itself?',
];

const REWRITE_EXAMPLES = [
  [
    'Internal/system-centered',
    'This step captures product consent and places you into the initial PulseCheck baseline path.',
    'Athlete-centered',
    'Before you start, we need your consent and a quick baseline so we can personalize your training.',
  ],
  [
    'Internal/system-centered',
    'Research-mode branching comes later when pilots are introduced.',
    'Athlete-centered',
    'Right now, this step is just about getting you set up and ready to begin.',
  ],
  [
    'Internal/system-centered',
    'Your first-release baseline path is PulseCheck Core Baseline.',
    'Athlete-centered',
    'Your first session gives us a starting point so we can tailor what comes next.',
  ],
];

const PulseSystemDesignLanguageTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Cross-Product Experience Standard"
        title="System Design & Language"
        version="Voice and UX Language v1.0 | March 2026"
        summary="Source-of-truth artifact for how Pulse products should sound, guide, and orient people across onboarding, daily use, and high-stakes moments. This document exists to keep our apps human-centered and to stop internal product language from leaking into user-facing experiences."
        highlights={[
          {
            title: 'Start With The User Moment',
            body: 'Every screen should first answer: What is happening to me right now?',
          },
          {
            title: 'Internal Logic Is Not User Copy',
            body: 'Architecture, rollout, and data-model language should stay in system docs unless the user truly needs it.',
          },
          {
            title: 'Human-Centered UI Is A Product Standard',
            body: 'Copy, visual hierarchy, motion, and CTA language should work together to reduce confusion and increase trust.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Cross-product experience and language artifact for voice, copy posture, and human-centered interface standards across Pulse apps."
        sourceOfTruth="This document is authoritative for the tone, posture, and review rules used when writing customer-facing copy across Pulse products. It is not the source of truth for backend logic, legal policy, or internal product architecture."
        masterReference="Use this page when designing onboarding flows, writing helper text, naming CTAs, structuring first-time user moments, shaping visual tone, or reviewing whether a screen both sounds and feels like Pulse speaking to a human."
        relatedDocs={['Athlete Journey', 'Coach Journey', 'Member Onboarding Guide', 'Profile Architecture', 'Coach Dashboard IA', 'iOS Pulse Design System', 'Chromatic Glass web study']}
      />

      <SectionBlock icon={MessageSquareQuote} title="The First Question">
        <InfoCard
          title="Anchor Question"
          accent="green"
          body="The first job of a Pulse screen is to answer: What is happening to me right now? If a user cannot answer that immediately, the interface is still talking to the internal team instead of the person in front of it."
        />
        <DataTable columns={['Question', 'Why It Matters']} rows={CORE_QUESTIONS} />
      </SectionBlock>

      <SectionBlock icon={PenTool} title="Voice, Tone, And Posture">
        <DataTable columns={['Principle', 'Definition']} rows={VOICE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Eye} title="Copy Rules">
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Do"
            accent="blue"
            body={<DataTable columns={['Rule', 'Guidance']} rows={COPY_DO_ROWS} />}
          />
          <InfoCard
            title="Do Not"
            accent="red"
            body={<DataTable columns={['Rule', 'Why']} rows={COPY_DONT_ROWS} />}
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Palette} title="Design And Language Work Together">
        <DataTable columns={['System Rule', 'Meaning']} rows={DESIGN_ROWS} />
      </SectionBlock>

      <SectionBlock icon={SwatchBook} title="Visual Design Posture">
        <InfoCard
          title="Shared Cross-Platform Direction"
          accent="blue"
          body="Pulse should feel like dark luxury fitness: premium, high-contrast, layered, and energetic. The iOS design-system guidance and the Chromatic Glass web study both point to the same standard: dark-first surfaces, chromatic depth, restrained glow, meaningful accent color, and motion that feels intentional."
        />
        <DataTable columns={['Visual Principle', 'Meaning']} rows={VISUAL_POSTURE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Sparkles} title="Signature UI Patterns">
        <DataTable columns={['Pattern', 'Definition', 'Use']} rows={VISUAL_PATTERN_ROWS} />
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Chromatic Glass Standard"
            accent="purple"
            body="Use dark glass surfaces with subtle blur, a light top reflection, and a quiet inner highlight. High-emphasis surfaces can add a chromatic wash or gradient edge, but the effect should stay premium and readable."
          />
          <InfoCard
            title="Cards With Character"
            accent="green"
            body="Cards should not feel flat or disposable. Use tonal depth, gradient edge treatment, and measured shadow/glow to create hierarchy and a sense of quality."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Palette} title="Color And Contrast Rules">
        <DataTable columns={['Color Role', 'Meaning', 'Typical Use']} rows={COLOR_RULE_ROWS} />
        <InfoCard
          title="Non-Negotiable Contrast Rules"
          accent="red"
          body={<BulletList items={CONTRAST_RULES} />}
        />
      </SectionBlock>

      <SectionBlock icon={Wand2} title="Motion Rules">
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Purposeful Motion"
            accent="amber"
            body={<BulletList items={MOTION_RULES} />}
          />
          <InfoCard
            title="Design Review Lens"
            accent="blue"
            body="Ask the same question of motion that we ask of copy: what is happening to me right now? Motion should reinforce the answer by showing focus, change, transition, or confirmation."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Layers3} title="How To Spot Internal-Team Copy">
        <InfoCard
          title="Warning Signs"
          accent="amber"
          body={<BulletList items={INTERNAL_LANGUAGE_SIGNS} />}
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Review Checklist Before Shipping">
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Checklist"
            accent="purple"
            body={<BulletList items={REVIEW_CHECKLIST} />}
          />
          <InfoCard
            title="Rewrite Pattern"
            accent="green"
            body="When copy feels too internal, rewrite from system explanation to user guidance: current moment -> why it matters -> what to do next."
          />
        </CardGrid>
        <DataTable
          columns={['Starting Point', 'Example', 'Better Direction', 'Example']}
          rows={REWRITE_EXAMPLES}
        />
      </SectionBlock>
    </div>
  );
};

export default PulseSystemDesignLanguageTab;
