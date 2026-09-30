export const SEQUENCE_SENDERS = ['tre@fitwithpulse.ai', 'hello@fitwithpulse.ai', 'info@fitwithpulse.ai'] as const;
export const SEQUENCE_AUDIENCES = {
  'athletic-directors': 'Athletic directors',
  coaches: 'Coaches',
  medical: 'Medical staff / psychologists',
} as const;
export type SequenceAudience = keyof typeof SEQUENCE_AUDIENCES;
export type SequenceTracking = { status: string; deliveredAt?: string; openedAt?: string; clickedAt?: string; openCount?: number; clickCount?: number; lastClickedLink?: string; lastEventAt?: string; lastIssueAt?: string };
export type SequenceStep = { tracking?: SequenceTracking; id: string; delayDays: number; subject: string; body: string; sentAt: string; messageId: string };
export type EmailSequence = {
  id: string; ownerUid: string; listId: string; itemId: string;
  audience: SequenceAudience; fromEmail: string; toEmail: string; ccEmails?: string[]; bccEmails?: string[];
  steps: SequenceStep[]; status: 'draft' | 'active' | 'paused' | 'completed' | 'error';
  nextStepIndex: number; nextSendAt: string; version: number;
  lastError: string; createdAt: string; updatedAt: string;
};
export type SequenceDraft = Pick<EmailSequence, 'audience' | 'fromEmail' | 'toEmail' | 'ccEmails' | 'bccEmails' | 'steps'>;

// Supplied outreach wording. Keep school-specific edits in the sequence record.
const templates: Record<SequenceAudience, SequenceStep[]> = {
  "athletic-directors": [
    {
      "id": "email-1",
      "delayDays": 0,
      "subject": "Meeting NCAA mental health mandates with infrastructure, not just policy",
      "body": "Hi [Name],\nManaging NCAA mental health mandates often adds more administrative burden than actionable care. We’re working with departments at the University of South Carolina, Clark Atlanta University, and UMES to solve this by providing the infrastructure to meet these mandates and the documentation to show it.\nThe Athletic Mind Initiative bridges mental performance training (PulseCheck) with clinical support (AuntEDNA.ai) into a single, coordinated system.\nWould you be open to a 10-minute chat on how we're helping departments streamline this strategy?",
      "sentAt": "",
      "messageId": ""
    },
    {
      "id": "email-2",
      "delayDays": 4,
      "subject": "Re: Meeting NCAA mental health mandates",
      "body": "Hi [Name],\nFollowing up on my last note—the current crisis in athlete care isn’t just about access; it’s about triage. Most departments are over-burdened by manual intake and lack visibility into athlete readiness.\nBy integrating AI-driven insights with clinical documentation, we help ADs provide a wraparound system that supports student athletes of color and the broader student body while protecting the department.\nDo you have time for a brief look at how this integrates with your current operations?",
      "sentAt": "",
      "messageId": ""
    },
    {
      "id": "email-3",
      "delayDays": 7,
      "subject": "Still interested?",
      "body": "Hi [Name],\nI know your calendar is likely packed as you navigate the current semester. I’ll stop reaching out for now, but I wanted to leave this [link to case study/one-pager] with you in case mental health infrastructure becomes a priority later this year.\nIf you’d like to see how we’re specifically supporting programs like the University of Maryland Eastern Shore, I’m happy to share those details.",
      "sentAt": "",
      "messageId": ""
    }
  ],
  "coaches": [
    {
      "id": "email-1",
      "delayDays": 0,
      "subject": "Supporting athlete readiness at [University Name]",
      "body": "Hi [Name],\nElite performance requires elite recovery and mindset. I’d like to introduce you to The Athletic Mind Initiative—a system designed to help you spot performance dips before they become issues, without adding to your coaching load.\nPowered by PulseCheck and AuntEDNA.ai, we provide you with high-level team readiness insights while giving your athletes a private, stigma-free way to build mental skills and access care.\nWould you be open to a quick conversation about how this could support your roster?",
      "sentAt": "",
      "messageId": ""
    },
    {
      "id": "email-2",
      "delayDays": 4,
      "subject": "Re: Supporting athlete readiness",
      "body": "Hi [Name],\nTo clarify how this works: PulseCheck handles the daily habits (sleep, readiness scores, recovery), while AuntEDNA handles the clinical side.\nThis means you get a dashboard showing who is fresh and ready to train, while private clinical info stays separate—letting you focus on coaching, not counseling.\nI’d love to share how this is currently being used at [University Name/other client]. Are you open to a 10-minute sync this week?",
      "sentAt": "",
      "messageId": ""
    },
    {
      "id": "email-3",
      "delayDays": 7,
      "subject": "A resource for your staff",
      "body": "Hi [Name],\nI’m sure you’re deep in season prep. Since I haven’t heard back, I assume now isn’t the right time. I’ll circle back in a few months. In the meantime, here is a quick overview of how we’re helping coaches reduce the \"noise\" in athlete communication while boosting performance. [Insert Links]",
      "sentAt": "",
      "messageId": ""
    }
  ],
  "medical": [
    {
      "id": "email-1",
      "delayDays": 0,
      "subject": "Reducing documentation burden in athlete mental health",
      "body": "Hi [Name],\nClinicians in collegiate athletics face an extreme bottleneck: massive case loads and limited time to provide the holistic support athletes need.\nI’d like to introduce The Athletic Mind Initiative, which helps bridge this gap. By leveraging AI to identify early needs and streamline documentation, we help sports psychologists reclaim time for patient care rather than administrative logging.\nAre you available for a brief chat to see how our integration with PulseCheck/AuntEDNA handles clinical triage?",
      "sentAt": "",
      "messageId": ""
    },
    {
      "id": "email-2",
      "delayDays": 4,
      "subject": "Re: Reducing documentation burden",
      "body": "Hi [Name],\nFollowing up on my previous note. We’re particularly focused on how AI can act as a \"first-line\" support for low-acuity cases—freeing up your calendar for the high-acuity interventions that require your specific expertise.\nWe are also exploring joint research with Dr. Jeremy Burnham at Ochsner Health regarding these outcomes. Would you be open to a 15-minute conversation to exchange notes on this?",
      "sentAt": "",
      "messageId": ""
    },
    {
      "id": "email-3",
      "delayDays": 7,
      "subject": "Checking in",
      "body": "Hi [Name],\nI’ll stop following up for now. I know finding the right balance between tech-assisted triage and human-centered care is a high priority in your field. If you’re ever curious to see the data structures we’ve built to ensure patient privacy and clinical rigor, I’d be happy to share.",
      "sentAt": "",
      "messageId": ""
    }
  ]
};

export function createSequenceDraft(audience: SequenceAudience, school: string, toEmail = ''): SequenceDraft {
  const personalize = (text: string) => text.replaceAll('[University Name]', school || '[University Name]');
  return {
    audience, fromEmail: SEQUENCE_SENDERS[0], toEmail, ccEmails: [], bccEmails: [],
    steps: templates[audience].map(step => ({ ...step, subject: personalize(step.subject), body: personalize(step.body) })),
  };
}

export function sequenceDay(steps: SequenceStep[], index: number): number {
  return 1 + steps.slice(0, index + 1).reduce((total, step) => total + step.delayDays, 0);
}

export type SequenceReadinessIssue = { stepIndex: number; day: number; field: 'subject' | 'body'; placeholders: string[]; empty: boolean };

export function sequenceReadinessIssues(steps: SequenceStep[]): SequenceReadinessIssue[] {
  return steps.flatMap((step, stepIndex) => {
    if (step.sentAt) return [];
    return (['subject', 'body'] as const).flatMap(field => {
      const text = step[field];
      const placeholders = Array.from(new Set(text.match(/\[[^\]\n]+\]|\{\{[^}]+\}\}/g) || []));
      return !text.trim() || placeholders.length
        ? [{ stepIndex, day: sequenceDay(steps, stepIndex), field, placeholders, empty: !text.trim() }]
        : [];
    });
  });
}

export function unresolvedSequenceFields(steps: SequenceStep[]): string[] {
  return Array.from(new Set(sequenceReadinessIssues(steps).flatMap(issue => issue.placeholders)));
}
