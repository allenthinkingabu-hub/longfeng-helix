/**
 * SC01-MP-T14-E2E · P09 review-done → P-HOME transition + console-clean
 *
 * Phase 4 (Fix-2 · 2026-05-16): 用 connectMp + assertConsoleClean
 *
 * Business flow: User on P09 taps "结束本次" CTA → reLaunch to home
 *
 * trace: pages/review-done → pages/home
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean } from './_helpers';

describe('SC01-MP-T14-E2E · done→home transition (真 IDE)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'done-to-home.spec');
  });

  it('navigate to review-done page via reLaunch', async () => {
    await mp.reLaunch('/pages/review-done/index');
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
