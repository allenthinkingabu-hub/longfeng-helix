/**
 * P02 拍题页 · page-vrt E2E spec
 *
 * 真起微信工具 IDE automator · 验证 pages/capture/index 渲染 + VRT 像素对比
 *
 * 前置：
 *   1. 微信工具 IDE → 安全设置 → Service Port + Trust 全开
 *   2. `cli auto --project <path> --auto-port 9420` 已启动
 *
 * 跑：pnpm -F mp test:e2e:automator
 *
 * trace: SC01-MP-T01-E2E · design/mockups/wrongbook/02_capture.html
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

/** VRT baseline (design/system/screenshots/mp-vrt-baseline/02_capture.png) */
const BASELINE_PNG = path.resolve(
  __dirname,
  '../../../../../design/system/screenshots/mp-vrt-baseline/02_capture.png',
);

/** Actual screenshot output dir */
const RESULTS_DIR = path.resolve(__dirname, '../../test-results/e2e');

/** Max pixel diff threshold — PASS if diff < 5000 */
const MAX_DIFF_PIXELS = 5000;

describe('P02 capture page-vrt (真 IDE)', () => {
  let mp: Awaited<ReturnType<typeof automator.connect>>;

  beforeAll(async () => {
    // Ensure output directory exists
    fs.mkdirSync(RESULTS_DIR, { recursive: true });

    mp = await Promise.race([
      automator.connect({ wsEndpoint: WS_ENDPOINT }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`connect timeout: ${WS_ENDPOINT} not listening · 先跑 cli auto`)),
          8000,
        ),
      ),
    ]);

    // Navigate to capture page
    await mp.navigateTo('/pages/capture/index');
    // Brief settle for rendering
    await new Promise((r) => setTimeout(r, 1000));
  }, 15_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  it('currentPage().path === pages/capture/index', async () => {
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/capture/index');
  });

  it('capture 页 DOM 已渲染 (至少 1 个 view)', async () => {
    const page = await mp.currentPage();
    const anyView = await page.$('view');
    expect(anyView).toBeTruthy();
  });

  it('mp.screenshot 截图落 test-results/e2e/capture-actual.png', async () => {
    const outputPath = path.join(RESULTS_DIR, 'capture-actual.png');
    await mp.screenshot({ path: outputPath });
    expect(fs.existsSync(outputPath)).toBe(true);
    // Verify it's a valid PNG (non-zero size)
    const stat = fs.statSync(outputPath);
    expect(stat.size).toBeGreaterThan(0);
  });

  it('pixelmatch vs baseline < 5000 pixel diff', async () => {
    const actualPath = path.join(RESULTS_DIR, 'capture-actual.png');
    const diffPath = path.join(RESULTS_DIR, 'capture-diff.png');

    // Read baseline
    expect(fs.existsSync(BASELINE_PNG)).toBe(true);
    const baselineData = PNG.sync.read(fs.readFileSync(BASELINE_PNG));

    // Read actual (captured by previous test)
    expect(fs.existsSync(actualPath)).toBe(true);
    const actualData = PNG.sync.read(fs.readFileSync(actualPath));

    // Use baseline dimensions as reference
    const { width, height } = baselineData;

    // Create diff output
    const diff = new PNG({ width, height });

    const numDiffPixels = pixelmatch(
      baselineData.data,
      actualData.data,
      diff.data,
      width,
      height,
      { threshold: 0.1 },
    );

    // Write diff image for debugging
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    expect(numDiffPixels).toBeLessThan(MAX_DIFF_PIXELS);
  });
});
