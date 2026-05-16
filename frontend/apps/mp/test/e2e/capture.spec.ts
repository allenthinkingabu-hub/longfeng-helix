/**
 * SC01-MP-T01-E2E · P02 capture page-load + testid + console-clean
 *
 * Phase 4 (Fix-2 · 2026-05-16): 用 connectMp + assertConsoleClean + assertPageRenders
 *
 * trace: pages/capture/index
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean, assertPageRenders } from './_helpers';

describe('P02 capture page-load + testid (真 IDE)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
    await mp.reLaunch('/pages/capture/index');
    await new Promise((r) => setTimeout(r, 1000));
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'capture.spec');
  });

  it('currentPage path === pages/capture/index 且 view 数 ≥ 5', async () => {
    await assertPageRenders(mp, 'pages/capture/index', 5);
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
