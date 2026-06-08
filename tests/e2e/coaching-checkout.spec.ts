import { test, expect, Page } from '@playwright/test';

// E2E for the buyer-facing paid 1-on-1 coaching checkout page
// (src/pages/coaching/[id].tsx). The page fetches the read-only training
// info and POSTs to the checkout functions, which are Netlify functions
// not served by `next dev` — so we mock them with page.route and assert
// the render states + that the correct checkout endpoint is hit.

// Public page — start from a clean (unauthenticated) storage state.
test.use({ storageState: { cookies: [], origins: [] } });

const TRAINING_ID = 't_e2e';

type TrainingInfo = {
  trainingId: string;
  clubName: string;
  status: string;
  paymentStatus: string;
  coachUsername: string;
  coachProfileImage: string;
  inviteMessage: string;
  mode: 'oneTime' | 'recurring' | null;
  interval: 'week' | 'month' | 'year' | null;
  priceLabel: string | null;
};

const oneTimeInfo: TrainingInfo = {
  trainingId: TRAINING_ID,
  clubName: 'The Pact',
  status: 'pending',
  paymentStatus: 'unpaid',
  coachUsername: 'coachjoe',
  coachProfileImage: '',
  inviteMessage: "Let's get to work.",
  mode: 'oneTime',
  interval: null,
  priceLabel: '$99 one-time',
};

const recurringInfo: TrainingInfo = {
  ...oneTimeInfo,
  mode: 'recurring',
  interval: 'week',
  priceLabel: '$25/wk',
};

const freeInfo: TrainingInfo = {
  ...oneTimeInfo,
  mode: null,
  interval: null,
  priceLabel: null,
};

async function mockTrainingInfo(page: Page, info: TrainingInfo | { error: string; status?: number }) {
  await page.route('**/.netlify/functions/get-1on1-training*', async (route) => {
    const status = 'error' in info ? info.status || 404 : 200;
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(info) });
  });
}

async function mockCheckout(page: Page, fnName: string, body: object) {
  await page.route(`**/.netlify/functions/${fnName}`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test.describe('Paid 1-on-1 coaching checkout', () => {
  test('renders a one-time room and starts the one-time checkout', async ({ page }) => {
    await mockTrainingInfo(page, oneTimeInfo);
    // Return a same-origin success URL so the redirect lands on our page.
    await mockCheckout(page, 'create-1on1-checkout', { url: `/coaching/${TRAINING_ID}?status=success` });

    let recurringHit = false;
    await page.route('**/.netlify/functions/create-1on1-subscription-checkout', async (route) => {
      recurringHit = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto(`/coaching/${TRAINING_ID}?buyer=u1`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /Train 1-on-1 with @coachjoe/ })).toBeVisible();
    await expect(page.getByText('The Pact')).toBeVisible();
    await expect(page.getByText('One-time payment')).toBeVisible();

    const cta = page.getByRole('button', { name: /Pay \$99 one-time & unlock/ });
    await expect(cta).toBeVisible();
    await cta.click();

    // The one-time endpoint redirects us into the success state.
    await expect(page.getByRole('heading', { name: "You're in!" })).toBeVisible();
    expect(recurringHit).toBe(false);
  });

  test('renders a recurring room with the auto-pay CTA', async ({ page }) => {
    await mockTrainingInfo(page, recurringInfo);

    let oneTimeHit = false;
    await page.route('**/.netlify/functions/create-1on1-checkout', async (route) => {
      oneTimeHit = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await mockCheckout(page, 'create-1on1-subscription-checkout', { url: `/coaching/${TRAINING_ID}?status=success` });

    await page.goto(`/coaching/${TRAINING_ID}?buyer=u1`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Auto-pay subscription')).toBeVisible();
    const cta = page.getByRole('button', { name: /Start \$25\/wk/ });
    await expect(cta).toBeVisible();
    await cta.click();

    await expect(page.getByRole('heading', { name: "You're in!" })).toBeVisible();
    expect(oneTimeHit).toBe(false);
  });

  test('shows a free room shortcut when there is no price', async ({ page }) => {
    await mockTrainingInfo(page, freeInfo);
    await page.goto(`/coaching/${TRAINING_ID}?buyer=u1`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'This room is free' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Open in app/ })).toBeVisible();
  });

  test('shows the success state with a return-to-app CTA', async ({ page }) => {
    await mockTrainingInfo(page, oneTimeInfo);
    await page.goto(`/coaching/${TRAINING_ID}?buyer=u1&status=success`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: "You're in!" })).toBeVisible();
    await expect(page.getByRole('button', { name: /Open training room/ })).toBeVisible();
  });

  test('shows the cancelled state with a retry CTA', async ({ page }) => {
    await mockTrainingInfo(page, oneTimeInfo);
    await page.goto(`/coaching/${TRAINING_ID}?buyer=u1&status=cancelled`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Checkout canceled' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Try again/ })).toBeVisible();
  });

  test('shows an error when the room is not found', async ({ page }) => {
    await mockTrainingInfo(page, { error: 'Training not found', status: 404 });
    await page.goto(`/coaching/${TRAINING_ID}?buyer=u1`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Training not found')).toBeVisible();
  });
});
