/**
 * SC01-MP-T04-E2E · P03 analyzing → P04 result transition + console-clean
 *
 * Phase 4 (Fix-2 · 2026-05-16): 用 connectMp + assertConsoleClean
 *
 * 业务剧本: P03 AI 分析轮询 SUCCEEDED → navigateTo P04 result
 * Phase 3 不依赖真后端 · reLaunch 模拟转场
 *
 * trace: pages/analyzing → pages/result
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean } from './_helpers';

describe('P03→P04 transition: analyzing → result (真 IDE)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'analyzing-to-result.spec');
  });

  it('reLaunch to analyzing page with demo taskId', async () => {
    await mp.reLaunch('/pages/analyzing/index?qid=test-qid-e2e');
    await new Promise((r) => setTimeout(r, 800));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/analyzing/index');
  });

  it('analyzing page renders pipeline DOM (testid)', async () => {
    const page = await mp.currentPage();
    const pipeline = await page.$('[data-test-id="analyzing-pipeline"]');
    expect(pipeline).toBeTruthy();
  });

  it('reLaunch to result page (模拟转场 · Phase 3 不依赖后端轮询)', async () => {
    await mp.reLaunch('/pages/result/index?qid=test-qid-e2e');
    await new Promise((r) => setTimeout(r, 800));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/result/index');
  });

  it('result page renders p04-root (testid)', async () => {
    const page = await mp.currentPage();
    const root = await page.$('[data-test-id="p04-root"]');
    expect(root).toBeTruthy();
  });
});
