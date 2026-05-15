/**
 * SC01-MP-T13-E2E · P09 review-done page-vrt
 * trace: design/mockups/wrongbook/09_review_done.html
 * baseline: design/system/screenshots/mp-vrt-baseline/09_review_done.png
 *
 * Tests:
 * 1. navigateTo review-done → currentPage.path === 'pages/review-done/index'
 * 2. hero / memory-curve / stats DOM 存在 (page.$ selector)
 * 3. mp.screenshot 产出 actual PNG
 * 4. pixelmatch actual vs baseline diff < 5000 pixel
 *
 * 前置：cli auto --project <path> --auto-port 9420 已启
 * 跑：pnpm -F mp test:e2e:automator (Phase 2 TL 串行)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

/** Baseline PNG path (checked into repo by VRT infra commit 40ac7f7) */
const BASELINE_PNG = path.resolve(
  __dirname,
  '../../../../../design/system/screenshots/mp-vrt-baseline/09_review_done.png',
);

/** Actual screenshot output dir */
const ACTUAL_DIR = path.resolve(__dirname, '../__screenshots__');

/** pixelmatch threshold: diff must be < 5000 pixels to PASS */
const MAX_DIFF_PIXELS = 5000;

describe('SC01-MP-T13 · P09 review-done page-vrt (真 IDE)', () => {
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

  // ── Test 1: navigate + currentPage path ───────────────────────
  it('navigateTo review-done → currentPage.path 正确', async () => {
    await mp.navigateTo('/pages/review-done/index');
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/review-done/index');
  });

  // ── Test 2: key DOM selectors exist (page.$) ─────────────────
  it('hero / memory-curve / stats / cta DOM 元素已渲染', async () => {
    const page = await mp.currentPage();

    // hero celebration area
    const hero = await page.$('.hero');
    expect(hero).toBeTruthy();

    // memory curve card
    const memoryCurve = await page.$('.card');
    expect(memoryCurve).toBeTruthy();

    // stats row (3 stat blocks)
    const stats = await page.$('.stats');
    expect(stats).toBeTruthy();

    // CTA dock
    const cta = await page.$('.cta');
    expect(cta).toBeTruthy();
  });

  // ── Test 3: mp.screenshot produces an actual PNG ──────────────
  it('mp.screenshot 产出 actual PNG 文件', async () => {
    if (!fs.existsSync(ACTUAL_DIR)) {
      fs.mkdirSync(ACTUAL_DIR, { recursive: true });
    }
    const actualPath = path.join(ACTUAL_DIR, 'review-done-actual.png');

    await mp.screenshot({ path: actualPath });

    expect(fs.existsSync(actualPath)).toBe(true);
    const stat = fs.statSync(actualPath);
    expect(stat.size).toBeGreaterThan(1024); // at least 1 KB = real image
  });

  // ── Test 4: pixelmatch VRT — actual vs baseline < 5000 diff ──
  it(`pixelmatch diff < ${MAX_DIFF_PIXELS} pixels vs baseline`, async () => {
    const actualPath = path.join(ACTUAL_DIR, 'review-done-actual.png');

    // Read baseline
    expect(fs.existsSync(BASELINE_PNG)).toBe(true);
    const baselineData = PNG.sync.read(fs.readFileSync(BASELINE_PNG));

    // Read actual (produced by previous test)
    expect(fs.existsSync(actualPath)).toBe(true);
    const actualData = PNG.sync.read(fs.readFileSync(actualPath));

    // Resize to common dimensions (baseline is source of truth)
    const width = baselineData.width;
    const height = baselineData.height;

    // If dimensions differ, create a resized buffer (crop/pad actual to baseline size)
    let actualPixels = actualData.data;
    if (actualData.width !== width || actualData.height !== height) {
      // Create a blank buffer at baseline dimensions, copy overlapping region
      const resized = new Uint8Array(width * height * 4);
      const copyW = Math.min(actualData.width, width);
      const copyH = Math.min(actualData.height, height);
      for (let y = 0; y < copyH; y++) {
        const srcOffset = y * actualData.width * 4;
        const dstOffset = y * width * 4;
        resized.set(actualData.data.subarray(srcOffset, srcOffset + copyW * 4), dstOffset);
      }
      actualPixels = Buffer.from(resized);
    }

    // Diff
    const diff = new PNG({ width, height });
    const numDiffPixels = pixelmatch(
      actualPixels,
      baselineData.data,
      diff.data,
      width,
      height,
      { threshold: 0.15 },
    );

    // Save diff image for debugging
    const diffPath = path.join(ACTUAL_DIR, 'review-done-diff.png');
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    expect(numDiffPixels).toBeLessThan(MAX_DIFF_PIXELS);
  });
});
