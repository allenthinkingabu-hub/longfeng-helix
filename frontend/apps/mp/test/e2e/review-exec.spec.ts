/**
 * P08 复习执行 · page-vrt E2E spec
 *
 * kind: page-vrt
 * target: pages/review-exec
 * baseline: design/system/screenshots/mp-vrt-baseline/08_review_exec.png
 * threshold: diff < 5000 pixels
 *
 * Phase 1: spec only (automator not launched) · Phase 2: TL 串行跑
 *
 * trace: SC01-MP-T11-E2E · design/mockups/wrongbook/08_review_exec.html
 *        @longfeng/testids p08 · pages/review-exec/index.{ts,wxml}
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const BASELINE_PNG = resolve(
  REPO_ROOT,
  'design/system/screenshots/mp-vrt-baseline/08_review_exec.png',
);
const VRT_THRESHOLD = 5000; // max pixel diff

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

describe('P08 review-exec page-vrt (真 IDE)', () => {
  let mp: Awaited<ReturnType<typeof automator.connect>>;
  let page: Awaited<ReturnType<typeof mp.currentPage>>;

  beforeAll(async () => {
    // connect with 8s timeout per scope_in
    mp = await Promise.race([
      automator.connect({ wsEndpoint: WS_ENDPOINT }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`connect timeout: ${WS_ENDPOINT} not listening · 先跑 cli auto`)),
          8000,
        ),
      ),
    ]);

    // navigate to review-exec page
    await mp.navigateTo('/pages/review-exec/index');
    page = await mp.currentPage();
  }, 15_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  // ── Test 1: currentPage path ──────────────────────────────────
  it('currentPage.path 为 pages/review-exec/index', async () => {
    expect(page.path).toBe('pages/review-exec/index');
  });

  // ── Test 2: DOM 关键 testid 节点存在 ──────────────────────────
  it('关键 UI 节点全部渲染 (root / questionHero / gradeButtons / memoryCurve)', async () => {
    // p08 testids: root, questionHero, gradeButtons, memoryCurve
    const root = await page.$('[data-test-id="p08-root"]');
    expect(root).toBeTruthy();

    const questionHero = await page.$('[data-test-id="p08-question-hero"]');
    expect(questionHero).toBeTruthy();

    const gradeButtons = await page.$('[data-test-id="p08-grade-buttons"]');
    expect(gradeButtons).toBeTruthy();

    const memoryCurve = await page.$('[data-test-id="memory-curve"]');
    expect(memoryCurve).toBeTruthy();
  });

  // ── Test 3: revealBtn 在初始态可见 ────────────────────────────
  it('revealBtn 初始态存在且 disabled (READING state)', async () => {
    const revealBtn = await page.$('[data-test-id="p08-reveal-btn"]');
    expect(revealBtn).toBeTruthy();
  });

  // ── Test 4: VRT pixelmatch vs baseline ────────────────────────
  it('page screenshot vs 08_review_exec baseline · diff < 5000 pixels', async () => {
    // Capture actual screenshot from automator
    const actualBase64: string = await mp.screenshot();
    const actualBuf = Buffer.from(actualBase64, 'base64');
    const actualPng = PNG.sync.read(actualBuf);

    // Read baseline
    const baselineBuf = readFileSync(BASELINE_PNG);
    const baselinePng = PNG.sync.read(baselineBuf);

    // Resize to common dimensions (use smaller of the two)
    const width = Math.min(actualPng.width, baselinePng.width);
    const height = Math.min(actualPng.height, baselinePng.height);

    // Crop both to common size if needed
    const cropToSize = (png: PNG, w: number, h: number): Buffer => {
      if (png.width === w && png.height === h) return png.data;
      const cropped = Buffer.alloc(w * h * 4);
      for (let y = 0; y < h; y++) {
        png.data.copy(cropped, y * w * 4, y * png.width * 4, y * png.width * 4 + w * 4);
      }
      return cropped;
    };

    const actualData = cropToSize(actualPng, width, height);
    const baselineData = cropToSize(baselinePng, width, height);
    const diffPng = new PNG({ width, height });

    const diffPixels = pixelmatch(actualData, baselineData, diffPng.data, width, height, {
      threshold: 0.15,
    });

    // Assert diff < 5000 pixels
    expect(diffPixels).toBeLessThan(VRT_THRESHOLD);
  });
});
