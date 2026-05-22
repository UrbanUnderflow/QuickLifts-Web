import { createMacraRetargetingEmailHandler } from './utils/macraRetargetingEmail';

export const handler = createMacraRetargetingEmailHandler({
  sequenceId: 'macra-paywall-view-value-v1',
  stateKey: 'paywallViewValue',
  subject: 'Start with one useful scan today',
  eyebrow: 'One useful action',
  headline: 'Start with one meal today, {{firstName}}.',
  intro:
    'You do not need a perfect tracking day to learn something useful. Scan one real meal and Macra will show how it fits your target.',
  proofTitle: 'The first win is clarity',
  proofBody:
    'A single photo can turn guessing into calories, protein, carbs, and fat, then Nora can help with what to eat next.',
  ctaLabel: 'Scan one meal',
  tags: ['paywall-view-value'],
});
