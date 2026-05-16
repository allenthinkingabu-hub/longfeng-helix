/**
 * SC01-MP-T02-E2E · capture → analyzing transition + console-clean
 *
 * Phase 4 (Fix-2 · 2026-05-16): 用 connectMp + assertConsoleClean
 *
 * 业务剧本: 用户在 P02 拍题页 tap 快门 → 系统上传 → navigateTo P03 analyzing
 * Phase 3 不依赖真后端 · reLaunch 模拟转场 · 验 currentPage.path + query
 *
 * trace: pages/capture → pages/analyzing
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean } from './_helpers';

describe('capture → analyzing transition (真 IDE)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'capture-to-analyzing.spec');
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
