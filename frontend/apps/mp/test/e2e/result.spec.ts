/**
 * P04 AI分析结果页 · page-vrt E2E spec
 *
 * 业务: SC01 错题本 → 拍题后 AI 分析 → P04 展示分析结果(题目/答案/错因/步骤/知识点/艾宾浩斯)
 * 设计真相: design/mockups/wrongbook/04_result.html
 * 基线截图: design/system/screenshots/mp-vrt-baseline/04_result.png
 *
 * Phase 1: 写 spec + lint + tsc + test:unit · Phase 2 TL 串行跑 automator
 *
 * trace: SC01-MP-T05-E2E · pages/result/index.{ts,wxml}
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';
const BASELINE_PATH = resolve(__dirname, '../../../../design/system/screenshots/mp-vrt-baseline/04_result.png');
const DIFF_THRESHOLD = 5000; // max diff pixels for VRT pass

describe('P04 result page-vrt (真 IDE)', () => {
  let mp: Awaited<ReturnType<typeof automator.connect>>;
  let page: Awaited<ReturnType<typeof mp.currentPage>>;

  beforeAll(async () => {
    mp = await Promise.race([
      automator.connect({ wsEndpoint: WS_ENDPOINT }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`connect timeout: ${WS_ENDPOINT} not listening · 先跑 cli auto`)), 8000),
      ),
    ]);
    // Navigate to result page with a test qid
    await mp.navigateTo('/pages/result/index?qid=test-vrt-001');
    page = await mp.currentPage();
  }, 15_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  it('currentPage.path 为 pages/result/index', async () => {
    expect(page.path).toBe('pages/result/index');
  });

  it('页面 DOM 包含 p04-root view 且已渲染', async () => {
    const root = await page.$('[data-test-id="p04-root"]');
    expect(root).toBeTruthy();
  });

  it('mp.screenshot 返回有效 base64 截图', async () => {
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
    // screenshot is a base64 string of the PNG
    expect(typeof screenshot).toBe('string');
    expect(screenshot.length).toBeGreaterThan(100);
  });

  it(`pixelmatch vs 04_result.png baseline diff < ${DIFF_THRESHOLD} pixels`, async () => {
    // Capture actual screenshot
    const screenshotB64 = await mp.screenshot();
    const actualBuf = Buffer.from(screenshotB64, 'base64');
    const actualPng = PNG.sync.read(actualBuf);

    // Read baseline
    const baselineBuf = readFileSync(BASELINE_PATH);
    const baselinePng = PNG.sync.read(baselineBuf);

    // Resize to match if needed — use the smaller dimensions
    const width = Math.min(actualPng.width, baselinePng.width);
    const height = Math.min(actualPng.height, baselinePng.height);

    const diffPng = new PNG({ width, height });

    const numDiffPixels = pixelmatch(
      actualPng.data,
      baselinePng.data,
      diffPng.data,
      width,
      height,
      { threshold: 0.15 },
    );

    expect(numDiffPixels).toBeLessThan(DIFF_THRESHOLD);
  });
});
