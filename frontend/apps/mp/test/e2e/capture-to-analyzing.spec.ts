/**
 * E2E transition: capture → analyzing
 *
 * Phase 3: use mp.reLaunch for both start + target · drop pixelmatch
 *
 * 业务剧本: 用户在 P02 拍题页 tap 快门 → 系统上传 → navigateTo P03 analyzing
 * Phase 3 不依赖真后端 · reLaunch 模拟转场 · 验 currentPage.path + query
 *
 * trace: SC01-MP-T02-E2E · pages/capture → pages/analyzing
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

describe('capture → analyzing transition (真 IDE)', () => {
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

  it('reLaunch 到 capture 页 · currentPage.path === pages/capture/index', async () => {
    await mp.reLaunch('/pages/capture/index');
    await new Promise((r) => setTimeout(r, 500));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/capture/index');
  });

  it('reLaunch 到 analyzing · 携带 query 参数', async () => {
    const mockImageUrl = encodeURIComponent('https://example.com/test.jpg');
    const mockSubject = 'math';
    const mockQid = '42';
    await mp.reLaunch(`/pages/analyzing/index?imageUrl=${mockImageUrl}&subject=${mockSubject}&qid=${mockQid}`);
    await new Promise((r) => setTimeout(r, 500));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/analyzing/index');
  });

  it('analyzing 页接收到全部 query 参数 (imageUrl + subject + qid)', async () => {
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/analyzing/index');
    const query = page.query || {};
    expect(query).toHaveProperty('imageUrl');
    expect(query.imageUrl).toBeTruthy();
    expect(query).toHaveProperty('subject', 'math');
    expect(query).toHaveProperty('qid', '42');
  });
});
