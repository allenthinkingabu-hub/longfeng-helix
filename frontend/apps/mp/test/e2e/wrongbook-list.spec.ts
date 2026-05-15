/**
 * E2E · P05 错题本列表 · page-load + DOM assert
 *
 * Phase 3: drop pixelmatch VRT · use mp.reLaunch · assert DOM selectors · screenshot artifact only
 * Note: wrongbook-list wxml 暂无 data-test-id · 用 class selector 断言
 *
 * trace: SC01-MP-T07-E2E · pages/wrongbook-list/index
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

describe('P05 wrongbook-list page-load + DOM (真 IDE)', () => {
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

    await mp.reLaunch({ url: '/pages/wrongbook-list/index' });
    await new Promise((r) => setTimeout(r, 1500));
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  it('currentPage.path === pages/wrongbook-list/index', async () => {
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/wrongbook-list/index');
  });

  it('页面 DOM 包含导航栏 + 内容区域关键节点', async () => {
    const page = await mp.currentPage();

    const navH1 = await page.$('.nav-h1');
    expect(navH1).toBeTruthy();

    const search = await page.$('.search');
    expect(search).toBeTruthy();

    const chipsRow = await page.$('.chips-row');
    expect(chipsRow).toBeTruthy();

    const content = await page.$('.content');
    expect(content).toBeTruthy();
  });

  it('mp.screenshot 截图落 artifact', async () => {
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
  });
});
