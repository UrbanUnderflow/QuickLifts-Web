export const PIPELISTS_RUNBOOK_ID = 'university-sales-strategy';
export const PIPELISTS_RUNBOOK_TITLE_MAX_LENGTH = 160;
export const PIPELISTS_RUNBOOK_CONTENT_MAX_LENGTH = 250_000;

export const DEFAULT_PIPELISTS_RUNBOOK_TITLE = 'PulseCheck University Sales Runbook';

export const DEFAULT_PIPELISTS_RUNBOOK_CONTENT = `## Purpose

This page is the shared source for how the team identifies, engages, pilots, and grows university partnerships. Update it when the team learns something that should change how everyone works.

> Every stage has evidence. Every pilot has agreed success criteria. Every pilot end date includes a scheduled value and conversion review.

## 1. Commercial goal and definitions

- Confirm whether the primary target is qualified pipeline, signed pilot value, annual contract value, or recognized revenue.
- Track pilot value and post-pilot annual contract value separately.
- Use observed conversion rates to update account volume, hiring, and forecasts.

## 2. Ideal university account

A strong account has a clear performance or sports medicine need, a credible internal champion, executive sponsorship potential, an understood security and procurement path, and a defined window for launching a pilot.

### Core buying group

- Director of Sports Performance or Head Strength Coach
- Director of Sports Medicine or Head Athletic Trainer
- Athletic Director or sport administrator
- Mental health or counseling lead when the workflow calls for one
- IT, information security, privacy, legal, procurement, and finance
- Coaches, program staff, and athlete representatives when appropriate

## 3. Core message

PulseCheck helps authorized university staff see changing athlete-reported and recovery patterns, coordinate support earlier, and evaluate how well their daily workflow is working.

Every message should name one audience, one relevant problem, one useful outcome, and one clear next step.

## 4. Initial outreach sequence

| Timing | Action | Resource and goal |
| --- | --- | --- |
| Before Day 1 | Research the university and form one credible workflow hypothesis | Verify the source and identify at least two relevant stakeholders |
| Day 1 | Send a short persona-specific email | Observation, problem, value, and one 10 to 15 minute ask |
| Day 4 | Call and leave a voicemail | Reference the Day 1 email and keep the voicemail under 25 seconds |
| Day 8 | Send a threaded proof follow-up | Share one relevant workflow visual, pilot blueprint, or approved case study |
| Day 12 | Send a permission-based close-the-loop message | Offer two times, ask for the correct owner, or request permission to reconnect |
| Day 21 and beyond | Use trigger-based nurture | Reconnect around season timing, budget cycles, events, or new approved proof |

## 5. Sales stages and exit evidence

### ICP qualified

- Account fit is documented.
- An owner is assigned.
- At least two relevant stakeholders are identified.

### Outreach active

- The approved sequence is underway.
- Each completed touch and response is recorded.

### Discovery complete

- Priority, current workflow, timing, champion, and next step are confirmed.
- The buying group and procurement path are being mapped.

### Demo and validation complete

- The right stakeholders attended.
- Functional and technical questions are documented.
- The next action has an owner and date.

### Pilot designed and agreed

- Scope, cohort, dates, responsibilities, support path, and price are documented.
- Success measures include a baseline, target, source, owner, and deadline.
- Midpoint and final value reviews are scheduled.

### Pilot active

- Launch tasks are complete.
- The first valid reporting week is recorded.
- The university champion receives a weekly scorecard.

### Value review and conversion

- Results, limitations, workflow learning, and open risks are reviewed with the sponsor.
- The expand, extend, convert, pause, or complete decision is recorded.

## 6. Required resource package

- University pilot overview
- Performance and sports medicine workflow briefs
- Discovery guide and stakeholder map
- Role-specific demo script
- Pilot charter, success plan, and mutual action plan
- Security, privacy, data-flow, and accessibility packet
- Claims and evidence guide
- Staff and athlete launch communications
- Weekly scorecard, midpoint review, and final executive readout
- Pricing and procurement checklist

## 7. Pilot handoff and customer success

Before launch, name the executive sponsor, university champion, PulseCheck owner, product or technical owner, and escalation contact. Schedule the weekly champion meeting, midpoint review, final value review, and commercial decision date.

Track these dimensions each week:

- Launch readiness
- Athlete activation and participation
- Data coverage and freshness
- Staff training and workflow use
- Product and support reliability
- Champion and sponsor engagement
- Conversion decision readiness

Keep athlete-level responses, private Nora content, clinical notes, and individually identifiable escalation details inside their authorized operational systems. PipeLists uses approved aggregate and commercial information.

## 8. Weekly team cadence

- Review target-account quality and source verification.
- Review outreach completion, replies, meetings, and next actions.
- Review time in stage and stalled opportunities.
- Review every active pilot's health, blockers, upcoming milestones, and decision date.
- Record approved changes to this runbook after the meeting.

## 9. Ownership

- **GTM owner:** Maintains account strategy, messaging, stage evidence, and forecast definitions.
- **Outbound owner:** Runs approved sequences and records complete activity.
- **Solutions and privacy support:** Maintains technical, security, privacy, and evidence resources.
- **Customer success owner:** Runs kickoff, weekly scorecards, risk recovery, value reviews, and conversion handoff.
- **Leadership:** Approves commercial definitions, claims, pricing, and material changes to the operating model.
`;

export type PipeListsRunbookDiffKind = 'unchanged' | 'added' | 'removed';

export interface PipeListsRunbookDiffLine {
  kind: PipeListsRunbookDiffKind;
  text: string;
  beforeLineNumber?: number;
  afterLineNumber?: number;
}

export interface PipeListsRunbookDiffSummary {
  additions: number;
  removals: number;
  changedLines: number;
}

const splitRunbookLines = (value: string) => {
  const normalized = value.replace(/\r\n?/g, '\n');
  return normalized ? normalized.split('\n') : [];
};

const fallbackRunbookDiff = (
  beforeLines: string[],
  afterLines: string[],
  beforeOffset = 0,
  afterOffset = 0,
): PipeListsRunbookDiffLine[] => [
  ...beforeLines.map((text, index) => ({
    kind: 'removed' as const,
    text,
    beforeLineNumber: beforeOffset + index + 1,
  })),
  ...afterLines.map((text, index) => ({
    kind: 'added' as const,
    text,
    afterLineNumber: afterOffset + index + 1,
  })),
];

export const buildPipeListsRunbookLineDiff = (
  before: string,
  after: string,
): PipeListsRunbookDiffLine[] => {
  const beforeLines = splitRunbookLines(before);
  const afterLines = splitRunbookLines(after);

  if (beforeLines.length === 0) return fallbackRunbookDiff([], afterLines);
  if (afterLines.length === 0) return fallbackRunbookDiff(beforeLines, []);

  let commonPrefixLength = 0;
  while (
    commonPrefixLength < beforeLines.length &&
    commonPrefixLength < afterLines.length &&
    beforeLines[commonPrefixLength] === afterLines[commonPrefixLength]
  ) {
    commonPrefixLength += 1;
  }

  let commonSuffixLength = 0;
  while (
    commonSuffixLength < beforeLines.length - commonPrefixLength &&
    commonSuffixLength < afterLines.length - commonPrefixLength &&
    beforeLines[beforeLines.length - commonSuffixLength - 1] ===
      afterLines[afterLines.length - commonSuffixLength - 1]
  ) {
    commonSuffixLength += 1;
  }

  const prefixDiff: PipeListsRunbookDiffLine[] = beforeLines
    .slice(0, commonPrefixLength)
    .map((text, index) => ({
      kind: 'unchanged',
      text,
      beforeLineNumber: index + 1,
      afterLineNumber: index + 1,
    }));
  const suffixDiff: PipeListsRunbookDiffLine[] = beforeLines
    .slice(beforeLines.length - commonSuffixLength)
    .map((text, index) => ({
      kind: 'unchanged',
      text,
      beforeLineNumber: beforeLines.length - commonSuffixLength + index + 1,
      afterLineNumber: afterLines.length - commonSuffixLength + index + 1,
    }));
  const beforeMiddle = beforeLines.slice(
    commonPrefixLength,
    beforeLines.length - commonSuffixLength,
  );
  const afterMiddle = afterLines.slice(
    commonPrefixLength,
    afterLines.length - commonSuffixLength,
  );

  if (beforeMiddle.length === 0 || afterMiddle.length === 0) {
    return [
      ...prefixDiff,
      ...fallbackRunbookDiff(
        beforeMiddle,
        afterMiddle,
        commonPrefixLength,
        commonPrefixLength,
      ),
      ...suffixDiff,
    ];
  }

  const cellCount = (beforeMiddle.length + 1) * (afterMiddle.length + 1);
  if (cellCount > 1_000_000) {
    return [
      ...prefixDiff,
      ...fallbackRunbookDiff(
        beforeMiddle,
        afterMiddle,
        commonPrefixLength,
        commonPrefixLength,
      ),
      ...suffixDiff,
    ];
  }

  const longestCommonSubsequence = Array.from(
    { length: beforeMiddle.length + 1 },
    () => new Uint32Array(afterMiddle.length + 1),
  );

  for (let beforeIndex = beforeMiddle.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = afterMiddle.length - 1; afterIndex >= 0; afterIndex -= 1) {
      longestCommonSubsequence[beforeIndex][afterIndex] =
        beforeMiddle[beforeIndex] === afterMiddle[afterIndex]
          ? longestCommonSubsequence[beforeIndex + 1][afterIndex + 1] + 1
          : Math.max(
              longestCommonSubsequence[beforeIndex + 1][afterIndex],
              longestCommonSubsequence[beforeIndex][afterIndex + 1],
            );
    }
  }

  const middleDiff: PipeListsRunbookDiffLine[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;

  while (beforeIndex < beforeMiddle.length && afterIndex < afterMiddle.length) {
    if (beforeMiddle[beforeIndex] === afterMiddle[afterIndex]) {
      middleDiff.push({
        kind: 'unchanged',
        text: beforeMiddle[beforeIndex],
        beforeLineNumber: commonPrefixLength + beforeIndex + 1,
        afterLineNumber: commonPrefixLength + afterIndex + 1,
      });
      beforeIndex += 1;
      afterIndex += 1;
      continue;
    }

    if (
      longestCommonSubsequence[beforeIndex + 1][afterIndex] >=
      longestCommonSubsequence[beforeIndex][afterIndex + 1]
    ) {
      middleDiff.push({
        kind: 'removed',
        text: beforeMiddle[beforeIndex],
        beforeLineNumber: commonPrefixLength + beforeIndex + 1,
      });
      beforeIndex += 1;
    } else {
      middleDiff.push({
        kind: 'added',
        text: afterMiddle[afterIndex],
        afterLineNumber: commonPrefixLength + afterIndex + 1,
      });
      afterIndex += 1;
    }
  }

  while (beforeIndex < beforeMiddle.length) {
    middleDiff.push({
      kind: 'removed',
      text: beforeMiddle[beforeIndex],
      beforeLineNumber: commonPrefixLength + beforeIndex + 1,
    });
    beforeIndex += 1;
  }

  while (afterIndex < afterMiddle.length) {
    middleDiff.push({
      kind: 'added',
      text: afterMiddle[afterIndex],
      afterLineNumber: commonPrefixLength + afterIndex + 1,
    });
    afterIndex += 1;
  }

  return [...prefixDiff, ...middleDiff, ...suffixDiff];
};

export const summarizePipeListsRunbookDiff = (
  diff: PipeListsRunbookDiffLine[],
): PipeListsRunbookDiffSummary => {
  const additions = diff.filter((line) => line.kind === 'added').length;
  const removals = diff.filter((line) => line.kind === 'removed').length;
  return {
    additions,
    removals,
    changedLines: additions + removals,
  };
};

export const isSafePipeListsRunbookUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('#') || /^\/(?!\/)/.test(trimmed)) return true;

  try {
    const url = new URL(trimmed);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
};
