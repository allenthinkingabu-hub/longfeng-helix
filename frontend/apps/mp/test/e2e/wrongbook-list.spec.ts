/**
 * E2E · P05 错题本列表 (page-vrt) · wrongbook-list
 *
 * 业务剧本 (source of truth):
 *   用户进入错题本列表页 → 看到导航栏 "错题本" + 学科筛选 chips + 掌握度筛选 + 错题卡片列表
 *   mockup: design/mockups/wrongbook/05_wrongbook_list.html
 *   baseline: design/system/screenshots/mp-vrt-baseline/05_wrongbook_list.png
 *
 * Phase 1: 写 spec 不跑 automator (Phase 2 TL 串行跑)
 *
 * trace: SC01-MP-T07-E2E · page-vrt kind
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

/** VRT threshold: diff pixel count must be < 5000 */
const VRT_MAX_DIFF_PIXELS = 5000;

const BASELINE_PATH = resolve(
  __dirname,
  '../../../../design/system/screenshots/mp-vrt-baseline/05_wrongbook_list.png',
);

/** Output dir for VRT artifacts (actual / diff screenshots) */
const VRT_OUT_DIR = resolve(__dirname, '../../test-reports/e2e/screenshots');

describe('P05 wrongbook-list (page-vrt)', () => {
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

  // ── Test 1: navigate to wrongbook-list page ──────────────────
  it('navigateTo pages/wrongbook-list/index 成功', async () => {
    await mp.navigateTo('/pages/wrongbook-list/index');
    // wait for page render
    await new Promise((r) => setTimeout(r, 1500));
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/wrongbook-list/index');
  });

  // ── Test 2: page DOM has key elements ────────────────────────
  it('页面 DOM 包含导航栏 + 内容区域关键节点', async () => {
    const page = await mp.currentPage();

    // nav title
    const navH1 = await page.$('.nav-h1');
    expect(navH1).toBeTruthy();

    // search bar
    const search = await page.$('.search');
    expect(search).toBeTruthy();

    // subject chips row
    const chipsRow = await page.$('.chips-row');
    expect(chipsRow).toBeTruthy();

    // content scroll area
    const content = await page.$('.content');
    expect(content).toBeTruthy();
  });

  // ── Test 3: screenshot capture ───────────────────────────────
  it('mp.screenshot 成功截取当前页面', async () => {
    const page = await mp.currentPage();
    // ensure we're still on wrongbook-list
    expect(page.path).toBe('pages/wrongbook-list/index');

    const base64 = await mp.screenshot();
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(100);

    // save actual screenshot for VRT
    mkdirSync(VRT_OUT_DIR, { recursive: true });
    const actualPath = resolve(VRT_OUT_DIR, '05_wrongbook_list-actual.png');
    writeFileSync(actualPath, Buffer.from(base64, 'base64'));
  });

  // ── Test 4: VRT pixelmatch vs baseline < 5000 diff pixels ───
  it(`VRT: pixelmatch diff < ${VRT_MAX_DIFF_PIXELS} pixels vs baseline`, async () => {
    // capture fresh screenshot
    const base64 = await mp.screenshot();
    const actualBuf = Buffer.from(base64, 'base64');

    // decode actual
    const actualPng = PNG.sync.read(actualBuf);

    // decode baseline
    const baselineBuf = readFileSync(BASELINE_PATH);
    const baselinePng = PNG.sync.read(baselineBuf);

    // resize to common dimensions (use baseline as reference)
    const width = baselinePng.width;
    const height = baselinePng.height;

    // If actual is a different size, we still run pixelmatch on the overlapping area
    // In practice automator screenshots may differ in size from Chromium-rendered baselines
    const compareWidth = Math.min(width, actualPng.width);
    const compareHeight = Math.min(height, actualPng.height);

    // Create cropped buffers for comparison
    const cropData = (png: PNG, w: number, h: number): Buffer => {
      const out = Buffer.alloc(w * h * 4);
      for (let y = 0; y < h; y++) {
        png.data.copy(out, y * w * 4, y * png.width * 4, y * png.width * 4 + w * 4);
      }
      return out;
    };

    const baseData = cropData(baselinePng, compareWidth, compareHeight);
    const actData = cropData(actualPng, compareWidth, compareHeight);

    const diffPng = new PNG({ width: compareWidth, height: compareHeight });

    const diffPixels = pixelmatch(
      new Uint8Array(baseData),
      new Uint8Array(actData),
      new Uint8Array(diffPng.data),
      compareWidth,
      compareHeight,
      { threshold: 0.15 },
    );

    // Save diff image
    mkdirSync(VRT_OUT_DIR, { recursive: true });
    const diffPath = resolve(VRT_OUT_DIR, '05_wrongbook_list-diff.png');
    writeFileSync(diffPath, PNG.sync.write(diffPng));

    console.log(
      `[VRT] 05_wrongbook_list · diffPixels=${diffPixels} / threshold=${VRT_MAX_DIFF_PIXELS} · compare=${compareWidth}x${compareHeight}`,
    );

    expect(diffPixels).toBeLessThan(VRT_MAX_DIFF_PIXELS);
  });
});
