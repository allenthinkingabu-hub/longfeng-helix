/**
 * SC01-MP-T09-E2E · P07 今日复习 · page-load + testid E2E spec
 *
 * Phase 3: drop pixelmatch VRT · use mp.reLaunch · assert testid · screenshot artifact only
 *
 * trace: pages/review-today/index · @longfeng/testids p07
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';
import { TEST_IDS } from '@longfeng/testids';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

describe('P07 review-today · page-load + testid (真 IDE automator)', () => {
  let mp: Awaited<ReturnType<typeof automator.connect>>;

  beforeAll(async () => {
    mp = await Promise.race([
      automator.connect({ wsEndpoint: WS_ENDPOINT }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`connect timeout: ${WS_ENDPOINT} not listening · 先跑 cli auto`)),
          8000,
        ),
      ),
    ]);

    await mp.reLaunch({ url: '/pages/review-today/index' });
    await new Promise((r) => setTimeout(r, 1500));
  }, 15_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  it('currentPage path is pages/review-today/index', async () => {
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/review-today/index');
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
