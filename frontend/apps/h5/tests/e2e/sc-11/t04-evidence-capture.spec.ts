// ============================================================================
// SC-11-T04 · evidence capture · IDE console + state screenshots for audit
// ============================================================================
//   - Subscribes to ALL console events (audit dim_ide_smoke 红线: 0 [error])
//   - Snaps 4 state screenshots into work_log_dir/test-reports/screenshots/
//   - Pure evidence harvest · not part of acceptance.
// ============================================================================
import { test, expect, type ConsoleMessage } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(
  HERE,
  '../../../../../../audits/runs/SC-11-T04/team-1/attempt-1/test-reports',
);

test('SC-11-T04 evidence: IDE console capture + 4 state screenshots', async ({ page }) => {
  mkdirSync(`${OUT}/screenshots`, { recursive: true });

  // ── Console capture ─────────────────────────────────────────────────
  const happyLog: string[] = [];
  const onConsole = (msg: ConsoleMessage): void => {
    happyLog.push(`[${msg.type()}] ${msg.text()}`);
  };
  const onPageError = (err: Error): void => {
    happyLog.push(`[pageerror] ${err.message}`);
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  // ── (1) try_first 桶 · 默认布局 (主 CTA 在左) ─────────────────────
  await page.goto('/welcome');
  await expect(page.getByTestId('p-landing-cta-try')).toBeVisible({
    timeout: 8000,
  });
  await expect(page.getByTestId('p-landing-cta-login')).toBeVisible();
  await expect(page.getByTestId('p-landing-parent-hint')).toBeVisible();
  await expect(page.getByTestId('p-landing-consent-bar')).toBeVisible();
  // 滚到 CTA 可见 · 防 sticky 区被遮挡
  await page.getByTestId('p-landing-cta-wrap').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({
    path: `${OUT}/screenshots/01_try_first_default_layout.png`,
    fullPage: true,
  });

  // ── (2) login_first 桶 · A/B 反序 ──────────────────────────────────
  await page.goto('/welcome?ab=login_first');
  await expect(page.getByTestId('p-landing-cta-wrap')).toHaveAttribute(
    'data-bucket',
    'login_first',
  );
  await page.getByTestId('p-landing-cta-wrap').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({
    path: `${OUT}/screenshots/02_login_first_bucket_swap.png`,
    fullPage: true,
  });

  // ── (3) overseas 桶 · ConsentBar 顶部横幅 ──────────────────────────
  await page.goto('/welcome?region=overseas');
  await expect(page.getByTestId('p-landing-consent-bar')).toBeVisible();
  const region = await page.getByTestId('p-landing-consent-bar').getAttribute('data-region');
  expect(region).toBe('overseas');
  await page.waitForTimeout(200);
  await page.screenshot({
    path: `${OUT}/screenshots/03_overseas_consent_banner_top.png`,
    fullPage: true,
  });

  // ── (4) entry_source XSS sanitize · URL XSS payload ────────────────
  await page.goto(
    '/welcome?entry_source=' + encodeURIComponent('<script>alert(1)</script>'),
  );
  await expect(page.getByTestId('p-landing-cta-try')).toBeVisible();
  // 验 DOM 中不含未转义 <script>
  const html = await page.content();
  expect(html.includes('<script>alert(1)</script>')).toBe(false);
  await page.waitForTimeout(300); // 给 console.log payload deserialize 一点时间
  await page.screenshot({
    path: `${OUT}/screenshots/04_entry_source_xss_sanitized.png`,
    fullPage: true,
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
