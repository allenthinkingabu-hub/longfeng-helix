/**
 * P04 AI分析结果页 · page-load + testid E2E spec
 *
 * Phase 3: drop pixelmatch VRT · use mp.reLaunch · assert testid · screenshot artifact only
 *
 * trace: SC01-MP-T05-E2E · pages/result/index
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

describe('P04 result page-load + testid (真 IDE)', () => {
  let mp: Awaited<ReturnType<typeof automator.connect>>;

  beforeAll(async () => {
    mp = await Promise.race([
      automator.connect({ wsEndpoint: WS_ENDPOINT }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`connect timeout: ${WS_ENDPOINT} not listening · 先跑 cli auto`)), 8000),
      ),
    ]);

    await mp.reLaunch('/pages/result/index?qid=test-vrt-001');
    await new Promise((r) => setTimeout(r, 1000));
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  it('currentPage.path 为 pages/result/index', async () => {
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/result/index');
  });

  it('页面 DOM 包含 p04-root view 且已渲染', async () => {
    const page = await mp.currentPage();
    const root = await page.$('[data-test-id="p04-root"]');
    expect(root).toBeTruthy();
  });

  it('mp.screenshot 截图落 artifact', async () => {
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
  });
});
