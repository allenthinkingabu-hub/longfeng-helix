/**
 * SC01-MP-T04-E2E · transition P03 analyzing → P04 result
 *
 * Phase 3: use mp.reLaunch · drop pixelmatch · testid assert
 *
 * 业务剧本: P03 AI 分析轮询 SUCCEEDED → navigateTo P04 result
 * Phase 3 不依赖真后端 · reLaunch 模拟转场
 *
 * trace: pages/analyzing → pages/result
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

describe('P03→P04 transition: analyzing → result (真 IDE)', () => {
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

  it('reLaunch to analyzing page with demo taskId', async () => {
    await mp.reLaunch({ url: '/pages/analyzing/index?qid=test-qid-e2e' });
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
    await mp.reLaunch({ url: '/pages/result/index?qid=test-qid-e2e' });
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
