// ============================================================================
// SC-11-T03 · evidence capture · IDE console + state screenshots for audit
// ============================================================================
//   - Subscribes to ALL console events (audit dim_ide_smoke 红线: 0 [error])
//   - Snaps 4 state screenshots into work_log_dir
//   - Pure evidence harvest · not part of acceptance.
// ============================================================================
import { test, expect, type ConsoleMessage } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// HERE = frontend/apps/h5/tests/e2e/sc-11/
// 6 levels up → repo root; then audits/runs/...
const OUT = resolve(
  HERE,
  '../../../../../../audits/runs/SC-11-T03/team-1/attempt-1/test-reports',
);

test('SC-11-T03 evidence: IDE console capture + state screenshots', async ({ page }) => {
  mkdirSync(`${OUT}/screenshots`, { recursive: true });

  // ── Console capture · happy-path only (no 404 noise) ─────────────────
  const happyLog: string[] = [];
  const onConsole = (msg: ConsoleMessage) =>
    happyLog.push(`[${msg.type()}] ${msg.text()}`);
  const onPageError = (err: Error) =>
    happyLog.push(`[pageerror] ${err.message}`);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  // 1) chips_visible · 3 chip render baseline
  await page.goto('/welcome');
  await expect(page.getByTestId('p-landing-sample-chip-math')).toBeVisible({
    timeout: 8000,
  });
  await expect(page.getByTestId('p-landing-sample-chip-english')).toBeVisible();
  await expect(page.getByTestId('p-landing-sample-chip-physics')).toBeVisible();
  await page.screenshot({
    path: `${OUT}/screenshots/01_chips_visible.png`,
    fullPage: false,
  });

  // 2) overlay_open · click chipMath · 3 卡片 visible
  await page.getByTestId('p-landing-sample-chip-math').click();
  await expect(page.getByTestId('p-sample-overlay-root')).toBeVisible();
  await expect(page.getByTestId('p-sample-overlay-error-card')).toBeVisible();
  await expect(page.getByTestId('p-sample-overlay-correction-card')).toBeVisible();
  await expect(page.getByTestId('p-sample-overlay-variant-card')).toBeVisible();
  // 等动画收敛 (slideUp 280ms + fadeIn 240ms)
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${OUT}/screenshots/02_overlay_math_open.png`,
    fullPage: false,
  });

  // 3) overlay_english · 切换 chip 后内容变 (验证 sample 数据流贯通)
  await page.getByTestId('p-sample-overlay-close').click();
  await expect(page.getByTestId('p-sample-overlay-root')).toHaveCount(0);
  await page.getByTestId('p-landing-sample-chip-english').click();
  await expect(page.getByTestId('p-sample-overlay-root')).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${OUT}/screenshots/03_overlay_english_open.png`,
    fullPage: false,
  });

  // 4) overlay_closed_back_to_landing · close 后回 landing 主页
  await page.getByTestId('p-sample-overlay-close').click();
  await expect(page.getByTestId('p-sample-overlay-root')).toHaveCount(0);
  await expect(page.getByTestId('p-landing-root')).toBeVisible();
  await page.screenshot({
    path: `${OUT}/screenshots/04_closed_back_to_landing.png`,
    fullPage: false,
  });

  page.off('console', onConsole);
  page.off('pageerror', onPageError);

  // Persist console log for audit dim_ide_smoke
  writeFileSync(`${OUT}/ide-console.txt`, happyLog.join('\n') + '\n');

  // 0 [error] 红线 (audit.js v3 dim_ide_smoke)
  const errorRows = happyLog.filter((l) => l.startsWith('[error]'));
  expect(
    errorRows,
    `Expected 0 [error] rows · got: ${errorRows.join(' | ')}`,
  ).toHaveLength(0);
});
