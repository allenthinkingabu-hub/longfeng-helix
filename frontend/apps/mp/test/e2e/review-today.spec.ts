/**
 * SC01-MP-T09-E2E · P07 今日复习 · page-vrt E2E spec
 *
 * Phase 1: 写 spec + lint + tsc + test:unit (不跑 automator)
 * Phase 2: TL 串行跑 automator
 *
 * 4 tests:
 *   1. connect to automator (8s timeout) + systemInfo sanity
 *   2. navigateTo review-today + verify currentPage.path
 *   3. hero card DOM 渲染 (page.$ data-test-id)
 *   4. pixelmatch VRT vs 07_review_today.png baseline (diff < 5000)
 *
 * trace: design/mockups/wrongbook/07_review_today.html
 * baseline: design/system/screenshots/mp-vrt-baseline/07_review_today.png
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_IDS } from '@longfeng/testids';

const __dirname = dirname(fileURLToPath(import.meta.url));

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

/** Repo root (mp package is at frontend/apps/mp/) */
const REPO_ROOT = resolve(__dirname, '../../../../..');

/** Baseline PNG captured from design mockup via capture-mockup-baselines.mjs */
const BASELINE_PATH = resolve(
  REPO_ROOT,
  'design/system/screenshots/mp-vrt-baseline/07_review_today.png',
);

/** Max pixel diff threshold for VRT pass */
const MAX_DIFF_PIXELS = 5000;

describe('P07 review-today · page-vrt (真 IDE automator)', () => {
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

  // ── Test 1: connect sanity ──────────────────────────────────────
  it('connect + systemInfo returns devtools platform', async () => {
    const sys = await mp.systemInfo();
    expect(sys.platform).toBe('devtools');
    expect(sys.SDKVersion).toMatch(/^\d+\.\d+/);
  });

  // ── Test 2: navigateTo review-today + path check ────────────────
  it('navigateTo pages/review-today/index · currentPage path matches', async () => {
    await mp.navigateTo('/pages/review-today/index');
    // wait for page onLoad + setData
    await new Promise((r) => setTimeout(r, 1500));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/review-today/index');
  });

  // ── Test 3: hero card DOM rendered ──────────────────────────────
  it('hero card (data-test-id=today-review-card) is rendered', async () => {
    const page = await mp.currentPage();
    // page.$ uses CSS selector on the WXML shadow DOM
    const hero = await page.$(`[data-test-id="${TEST_IDS.p07.todayReviewCard}"]`);
    expect(hero).toBeTruthy();

    // Verify nav title text
    const navTitle = await page.$('.nav-title');
    expect(navTitle).toBeTruthy();
  });

  // ── Test 4: pixelmatch VRT vs baseline ──────────────────────────
  it('screenshot pixelmatch diff < 5000 vs 07_review_today.png baseline', async () => {
    // Take actual screenshot from the running miniprogram
    const screenshotBase64: string = await mp.screenshot();
    const actualBuf = Buffer.from(screenshotBase64, 'base64');
    const actualPng = PNG.sync.read(actualBuf);

    // Read baseline
    const baselineBuf = readFileSync(BASELINE_PATH);
    const baselinePng = PNG.sync.read(baselineBuf);

    // Resize to match: use the smaller dimensions
    const width = Math.min(actualPng.width, baselinePng.width);
    const height = Math.min(actualPng.height, baselinePng.height);

    // Crop both images to common dimensions if needed
    const cropPng = (src: PNG, w: number, h: number): Buffer => {
      if (src.width === w && src.height === h) return src.data;
      const out = Buffer.alloc(w * h * 4);
      for (let y = 0; y < h; y++) {
        src.data.copy(out, y * w * 4, y * src.width * 4, y * src.width * 4 + w * 4);
      }
      return out;
    };

    const actualData = cropPng(actualPng, width, height);
    const baselineData = cropPng(baselinePng, width, height);
    const diffPng = new PNG({ width, height });

    const diffPixels = pixelmatch(actualData, baselineData, diffPng.data, width, height, {
      threshold: 0.15,
    });

    console.log(
      `VRT diff: ${diffPixels} pixels (threshold: ${MAX_DIFF_PIXELS}) · ${width}x${height}`,
    );

    expect(diffPixels).toBeLessThan(MAX_DIFF_PIXELS);
  });
});
