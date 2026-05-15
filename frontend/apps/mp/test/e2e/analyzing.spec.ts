/**
 * P03 Analyzing page · page-load + testid E2E spec
 *
 * Phase 3: drop pixelmatch VRT · use mp.reLaunch · assert testid · screenshot artifact only
 *
 * trace: SC01-MP-T03-E2E · pages/analyzing/index
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

describe('P03 Analyzing page · page-load + testid', () => {
  let mp: Awaited<ReturnType<typeof automator.connect>>;

  beforeAll(async () => {
    mp = await Promise.race([
      automator.connect({ wsEndpoint: WS_ENDPOINT }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`connect timeout: ${WS_ENDPOINT} not listening · 先跑 cli auto`)), 8000),
      ),
    ]);
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  it('reLaunch → pages/analyzing/index · currentPage.path correct', async () => {
    await mp.reLaunch({ url: '/pages/analyzing/index?taskId=demo' });
    await new Promise((r) => setTimeout(r, 800));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/analyzing/index');
  });

  it('关键 testid DOM 已渲染 (p03-thumb-card + analyzing-pipeline)', async () => {
    const page = await mp.currentPage();
    const thumbCard = await page.$('[data-test-id="p03-thumb-card"]');
    expect(thumbCard).toBeTruthy();
    const pipeline = await page.$('[data-test-id="analyzing-pipeline"]');
    expect(pipeline).toBeTruthy();
  });

  it('mp.screenshot captures analyzing page artifact', async () => {
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
  });
});
