import { createMacraRetargetingEmailHandler } from './utils/macraRetargetingEmail';

export const handler = createMacraRetargetingEmailHandler({
  sequenceId: 'macra-web-offer-proof-v1',
  stateKey: 'webOfferProof',
  subject: 'Your Macra plan was built around your goal',
  eyebrow: 'Your plan preview',
  headline: '{{firstName}}, your Macra plan was built around your goal.',
  intro:
    'You already gave Macra enough context to build a useful starting point. Your targets, meal plan, and Nora coaching are meant to turn that goal into a clear food decision today.',
  proofTitle: 'Why this is different from a blank food tracker',
  proofBody:
    'Macra starts from your profile instead of asking you to guess. Nora uses your target, plan, and saved meals to help you decide what fits next.',
  ctaLabel: 'Start your free month',
  ctaUrlMode: 'webOfferCheckout',
  checkoutPlan: 'monthly',
  tags: ['web-offer-proof'],
});
