import { expect, test, type Page } from '@playwright/test';

const flowLabPath = '/PulseCheck/subscription-flow-lab';

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
});

async function openFlowLab(page: Page) {
  await page.goto(flowLabPath, { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('heading', { name: 'Athlete subscription Flow Lab' })
  ).toBeVisible();
  await expect(page.getByText('Safe simulation', { exact: true })).toBeVisible();
}

async function getWorkingPreviewUrl(
  page: Page,
  productionPath: 'athlete-offer' | 'team-invite'
) {
  await expect(page.locator('body')).not.toContainText('flow-lab.local');

  const primaryLink = page.getByTestId('flow-lab-preview-url');
  await expect(primaryLink).toBeVisible();
  const href = await primaryLink.getAttribute('href');
  expect(href).toBeTruthy();

  const previewUrl = new URL(href || '', page.url());
  expect(previewUrl.origin).toBe(new URL(page.url()).origin);
  expect(previewUrl.pathname).toBe(flowLabPath);
  expect(previewUrl.searchParams.get('preview')).toBe('athlete');
  expect(previewUrl.href).not.toContain('flow-lab.local');

  const productionExample = page.getByTestId('flow-lab-production-url-example');
  await expect(productionExample).toBeVisible();
  await expect(productionExample).toContainText(/Production URL example|Example only/i);
  await expect(productionExample).toContainText(`/PulseCheck/${productionPath}/`);
  await expect(productionExample).not.toHaveAttribute('href', /.+/);

  return previewUrl.href;
}

async function expectHydratedPrice(page: Page, formattedPrice: string) {
  await expect(page.getByTestId('flow-lab-preview-price')).toHaveText(formattedPrice);
}

async function reachPaidCheckout(page: Page, price = '24.99') {
  await page.getByRole('button', { name: 'Coach offer live', exact: true }).click();
  await expect(page.getByTestId('coach-offer-toggle')).toHaveAttribute(
    'aria-checked',
    'true'
  );
  await page.getByTestId('coach-price-input').fill(price);

  await page.getByTestId('continue-to-referrals').click();
  await page.getByTestId('continue-to-invite').click();
  await page.getByTestId('generate-invite').click();
  const previewUrl = await getWorkingPreviewUrl(page, 'athlete-offer');

  await page.goto(previewUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Athlete landing', { exact: true })).toBeVisible();
  await expectHydratedPrice(page, `$${price}`);
  await expect(page.getByText(`$${price} per month. Choose your account before Stripe.`)).toBeVisible();
  await page.getByTestId('account-email').click();
  await page.getByTestId('continue-to-checkout').click();
  await expect(page.getByText('Simulated Stripe checkout', { exact: true })).toBeVisible();
}

test.describe('PulseCheck subscription Flow Lab', () => {
  test.beforeEach(async ({ page }) => {
    await openFlowLab(page);
  });

  test('successful paid path bypasses the paywall only for the checkout account', async ({ page }) => {
    await reachPaidCheckout(page);

    await page.getByTestId('checkout-scenario-success').click();
    await page.getByTestId('run-checkout').click();
    await expect(page.getByText('Payment received', { exact: true })).toBeVisible();

    await page.getByTestId('continue-to-complete').click();
    await expect(page.getByText('Access ready', { exact: true })).toBeVisible();
    await expect(
      page.getByText('The same account can sign in on any phone and continue onboarding.')
    ).toBeVisible();

    await page.getByTestId('simulate-open-app').click();
    await expect(page.getByText('Mobile app handoff', { exact: true })).toBeVisible();
    await expect(page.getByText('Paywall bypassed', { exact: true })).toBeVisible();
    await expect(
      page.getByText('The app continues into team onboarding with the active plan.')
    ).toBeVisible();

    await page.getByRole('button', { name: /Different account/ }).click();
    await expect(page.getByText('Paywall remains', { exact: true })).toBeVisible();
    await expect(
      page.getByText('This account has no matching sponsored or paid access.')
    ).toBeVisible();

    await page.getByRole('button', { name: /Same checkout account/ }).click();
    await expect(page.getByText('Paywall bypassed', { exact: true })).toBeVisible();
  });

  test('cancelled payment exposes the unresolved athlete message decision', async ({ page }) => {
    await reachPaidCheckout(page);

    await page.getByTestId('checkout-scenario-cancelled').click();
    await page.getByTestId('run-checkout').click();

    await expect(page.getByText('Decision needed', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Should the athlete see a checkout cancellation message?',
      })
    ).toBeVisible();
    await expect(
      page.getByText(/Current behavior returns the signed-in athlete to the offer page/)
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try checkout again' })).toBeVisible();
  });

  test('an offer paused after link sharing shows the roster and paywall dead end', async ({ page }) => {
    await page.getByTestId('coach-price-input').fill('37.50');
    await page
      .getByRole('button', { name: 'Offer paused after link issued', exact: true })
      .click();

    await expect(page.getByText('Decision needed', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'What should happen when a coach pauses an offer after sharing its link?',
      })
    ).toBeVisible();
    await expect(
      page.getByText(/Current behavior lets the athlete join the team without a paid plan/)
    ).toBeVisible();

    const previewUrl = await getWorkingPreviewUrl(page, 'athlete-offer');
    await page.goto(previewUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Athlete landing', { exact: true })).toBeVisible();
    await expectHydratedPrice(page, '$37.50');
    await expect(
      page.getByText('This shared link points to an offer that the coach paused.')
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'The current flow reaches a paywall after team join',
      })
    ).toBeVisible();

    await page.getByTestId('continue-to-checkout').click();
    await expect(page.getByText('Team joined', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'The app still needs an active access plan' })
    ).toBeVisible();
    await expect(page.getByText(/current paused-offer dead end/)).toBeVisible();

    await page.getByTestId('simulate-open-app').click();
    await expect(page.getByText('Paywall remains', { exact: true })).toBeVisible();
  });

  test('all-off commercialization hides the Referral Links tab and every card', async ({ page }) => {
    await page.getByRole('button', { name: 'All off', exact: true }).click();
    await page.getByTestId('continue-to-referrals').click();

    await expect(page.getByText('Hidden from the coach navigation')).toBeVisible();
    await expect(page.getByText('HIDDEN', { exact: true })).toBeVisible();
    await expect(
      page.getByText('The coach sees no Referral Links tab or empty page.')
    ).toBeVisible();
    await expect(page.getByText('Athlete team invite', { exact: true })).toHaveCount(0);
    await expect(
      page.getByText('Parent readiness assessment', { exact: true })
    ).toHaveCount(0);
    await expect(page.getByText('Coach referral', { exact: true })).toHaveCount(0);
  });

  test('a sponsored team uses the direct invite and skips checkout', async ({ page }) => {
    await page.getByTestId('coach-price-input').fill('31.25');
    await page.getByRole('button', { name: 'Sponsored team', exact: true }).click();
    await page.getByTestId('continue-to-referrals').click();

    await expect(page.getByText('Athlete team invite', { exact: true })).toBeVisible();
    await expect(
      page.getByText('The team covers app access. Athlete skips checkout.')
    ).toBeVisible();

    await page.getByTestId('continue-to-invite').click();
    await page.getByTestId('generate-invite').click();
    const previewUrl = await getWorkingPreviewUrl(page, 'team-invite');

    await page.goto(previewUrl, { waitUntil: 'domcontentloaded' });
    await expectHydratedPrice(page, '$31.25');
    await expect(
      page.getByText('Your team covers your app access. Use an account to save it.')
    ).toBeVisible();
    await page.getByTestId('continue-to-checkout').click();

    await expect(page.getByText('Simulated Stripe checkout', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Access ready', { exact: true })).toBeVisible();
    await page.getByTestId('simulate-open-app').click();
    await expect(page.getByText('Paywall bypassed', { exact: true })).toBeVisible();
  });
});
