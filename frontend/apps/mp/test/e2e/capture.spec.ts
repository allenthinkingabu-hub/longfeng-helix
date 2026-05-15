/**
 * P02 capture page · page-load + testid E2E spec
 *
 * Phase 3: drop pixelmatch VRT · use mp.reLaunch · assert testid · screenshot artifact only
 *
 * trace: SC01-MP-T01-E2E · pages/capture/index
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

describe('P02 capture page-load + testid (真 IDE)', () => {
  let mp: Awaited<ReturnType<typeof automator.connect>>;

  beforeAll(async () => {
    mp = await Promise.race([
      automator.connect({ wsEndpoint: WS_ENDPOINT }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`connect timeout: ${WS_ENDPOINT} not listening · 先跑 cli auto`)), 8000),
      ),
    ]);

    await mp.reLaunch('/pages/capture/index');
    await new Promise((r) => setTimeout(r, 1000));
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  it('currentPage().path === pages/capture/index', async () => {
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/capture/index');
  });

  it('capture 页核心 DOM 已渲染 (p02-root + shutter + subjects)', async () => {
    const page = await mp.currentPage();
    const root = await page.$('[data-test-id="p02-root"]');
    expect(root).toBeTruthy();
    const shutter = await page.$('[data-test-id="capture-shutter"]');
    expect(shutter).toBeTruthy();
    const subjects = await page.$('[data-test-id="p02-subjects"]');
    expect(subjects).toBeTruthy();
  });

  it('mp.screenshot 截图落 artifact', async () => {
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
  });
});
