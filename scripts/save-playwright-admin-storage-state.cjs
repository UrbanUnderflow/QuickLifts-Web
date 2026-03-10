const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { chromium } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const outputPath = process.env.PLAYWRIGHT_STORAGE_STATE
  ? path.resolve(process.env.PLAYWRIGHT_STORAGE_STATE)
  : path.resolve(process.cwd(), '.playwright/admin-storage-state.json');
const remoteLoginToken = process.env.PLAYWRIGHT_REMOTE_LOGIN_TOKEN;

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function waitForEnter(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(promptText, () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  ensureDir(outputPath);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
  });

  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.localStorage.setItem('forceDevFirebase', 'true');
  });
  const page = await context.newPage();

  try {
    if (remoteLoginToken) {
      const next = '/admin/systemOverview#variant-registry';
      await page.goto(`${baseURL}/remote-login?token=${encodeURIComponent(remoteLoginToken)}&next=${encodeURIComponent(next)}`, {
        waitUntil: 'networkidle',
      });
      await page.waitForTimeout(2000);
    } else {
      await page.goto(`${baseURL}/admin/systemOverview#variant-registry`, {
        waitUntil: 'domcontentloaded',
      });
      console.log('');
      console.log('Playwright auth capture is open in a browser window.');
      console.log('1. Complete admin login in the browser.');
      console.log('2. Make sure you can see the Variant Registry or admin area.');
      console.log('3. Return here and press Enter to save storage state.');
      console.log('');
      await waitForEnter('Press Enter after admin login is complete...');
    }

    await context.storageState({ path: outputPath, indexedDB: true });
    console.log('');
    console.log(`Saved Playwright admin storage state to: ${outputPath}`);
    console.log('You can now run:');
    console.log('npm run test:e2e');
    console.log('');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Failed to capture Playwright admin storage state:', error);
  process.exit(1);
});
