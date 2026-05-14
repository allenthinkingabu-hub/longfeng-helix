import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'playwright-report/results.xml' }],
    ['line'],
  ],
  outputDir: 'test-results',
  use: {
    headless: false,
    viewport: { width: 480, height: 800 },
    screenshot: 'on',
    video: 'retain-on-failure',
    actionTimeout: 5000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
