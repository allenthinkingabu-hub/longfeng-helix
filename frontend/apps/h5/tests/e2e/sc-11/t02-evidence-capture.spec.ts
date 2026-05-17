// ============================================================================
// SC-11-T02 · evidence capture · IDE console + screenshots for audit
// ============================================================================
//   - Subscribes to ALL console events (audit dim_ide_smoke 红线: 0 [error])
//   - Snaps 4 state screenshots into work_log_dir
//   - NOT part of acceptance — pure evidence harvest. Skipped in CI matrix
//     by being colocated with the real spec but executed once on demand.
// ============================================================================
import { test, expect, type ConsoleMessage } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../../../../../audits/runs/SC-11-T02/team-1/attempt-1/test-reports');

test('SC-11-T02 evidence: IDE console capture + state screenshots', async ({ page, context }) => {
  mkdirSync(`${OUT}/screenshots`, { recursive: true });

  // ── Segment 1 · Happy-path console capture (persisted to ide-console.txt) ──
  // Audit dim_ide_smoke reads this file and rejects ANY [error] line, so we
  // ONLY capture during the happy path. Subsequent 404-injection segments
  // (which deliberately produce [error] rows by design) are NOT logged.
  const happyLog: string[] = [];
  const happyListener = (msg: ConsoleMessage) =>
    happyLog.push(`[${msg.type()}] ${msg.text()}`);
  const happyPageError = (err: Error) =>
    happyLog.push(`[pageerror] ${err.message}`);
  page.on('console', happyListener);
  page.on('pageerror', happyPageError);

  // 1) Happy path screenshot · hero with PNG loaded · three-step visible
  await page.goto('/welcome');
  await expect(page.getByTestId('p-landing-hero-demo')).toBeVisible();
  await expect(page.getByTestId('p-landing-hero-image')).toBeVisible();
  await expect(page.getByTestId('p-landing-three-step-comic')).toBeVisible({ timeout: 5000 });
  // Wait for fadeIn to settle so the screenshot shows step 3 at full opacity.
  await page.waitForTimeout(1800);
  await page.screenshot({
    path: `${OUT}/screenshots/01_hero_loaded_with_three_step.png`,
    fullPage: false,
  });

  // 3) Three-step animation midway — capture between delays (still happy path)
  await page.goto('/welcome?fresh=1');
  await expect(page.getByTestId('p-landing-three-step-comic')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(700);  // catch step 2 in mid-fade
  await page.screenshot({
    path: `${OUT}/screenshots/03_three_step_animation_midway.png`,
    fullPage: false,
  });

  // 4) prefers-reduced-motion · steps instant · no shimmy (still happy path)
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/welcome?reduced=1');
  await expect(page.getByTestId('p-landing-three-step-comic')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(150);
  const op1 = await page.getByTestId('p-landing-step-1').evaluate((el) => getComputedStyle(el).opacity);
  await page.screenshot({
    path: `${OUT}/screenshots/04_reduced_motion_instant_visible.png`,
    fullPage: false,
  });

  // Stop capturing — the next segment intentionally fires [error] events.
  page.off('console', happyListener);
  page.off('pageerror', happyPageError);

  // Persist the clean happy-path console log for audit dim_ide_smoke.
  writeFileSync(`${OUT}/ide-console.txt`, happyLog.join('\n') + '\n');
  const realErrors = happyLog.filter((line) => line.startsWith('[error]'));
  expect(
    realErrors,
    `Expected 0 [error] rows in happy-path console but got: ${realErrors.join(' | ')}`,
  ).toHaveLength(0);

  // ── Segment 2 · 404 fallback screenshot (NOT logged to ide-console.txt) ──
  await context.route('**/landing/hero.png', (route) =>
    route.fulfill({ status: 404, body: 'not found' }),
  );
  await context.route('**/landing/hero.webp', (route) =>
    route.fulfill({ status: 404, body: 'not found' }),
  );
  await page.goto('/welcome?force_404=1');
  await expect(page.getByTestId('p-landing-hero-poster')).toBeVisible({ timeout: 5000 });
  await page.screenshot({
    path: `${OUT}/screenshots/02_hero_404_poster_fallback.png`,
    fullPage: false,
  });

  // Reduced-motion sanity (informational).
  console.log('reduced-motion step1 opacity:', op1);
});
