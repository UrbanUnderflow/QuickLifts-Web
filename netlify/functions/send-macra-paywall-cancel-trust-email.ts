import { createMacraRetargetingEmailHandler } from './utils/macraRetargetingEmail';

export const handler = createMacraRetargetingEmailHandler({
  sequenceId: 'macra-paywall-cancel-trust-v1',
  stateKey: 'paywallCancelTrust',
  subject: 'No payment today - Apple confirms the details first',
  eyebrow: 'Macra trial',
  headline: 'No payment today, {{firstName}}. Apple confirms the details first.',
  intro:
    'You tapped to start Macra, then stopped before the trial began. The next screen is Apple\'s subscription sheet, where you can review the exact plan and renewal price before approving anything.',
  proofTitle: 'What happens when you try again',
  proofBody:
    'Macra unlocks your target, scanner, meal plan, and Nora coaching after you confirm. If it is not the right fit, you can cancel from Apple Subscriptions before renewal.',
  ctaLabel: 'Open Macra',
  tags: ['paywall-cancel-trust'],
});
