/**
 * SC01-MP-T14-E2E · P09→P-HOME transition E2E (review-done → home)
 *
 * Phase 3: fix mp.reLaunch syntax (must be { url: ... }) · drop pixelmatch
 *
 * Business flow: User on P09 taps "结束本次" CTA → reLaunch to home
 *
 * trace: pages/review-done → pages/home
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
    await mp.reLaunch({ url: '/pages/review-done/index' });
    await new Promise((r) => setTimeout(r, 1000));
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
    const endBtn = await page.$('[data-test-id="p09-cta-row-end-btn"]');
    expect(endBtn).toBeTruthy();
    await endBtn.tap();
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
