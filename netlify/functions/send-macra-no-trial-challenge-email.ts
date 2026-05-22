import { createMacraRetargetingEmailHandler } from './utils/macraRetargetingEmail';

export const handler = createMacraRetargetingEmailHandler({
  sequenceId: 'macra-no-trial-7d-challenge-v1',
  stateKey: 'noTrial7dChallenge',
  subject: 'Try Macra with one real meal',
  eyebrow: '7-day check-in',
  headline: 'Try Macra with one real meal, {{firstName}}.',
  intro:
    'No hard sell. Open Macra, scan one meal you were already going to eat, and see what Nora does with the numbers.',
  proofTitle: 'One meal is enough to feel the loop',
  proofBody:
    'Macra turns the scan into a macro breakdown, compares it to your target, and helps you make the next food choice.',
  ctaLabel: 'Try one meal',
  tags: ['no-trial-7d-challenge'],
});
