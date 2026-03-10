const path = require('path');
const { chromium } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const storageStatePath = process.env.PLAYWRIGHT_STORAGE_STATE
  ? path.resolve(process.env.PLAYWRIGHT_STORAGE_STATE)
  : path.resolve(process.cwd(), '.playwright/admin-storage-state.json');
const targetEmail = (process.env.PLAYWRIGHT_ADMIN_EMAIL || 'tremaine.grant@gmail.com').trim().toLowerCase();

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: storageStatePath,
  });

  await context.addInitScript(() => {
    window.localStorage.setItem('forceDevFirebase', 'true');
    window.localStorage.setItem('pulse_has_seen_marketing', 'true');
  });

  const page = await context.newPage();

  try {
    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__pulseE2E), undefined, { timeout: 20_000 });

    const result = await page.evaluate(async ({ email }) => {
      return window.__pulseE2E?.ensureAdminRecord(email);
    }, { email: targetEmail });

    if (!result) {
      throw new Error('E2E harness did not return an admin-record result.');
    }

    console.log(`Dev admin record ready for ${result.email} (${result.existed ? 'already existed' : 'created'})`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Failed to ensure dev admin record:', error);
  process.exit(1);
});
