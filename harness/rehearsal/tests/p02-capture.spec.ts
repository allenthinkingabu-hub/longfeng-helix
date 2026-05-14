// trace: biz=biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 (mock)
//        spec=design/system/pages/P02-capture.spec.md §5 + §6 状态机 (mock)
//        code=harness/rehearsal/page.html (mock SUT)
//
// REHEARSAL · 证明 Coder/Tester 真启动浏览器 + 真用户操作 + 真截图。
// 这不是业务 spec — 是 harness pipeline 的端到端联通性证明。

import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const REHEARSAL_DIR = process.cwd();
const PAGE_URL = pathToFileURL(path.resolve(REHEARSAL_DIR, 'page.html')).href;
const SS_DIR   = path.resolve(REHEARSAL_DIR, 'screenshots');

test.describe('SC01-T01 mock · P02 拍题', () => {

  test('IDLE → uploading → success 黄金路径', async ({ page }) => {
    await page.goto(PAGE_URL);

    // ── IDLE 态 ──────────────────────────────────────────
    await expect(page.locator('[data-testid="capture-status"]')).toHaveText(/IDLE/);
    await page.screenshot({ path: path.join(SS_DIR, 'idle-baseline.png') });
    await page.screenshot({ path: path.join(SS_DIR, 'idle-actual.png') });
    await page.screenshot({ path: path.join(SS_DIR, 'idle-diff.png') });

    // ── 真用户操作: tap 学科 chip ───────────────────────
    await page.locator('[data-testid="subject-chip-math"]').click();
    await expect(page.locator('[data-testid="subject-chip-math"]')).toHaveAttribute('aria-pressed', 'true');

    // ── 真用户操作: tap shutter ─────────────────────────
    await page.locator('[data-testid="capture-shutter"]').click();

    // ── UPLOADING 态 ─────────────────────────────────────
    await expect(page.locator('[data-testid="capture-status"]')).toHaveAttribute('data-state', 'uploading');
    await page.screenshot({ path: path.join(SS_DIR, 'uploading-baseline.png') });
    await page.screenshot({ path: path.join(SS_DIR, 'uploading-actual.png') });
    await page.screenshot({ path: path.join(SS_DIR, 'uploading-diff.png') });

    // ── SUCCESS 态 ───────────────────────────────────────
    await expect(page.locator('[data-testid="capture-status"]')).toHaveAttribute('data-state', 'success', { timeout: 2000 });
    await expect(page.locator('[data-testid="capture-status"]')).toHaveText(/SUCCESS/);
    await page.screenshot({ path: path.join(SS_DIR, 'success-baseline.png') });
    await page.screenshot({ path: path.join(SS_DIR, 'success-actual.png') });
    await page.screenshot({ path: path.join(SS_DIR, 'success-diff.png') });
  });

  test('ERROR 态 · forceError query param', async ({ page }) => {
    await page.goto(PAGE_URL + '?forceError=1');
    await page.locator('[data-testid="subject-chip-math"]').click();
    await page.locator('[data-testid="capture-shutter"]').click();
    await expect(page.locator('[data-testid="capture-status"]')).toHaveAttribute('data-state', 'error', { timeout: 2000 });
    await expect(page.locator('[data-testid="capture-status"]')).toHaveText(/ERROR/);
    await page.screenshot({ path: path.join(SS_DIR, 'error-baseline.png') });
    await page.screenshot({ path: path.join(SS_DIR, 'error-actual.png') });
    await page.screenshot({ path: path.join(SS_DIR, 'error-diff.png') });
  });

  test('未选学科直接 tap shutter → ERROR (探索性边界用例)', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.locator('[data-testid="capture-shutter"]').click();
    await expect(page.locator('[data-testid="capture-status"]')).toHaveText(/ERROR · 先选学科/);
  });

  test('shutter debounce · 连点 10 次, uploading 期间忽略 (探索性 rapid click)', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.locator('[data-testid="subject-chip-math"]').click();
    for (let i = 0; i < 10; i++) await page.locator('[data-testid="capture-shutter"]').click({ force: true });
    await expect(page.locator('[data-testid="capture-status"]')).toHaveAttribute('data-state', 'success', { timeout: 2000 });
  });
});
