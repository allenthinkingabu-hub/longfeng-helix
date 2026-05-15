/**
 * SC01-MP-T14-E2E · P09→P-HOME transition E2E (review-done → home)
 * kind: transition
 * trace: pages/review-done/index.ts onEnd() → wx.reLaunch('/pages/home/index')
 *
 * Business flow:
 *   1. User is on review-done page (P09) after completing a review session
 *   2. User taps "结束本次" CTA → triggers onEnd()
 *   3. onEnd calls completeSession API (best-effort)
 *   4. wx.reLaunch navigates to /pages/home/index (clears stack)
 *   5. currentPage.path should be 'pages/home/index'
 *
 * Phase 1: spec only (no automator execution) · Phase 2: TL串行跑
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

describe('SC01-MP-T14-E2E · done→home transition (真 IDE)', () => {
  let mp: Awaited<ReturnType<typeof automator.connect>>;

  beforeAll(async () => {
    mp = await Promise.race([
      automator.connect({ wsEndpoint: WS_ENDPOINT }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`connect timeout: ${WS_ENDPOINT} not listening · 先跑 cli auto`)), 8000),
      ),
    ]);
  }, 15_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  it('navigate to review-done page via reLaunch', async () => {
    await mp.reLaunch('/pages/review-done/index');
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/review-done/index');
  });

  it('review-done page renders DOM (at least 1 view)', async () => {
    const page = await mp.currentPage();
    const anyView = await page.$('view');
    expect(anyView).toBeTruthy();
  });

  it('tap "结束本次" CTA → reLaunch to /pages/home/index', async () => {
    const page = await mp.currentPage();
    // Find the "结束本次" button by data-test-id and tap (真人操作, 不用 callMethod)
    const endBtn = await page.$('[data-test-id="p09-cta-row-end-btn"]');
    expect(endBtn).toBeTruthy();
    await endBtn.tap();
    // Wait for reLaunch navigation to settle
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const homePage = await mp.currentPage();
    expect(homePage.path).toBe('pages/home/index');
  });

  it('home page DOM rendered after transition (at least 1 view)', async () => {
    const page = await mp.currentPage();
    const anyView = await page.$('view');
    expect(anyView).toBeTruthy();
  });
});
