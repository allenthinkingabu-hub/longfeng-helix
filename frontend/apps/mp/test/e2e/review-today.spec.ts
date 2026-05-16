/**
 * SC01-MP-T09-E2E · P07 review-today page-load + testid + console-clean
 *
 * Phase 4 (Fix-2 · 2026-05-16): 用 connectMp + assertConsoleClean + assertPageRenders
 *
 * trace: pages/review-today/index · @longfeng/testids p07
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean, assertPageRenders } from './_helpers';
import { TEST_IDS } from '@longfeng/testids';

describe('P07 review-today · page-load + testid (真 IDE automator)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
    await mp.reLaunch('/pages/review-today/index');
    await new Promise((r) => setTimeout(r, 1500));
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'review-today.spec');
  });

  it('currentPage path is pages/review-today/index 且 view 数 ≥ 8', async () => {
    await assertPageRenders(mp, 'pages/review-today/index', 8);
  });

  it('hero card (data-test-id=today-review-card) is rendered', async () => {
    const page = await mp.currentPage();
    const hero = await page.$(`[data-test-id="${TEST_IDS.p07.todayReviewCard}"]`);
    expect(hero).toBeTruthy();
  });

  it('mp.screenshot 截图落 artifact', async () => {
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
  });
});
