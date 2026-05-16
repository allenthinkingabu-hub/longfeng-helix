/**
 * SC01-MP-T07-E2E · P05 错题本列表 page-load + DOM + console-clean
 *
 * Phase 4 (Fix-2 · 2026-05-16): 用 connectMp + assertConsoleClean + assertPageRenders
 *
 * trace: pages/wrongbook-list/index
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean, assertPageRenders } from './_helpers';

describe('P05 wrongbook-list page-load + DOM (真 IDE)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
    await mp.reLaunch('/pages/wrongbook-list/index');
    await new Promise((r) => setTimeout(r, 1500));
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'wrongbook-list.spec');
  });

  it('currentPage.path === pages/wrongbook-list/index 且 view 数 ≥ 5', async () => {
    await assertPageRenders(mp, 'pages/wrongbook-list/index', 5);
  });

  it('页面 DOM 包含导航栏 + 内容区域关键节点 (data-test-id)', async () => {
    const page = await mp.currentPage();

    const root = await page.$('[data-test-id="wrongbook.list.root"]');
    expect(root).toBeTruthy();

    const title = await page.$('[data-test-id="p05-page-header-title"]');
    expect(title).toBeTruthy();

    const search = await page.$('[data-test-id="p05-page-header-search"]');
    expect(search).toBeTruthy();

    const chips = await page.$('[data-test-id="p05-subject-chips"]');
    expect(chips).toBeTruthy();
  });

  it('mp.screenshot 截图落 artifact', async () => {
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
  });
});
