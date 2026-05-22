import { createMacraRetargetingEmailHandler } from './utils/macraRetargetingEmail';

export const handler = createMacraRetargetingEmailHandler({
  sequenceId: 'macra-trial-no-activation-24h-v1',
  stateKey: 'trialNoActivation24h',
  subject: 'Your Macra trial is active - start with one meal',
  eyebrow: 'Trial active',
  headline: 'Your trial is active, {{firstName}}. Start with one meal.',
  intro:
    'The fastest way to feel Macra is to log one meal now. Nora can coach the day better once she has a first signal.',
  proofTitle: 'Start the trial with context',
  proofBody:
    'After your first meal, Macra can show what is left for the day and Nora can help you adjust before dinner.',
  ctaLabel: 'Log my first meal',
  tags: ['trial-activation'],
});
