/**
 * SC01-MP-T08-E2E · Home page E2E + VRT (page-vrt kind)
 *
 * 业务剧本: 用户打开小程序 → 落地 pages/home/index → 看到今日聚合首页
 * 设计真相: design/mockups/wrongbook/01_home_ios_refined.html
 * baseline:  design/system/screenshots/mp-vrt-baseline/01_home_ios_refined.png
 *
 * 前置:
 *   1. 微信工具 IDE 设置 → 安全设置 → Service Port + Allow Getting Ticket + Trust 全开
 *   2. `cli auto --project <path> --auto-port 9420` 已启 (有 9420 在 LISTEN)
 *
 * 跑: pnpm -F mp test:e2e:automator
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';
const BASELINE_PATH = resolve(
  __dirname,
  '../../../../design/system/screenshots/mp-vrt-baseline/01_home_ios_refined.png',
);
const VRT_THRESHOLD = 5000; // max diff pixels allowed

describe('Home page E2E + VRT (SC01-MP-T08-E2E)', () => {
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

  // ── Test 1: currentPage 是 home ──────────────────────────────
  it('currentPage path is pages/home/index', async () => {
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/home/index');
  });

  // ── Test 2: DOM 关键节点已渲染 (data-test-id 挂载) ──────────
  it('home page renders key DOM nodes with testids', async () => {
    const page = await mp.currentPage();

    // root
    const root = await page.$('[data-test-id="p-home-root"]');
    expect(root).toBeTruthy();

    // greeting hero
    const greeting = await page.$('[data-test-id="greeting-hero"]');
    expect(greeting).toBeTruthy();

    // today review card
    const reviewCard = await page.$('[data-test-id="today-review-card"]');
    expect(reviewCard).toBeTruthy();

    // start all button
    const startBtn = await page.$('[data-test-id="today-review-card-start-all-btn"]');
    expect(startBtn).toBeTruthy();
  });

  // ── Test 3: 数据绑定验证 (todayTotal / circleProgress) ──────
  it('page data contains expected MVP values after load', async () => {
    const page = await mp.currentPage();
    const data = await page.data();

    // greeting should be a non-empty string
    expect(data.greeting).toBeTruthy();
    expect(typeof data.greeting).toBe('string');

    // studentName from MVP data
    expect(data.studentName).toBe('小 A');

    // streak + mastered from MVP defaults
    expect(data.streak).toBe(12);
    expect(data.mastered).toBe(142);

    // estMin (预计复习时间 · 用户可见 "预计 25 分钟")
    expect(data.estMin).toBe(25);

    // subjects array should have 3 items (数学/物理/英语)
    expect(data.subjects).toHaveLength(3);
    expect(data.subjects[0].name).toBe('数学');

    // weekStats (周统计卡片 MVP 数据)
    expect(data.weekStats).toEqual({ mastered: 23, newItems: 8, forgotten: 2, masteryRate: 68 });

    // weekDays should have 7 items
    expect(data.weekDays).toHaveLength(7);

    // messages should have 3 items
    expect(data.messages).toHaveLength(3);

    // quickEntries should have 4 items
    expect(data.quickEntries).toHaveLength(4);
  });

  // ── Test 4: VRT — pixelmatch vs baseline < 5000 diff pixels ──
  it('home screenshot vs baseline diff < 5000 pixels', async () => {
    // Take actual screenshot (returns Buffer) — uses mp-level API, not page
    const actualBuf: Buffer = await mp.screenshot();

    // Parse actual PNG
    const actual = PNG.sync.read(actualBuf);

    // Read baseline PNG
    const baselineBuf = readFileSync(BASELINE_PATH);
    const baseline = PNG.sync.read(baselineBuf);

    // Resize comparison to smaller of the two dimensions
    const width = Math.min(actual.width, baseline.width);
    const height = Math.min(actual.height, baseline.height);

    // Create diff output
    const diff = new PNG({ width, height });

    // Crop both images to common size for comparison
    const cropToSize = (img: PNG, w: number, h: number): Buffer => {
      const cropped = Buffer.alloc(w * h * 4);
      for (let y = 0; y < h; y++) {
        const srcOffset = y * img.width * 4;
        const dstOffset = y * w * 4;
        img.data.copy(cropped, dstOffset, srcOffset, srcOffset + w * 4);
      }
      return cropped;
    };

    const actualData = cropToSize(actual, width, height);
    const baselineData = cropToSize(baseline, width, height);

    const diffPixels = pixelmatch(actualData, baselineData, diff.data, width, height, {
      threshold: 0.15,
    });

    // Assert diff is within threshold
    expect(diffPixels).toBeLessThan(VRT_THRESHOLD);
  });
});
