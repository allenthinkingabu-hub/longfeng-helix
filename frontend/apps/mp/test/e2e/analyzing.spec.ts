/**
 * E2E + VRT · P03 Analyzing page (pages/analyzing)
 *
 * Tests:
 *   1. reLaunch → pages/analyzing/index?taskId=demo → assert currentPage.path
 *   2. page.$('view') truthy (DOM rendered)
 *   3. mp.screenshot → test-results/e2e/analyzing-actual.png
 *   4. pixelmatch vs baseline 03_analyzing.png → diff < 5000
 *
 * Phase 1: spec only (automator not launched) · Phase 2: TL runs
 *
 * trace: SC01-MP-T03-E2E · PHASE-C MP E2E + VRT
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';
import { readFileSync } from 'node:fs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { PNG } from 'pngjs';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

/** Resolve path relative to mp package root */
const mpRoot = resolve(__dirname, '../..');
const BASELINE_PNG = resolve(mpRoot, '../../..', 'design/system/screenshots/mp-vrt-baseline/03_analyzing.png');
const ACTUAL_DIR = resolve(mpRoot, 'test-results/e2e');
const ACTUAL_PNG = resolve(ACTUAL_DIR, 'analyzing-actual.png');
const DIFF_PNG = resolve(ACTUAL_DIR, 'analyzing-diff.png');

describe('P03 Analyzing page · E2E + VRT', () => {
  let mp: Awaited<ReturnType<typeof automator.connect>>;

  beforeAll(async () => {
    mp = await Promise.race([
      automator.connect({ wsEndpoint: WS_ENDPOINT }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`connect timeout: ${WS_ENDPOINT} not listening · 先跑 cli auto`)), 8000),
      ),
    ]);
  }, 15_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  it('reLaunch → pages/analyzing/index?taskId=demo · currentPage.path correct', async () => {
    await mp.reLaunch({ url: '/pages/analyzing/index?taskId=demo' });
    // Allow page to settle
    await new Promise((r) => setTimeout(r, 800));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/analyzing/index');
  });

  it('page DOM has rendered (at least 1 view)', async () => {
    const page = await mp.currentPage();
    const anyView = await page.$('view');
    expect(anyView).toBeTruthy();
  });

  it('mp.screenshot captures analyzing page', async () => {
    mkdirSync(ACTUAL_DIR, { recursive: true });
    await mp.screenshot({ path: ACTUAL_PNG });
    // Verify the file was written and is a valid PNG (starts with PNG signature)
    const buf = readFileSync(ACTUAL_PNG);
    expect(buf.length).toBeGreaterThan(100);
    // PNG magic bytes: 0x89 P N G
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
  });

  it('VRT: pixelmatch diff vs baseline < 5000 pixels', async () => {
    // Dynamic import for ESM-only pixelmatch v7
    const { default: pixelmatch } = await import('pixelmatch');

    const baselineBuf = readFileSync(BASELINE_PNG);
    const actualBuf = readFileSync(ACTUAL_PNG);

    const baselinePng = PNG.sync.read(baselineBuf);
    const actualPng = PNG.sync.read(actualBuf);

    // Resize to match if dimensions differ (use smaller as reference)
    const width = Math.min(baselinePng.width, actualPng.width);
    const height = Math.min(baselinePng.height, actualPng.height);

    const diffPng = new PNG({ width, height });

    const diffPixels = pixelmatch(
      baselinePng.data,
      actualPng.data,
      diffPng.data,
      width,
      height,
      { threshold: 0.15 },
    );

    // Write diff image for visual inspection
    writeFileSync(DIFF_PNG, PNG.sync.write(diffPng));

    expect(diffPixels).toBeLessThan(5000);
  });
});
