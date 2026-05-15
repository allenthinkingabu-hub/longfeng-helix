/**
 * E2E transition: capture → analyzing
 *
 * 业务剧本 (source of truth · biz/000_业务与技术解决方案_登录注册_v1.md §capture):
 *   用户在 P02 拍题页 tap 快门 → 系统上传 + createQuestion → navigateTo P03 analyzing
 *   页面路径: pages/capture/index → pages/analyzing/index?imageUrl=...&subject=...&qid=...
 *
 * 设计真相:
 *   02_capture.html — 快门 tap → handleCapture → presign → upload → createQuestion → wx.navigateTo
 *   03_analyzing.html — 接收 imageUrl / subject / qid query params → 展示 AI 分析进度
 *
 * 代码真相 (pages/capture/index.ts:149-155):
 *   setTimeout(() => {
 *     wx.navigateTo({
 *       url: `/pages/analyzing/index?imageUrl=${imageUrl}&subject=${this.data.subject}&qid=${created.qid}`,
 *     });
 *   }, 300);
 *
 * 本 spec 验证 transition 能力:
 *   1. reLaunch 到 capture 页 → currentPage.path === 'pages/capture/index'
 *   2. 模拟 navigateTo analyzing (跳过真上传 · Phase 1 不依赖后端)
 *   3. 等 currentPage.path === 'pages/analyzing/index' 且 query 含预期参数
 *
 * trace: SC01-MP-T02-E2E · PHASE-C MP E2E transition · design/mockups/wrongbook/02_capture.html
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
        setTimeout(
          () => reject(new Error(`connect timeout: ${WS_ENDPOINT} not listening · 先跑 cli auto`)),
          8000,
        ),
      ),
    ]);
  }, 15_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  it('reLaunch 到 capture 页 · currentPage.path === pages/capture/index', async () => {
    await mp.reLaunch({ url: '/pages/capture/index' });
    // 等页面渲染稳定
    await new Promise((r) => setTimeout(r, 500));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/capture/index');
  });

  it('模拟 navigateTo analyzing · 携带 query 参数', async () => {
    // 模拟 capture 页 handleCapture 完成后的 navigateTo 调用
    // Phase 1 不依赖真后端 · 直接用 mp.navigateTo 模拟转场
    const mockImageUrl = encodeURIComponent('https://example.com/test.jpg');
    const mockSubject = 'math';
    const mockQid = '42';
    await mp.navigateTo({
      url: `/pages/analyzing/index?imageUrl=${mockImageUrl}&subject=${mockSubject}&qid=${mockQid}`,
    });
    // 等页面渲染稳定
    await new Promise((r) => setTimeout(r, 500));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/analyzing/index');
  });

  it('analyzing 页接收到 query 参数 (subject + qid)', async () => {
    // 当前页应仍是 analyzing (上一个 test navigateTo 后停留)
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/analyzing/index');
    // 验证页面 query 包含预期的 transition 参数
    // miniprogram-automator page.query 返回解析后的 query object
    const query = page.query || {};
    expect(query).toHaveProperty('subject', 'math');
    expect(query).toHaveProperty('qid', '42');
  });
});
