import { existsSync } from 'fs';
import path from 'path';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const defaultStorageState = path.resolve(process.cwd(), '.playwright/admin-storage-state.json');
const storageState = process.env.PLAYWRIGHT_STORAGE_STATE || (existsSync(defaultStorageState) ? defaultStorageState : undefined);
const useExistingServer = process.env.PLAYWRIGHT_USE_EXISTING_SERVER === 'true';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html'], ['list']] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    storageState,
  },
  webServer: useExistingServer
    ? undefined
    : {
        command: 'NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE=true npm run dev',
        url: `${baseURL}/admin/systemOverview`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
