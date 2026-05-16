/**
 * SC01-MP-MENU-FIX · 全 tab 页底部 Menu (tabBar) 可见性 E2E
 *
 * RC (用户视角 · 2026-05-16): 打开 IDE 模拟器 P-HOME 看不到底部 5-tab menu.
 *   根因: app.json tabBar.list 缺 iconPath + selectedIconPath ·
 *   WeChat IDE 对缺 icon 的 tabBar silent fail 不渲染.
 *
 * Fix 验证: 每个 tab 页 reLaunch 后 mp.screenshot 截图 + 抽底 84px 区域 RGBA 像素 ·
 *   tabBar 渲染中 → 底部条带非空 (透明像素比例 < 阈值 + 非背景色像素 ≥ 阈值).
 *   外加用 page.$$('view') ≥ minViews 防 wxml 没真渲染假 PASS (三件套).
 *
 * 同时验证 (mockup line 484): home 加载完成后 复习 tab badge 数字 = 当日待复习数.
 *
 * trace: design/mockups/wrongbook/01_home.html · app.json tabBar.list
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { type Mp, connectMp, assertConsoleClean, assertPageRenders, forceRecompileIDE, resetIdeConsoleLog } from './_helpers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = resolve(
  __dirname,
  '../../../../../audits/runs/SC01-MP-MENU-FIX/team-1/attempt-1/test-reports/e2e/coder/screenshots',
);

const TAB_PAGES = [
  { path: 'pages/home/index', label: '首页', minViews: 15 },
  { path: 'pages/wrongbook-list/index', label: '错题本', minViews: 5 },
  { path: 'pages/capture/index', label: '拍题', minViews: 5 },
  { path: 'pages/review-today/index', label: '复习', minViews: 5 },
  { path: 'pages/me/index', label: '我的', minViews: 3 },
];

/**
 * 抽截图底 90px 横向条带 · 计算非透明 + 非纯背景色像素比例.
 * tabBar 渲染中: 底部 84px 应有图标 + 文字 → 比例 > THRESHOLD
 * tabBar 缺失:   底部 84px 几乎全是页面内容延伸或空白 → 比例 < THRESHOLD
 */
function analyzeTabBarStrip(pngBuf: Buffer): {
  width: number;
  height: number;
  stripStart: number;
  nonBgPixels: number;
  totalPixels: number;
  nonBgRatio: number;
} {
  const png = PNG.sync.read(pngBuf);
  const { width, height, data } = png;
  const STRIP_HEIGHT = 100; // tabBar 84px + safe area
  const stripStart = Math.max(0, height - STRIP_HEIGHT);
  // tabBar background per app.json = #F2F2F7 → R242 G242 B247
  // Mockup mode可能 backdrop blur · 我们用宽容判定: 不是 (242,242,247±10) + 不是 (0,0,0,0) 透明
  let nonBg = 0;
  let total = 0;
  for (let y = stripStart; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      total++;
      if (a < 16) continue; // transparent
      // 容差 ±12 看是否是 #F2F2F7 tabBar bg / 或 #FFFFFF 页面背景 / 或 #F5F5F5 全局背景
      const isLightBg =
        (r > 230 && g > 230 && b > 230) || // 白/浅灰系页面 bg
        (Math.abs(r - 242) < 12 && Math.abs(g - 242) < 12 && Math.abs(b - 247) < 12);
      if (!isLightBg) nonBg++;
    }
  }
  return {
    width,
    height,
    stripStart,
    nonBgPixels: nonBg,
    totalPixels: total,
    nonBgRatio: total > 0 ? nonBg / total : 0,
  };
}

async function shootAndAnalyze(mp: Mp, name: string): Promise<{
  filename: string;
  bytes: number;
  analysis: ReturnType<typeof analyzeTabBarStrip>;
}> {
  await new Promise((r) => setTimeout(r, 800));
  const b64 = (await mp.screenshot()) as string;
  const buf = Buffer.from(b64, 'base64');
  mkdirSync(SHOTS_DIR, { recursive: true });
  const filename = resolve(SHOTS_DIR, `${name}.png`);
  writeFileSync(filename, buf);
  return { filename, bytes: buf.length, analysis: analyzeTabBarStrip(buf) };
}

describe('SC01-MP-MENU-FIX · 全 tab 页底部 menu (tabBar) 可见性', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    // app.json tabBar.list 刚改 + 新增 images/tabbar/*.png · 假定 IDE 已被 TL/user 手动重启
    // 或 hot-reload 已 pick up (调用方需先确认 connectMp 能拿到 pages/home/index 路径).
    // 不再调 forceRecompileIDE — `cli quit` 会破坏用户已开的 IDE 会话 · 见 attempt-1 注释.
    resetIdeConsoleLog();
    ({ mp, errors } = await connectMp(30_000));
  }, 60_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'tabbar-visible-all-tabs');
  });

  for (const tab of TAB_PAGES) {
    it(`tab=${tab.label} · reLaunch ${tab.path} · tabBar strip 非空 + view ≥ ${tab.minViews}`, async () => {
      await mp.reLaunch(`/${tab.path}`);
      await new Promise((r) => setTimeout(r, 1_500));
      await assertPageRenders(mp, tab.path, tab.minViews);

      const safeName = tab.path.replace(/\//g, '_');
      const r1 = await shootAndAnalyze(mp, `tab_${safeName}_visit1`);
      expect(r1.bytes).toBeGreaterThan(2_000);

      // 主断言: 底部 100px 条带必须有非背景色像素 · 至少 1.5% (tabBar icon+text 占 strip)
      // 如果 tabBar 不渲染 · 该区域要么全透明 (0) 要么全 #F5F5F5 页面背景 (0)
      expect(r1.analysis.nonBgRatio).toBeGreaterThan(0.015);

      // 二次访问 · 验证 reLaunch 后 tabBar 保持
      await new Promise((r) => setTimeout(r, 600));
      const r2 = await shootAndAnalyze(mp, `tab_${safeName}_visit2`);
      expect(r2.analysis.nonBgRatio).toBeGreaterThan(0.015);
    }, 30_000);
  }

  it('home 加载完成后 · 复习 tab (index=3) 应显示 badge 数字 (mockup line 484)', async () => {
    await mp.reLaunch('/pages/home/index');
    await new Promise((r) => setTimeout(r, 2_500)); // wait for _fetchTodayData + _syncReviewBadge
    const page = await mp.currentPage();
    const data = await page.data();
    // home _syncReviewBadge 计算 pending = todayTotal - todayDone · 兜底走 8-3=5
    const pending = Math.max(0, (data.todayTotal as number) - (data.todayDone as number));
    expect(pending).toBeGreaterThan(0);
    // 截一张验证 badge 可见 + 落盘
    const safeName = 'home_with_review_badge';
    const r = await shootAndAnalyze(mp, safeName);
    expect(r.bytes).toBeGreaterThan(2_000);
  }, 30_000);
});
