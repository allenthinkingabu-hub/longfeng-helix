// SC-11-T01 · screenshot collector spec (LOADING / READY / DEGRADED-samples / DEGRADED-kpi)
// Writes directly to disk (path option) so Playwright's cleanup of test-results/
// does not remove them. Output: ../../../audits/runs/SC-11-T01/team-1/attempt-1/test-reports/screenshots/
import { test, type Route } from '@playwright/test';
import * as path from 'path';

// Playwright runs specs from the package root (frontend/apps/h5/).
// Repo root = 3 levels up.
const REPO_ROOT = path.resolve(process.cwd(), '../../..');
const SHOTS_DIR = path.join(
  REPO_ROOT,
  'audits/runs/SC-11-T01/team-1/attempt-1/test-reports/screenshots',
);

test.describe('SC-11-T01 · 4 state screenshots', () => {
  test('00_loading_skeleton', async ({ page }) => {
    await page.route('**/api/landing/samples**', async (route: Route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });
    await page.route('**/api/landing/kpi', async (route: Route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });
    await page.goto('/welcome');
    await page.getByTestId('p-landing-skeleton').waitFor({ state: 'visible' });
    await page.screenshot({
      path: path.join(SHOTS_DIR, '00_loading_skeleton.png'),
      fullPage: true,
    });
  });

  test('01_ready_full', async ({ page }) => {
    await page.goto('/welcome');
    await page.getByTestId('p-landing-samples-section').waitFor({ state: 'visible' });
    await page.getByTestId('p-landing-kpi-bar').waitFor({ state: 'visible' });
    await page.screenshot({
      path: path.join(SHOTS_DIR, '01_ready_full.png'),
      fullPage: true,
    });
  });

  test('02_degraded_samples', async ({ page }) => {
    await page.route('**/api/landing/samples**', (route) =>
      route.fulfill({ status: 500, body: '{}' }),
    );
    await page.goto('/welcome');
    await page.getByTestId('p-landing-degraded-banner').waitFor({ state: 'visible' });
    await page.screenshot({
      path: path.join(SHOTS_DIR, '02_degraded_samples.png'),
      fullPage: true,
    });
  });

  test('03_degraded_kpi', async ({ page }) => {
    await page.route('**/api/landing/kpi', (route) =>
      route.fulfill({ status: 500, body: '{}' }),
    );
    await page.goto('/welcome');
    await page.getByTestId('p-landing-degraded-banner').waitFor({ state: 'visible' });
    await page.screenshot({
      path: path.join(SHOTS_DIR, '03_degraded_kpi.png'),
      fullPage: true,
    });
  });
});
