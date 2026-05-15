/**
 * SC01-MP-T13-E2E · P09 review-done page-load + testid
 *
 * Phase 3: drop pixelmatch VRT · use mp.reLaunch · assert testid · screenshot artifact only
 *
 * trace: pages/review-done/index
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

describe('SC01-MP-T13 · P09 review-done page-load + testid (真 IDE)', () => {
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

    await mp.reLaunch({ url: '/pages/review-done/index' });
    await new Promise((r) => setTimeout(r, 1000));
  }, 15_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  it('currentPage.path === pages/review-done/index', async () => {
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/review-done/index');
  });

  it('hero / memory-curve / stats / cta DOM 元素已渲染', async () => {
    const page = await mp.currentPage();

    const hero = await page.$('[data-test-id="celebrate-hero"]');
    expect(hero).toBeTruthy();

    const memoryCurve = await page.$('[data-test-id="memory-curve"]');
    expect(memoryCurve).toBeTruthy();

    const stats = await page.$('[data-test-id="p09-stats-row"]');
    expect(stats).toBeTruthy();

    const cta = await page.$('[data-test-id="p09-cta-row"]');
    expect(cta).toBeTruthy();
  });

  it('mp.screenshot 截图落 artifact', async () => {
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
  });
});
