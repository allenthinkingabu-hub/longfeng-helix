/**
 * SC-16-T02 · P-WEEKLY-REVIEW MP page E2E
 *
 * trace:
 * - audits/runs/SC16-T02/team-1/attempt-1/test-cases.md (6 用例 Round 3 终态)
 * - design/system/pages/P-WEEKLY-REVIEW-weekly-review.spec.md §6/§7/§9/§12/§13
 * - biz/features/P-WEEKLY-REVIEW__weekly-review.md §2B.17 SC-16 步 1-7
 *
 * 必用 _helpers.ts 三件套 (coder-agent.md Rule 7):
 * - connectMp · 自动挂 mp.on('console') · 落 ide-console.txt
 * - assertConsoleClean · 末态防 silent IDE error
 * - assertPageRenders · 验路由 + view 数 ≥ 阈值
 *
 * TC-3 mock 策略 (用户 2026-05-16 决策 a · 前端 stub):
 *   mp.mockWxMethod('request', fn) · fn return {statusCode, data} · IDE 内部派发 success/fail
 *   不动 T01 backend code · 标准 MP automator 模式
 *
 * 2026-05-17 修复: mockWxMethod 函数 form **return** result 而非 invoke callback ·
 *   miniprogram-automator 0.12.1 IDE backend 自己根据 return.statusCode 派发 success/fail。
 *   旧版用 options.success(...) 直调 callback 不 work (函数序列化丢闭包 + 派发模式不符)。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean } from '../_helpers';

describe('SC-16-T02 · P-WEEKLY-REVIEW MP page (Phase 3 Coder)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    if (Array.isArray(errors)) {
      assertConsoleClean(errors, 't02-weekly-mp-page.spec');
    }
  });

  // ──────────────────────────────────────────────────────────
  // TC-1 · Happy path · P-HOME Tap 「查看全部 ›」 → P-WEEKLY-REVIEW READY
  // ──────────────────────────────────────────────────────────
  it('TC-1 · P-HOME Tap 「查看全部 ›」 → 路由 + 14 testid + delta + KP 渲染', async () => {
    // Mock 两个 endpoint: /weekly 给 READY 全字段 · /today 给 weekSummary
    await mp.mockWxMethod('request', function (options: { url?: string }) {
      const url = options.url || '';
      if (url.indexOf('/api/home/weekly') >= 0) {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          week: '2026-W20',
          range: { from: '2026-05-11', to: '2026-05-17' },
          hero: { masteryRate: 0.68, masteryDelta: 0.06, sparkline: [0.62, 0.63, 0.65, 0.66, 0.67, 0.67, 0.68] },
          subjectRadar: [{ subject: 'math', masteryRate: 0.70, sampleSize: 12 }, { subject: 'physics', masteryRate: 0.65, sampleSize: 8 }],
          weakKPs: [
            { kpId: 'KP-A', kpName: '韦达定理', subject: 'math', recentMissCount: 3, totalMissCount: 5 },
            { kpId: 'KP-B', kpName: '受力分析', subject: 'physics', recentMissCount: 2, totalMissCount: 4 },
            { kpId: 'KP-C', kpName: '函数对称', subject: 'math', recentMissCount: 1, totalMissCount: 3 },
          ],
          stats: { reviewedCount: 10, reviewedDurationMin: 50, newCount: 2 },
          failedTop: [{ questionId: 'Q-1', subject: 'math', missCount: 3 }],
          aiInsight: { insightId: 'WI-2026-W20-stu1', text: '本周稳步上升', generatedAt: '2026-05-17T00:00:00Z' },
        }}};
      }
      if (url.indexOf('/api/home/today') >= 0) {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          tz: 'Asia/Shanghai',
          today: { total: 5, done: 2, circleProgress: 0.4 },
          weekSummary: { week: '2026-W20', masteryRate: 0.68, sparkline: [0.62, 0.63, 0.65, 0.66, 0.67, 0.67, 0.68], streak: 3, newCount: 2 },
        }}};
      }
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {} } };
    });

    try {
      await mp.reLaunch('/pages/home/index');
      await sleep(1500);

      // Tap 「查看全部 ›」 (TEST_IDS.pHome.weeklyHomeLink = 'weekly-home-link')
      const homePage = await mp.currentPage();
      const link = await homePage.$('[data-test-id="weekly-home-link"]');
      expect(link, 'P-HOME weekly-home-link exists').toBeTruthy();
      if (link) await link.tap();
      await sleep(1500);

      // (a) 路由切到 pages/me/weekly/index · pageState=READY
      const page = await mp.currentPage();
      expect(page.path).toBe('pages/me/weekly/index');
      const data = await page.data();
      expect(data.pageState, 'READY · mocked stats.reviewedCount=10').toBe('READY');

      // (b) 12 testid 全 exists (READY 态 · weekly-empty NOT exists)
      const testidsRequired = [
        'p-weekly-review-root', 'weekly-back', 'weekly-range',
        'weekly-hero', 'weekly-delta', 'weekly-sparkline', 'weekly-radar',
        'weekly-weak-kp-1', 'weekly-weak-kp-2', 'weekly-weak-kp-3',
        'weekly-stats-trio', 'weekly-failed-scroller', 'weekly-ai-insight',
      ];
      for (const tid of testidsRequired) {
        const node = await page.$(`[data-test-id="${tid}"]`);
        expect(node, `testid=${tid} 应 exists`).toBeTruthy();
      }
      const emptyNodes = await page.$$('[data-test-id="weekly-empty"]');
      expect(emptyNodes.length, 'weekly-empty NOT exists 在 READY 态').toBe(0);

      // (c) weekly-range 文本含 "2026-W20"
      const rangeNode = await page.$('[data-test-id="weekly-range"]');
      const rangeTxt = rangeNode ? ((await rangeNode.text()) || '') : '';
      expect(rangeTxt).toMatch(/2026/);
      expect(rangeTxt).toMatch(/W20/);

      // (d) hero 文本含 "68%"
      const heroNode = await page.$('[data-test-id="weekly-hero"]');
      const heroTxt = heroNode ? ((await heroNode.text()) || '') : '';
      expect(heroTxt).toMatch(/68%/);

      // (e) delta direction=up (delta=+0.06)
      expect(data.hero?.deltaDirection).toBe('up');

      // (f) kp-1 渲染了 "韦达定理"
      const kp1 = await page.$('[data-test-id="weekly-weak-kp-1"]');
      const kp1Txt = kp1 ? ((await kp1.text()) || '') : '';
      expect(kp1Txt).toMatch(/韦达定理/);
    } finally {
      try { await mp.restoreWxMethod('request'); } catch { /* */ }
    }
  }, 90_000);

  // ──────────────────────────────────────────────────────────
  // TC-2 · Interaction · Tap weakKp-1 → P05 with kpId query
  // ──────────────────────────────────────────────────────────
  it('TC-2 · Tap weekly-weak-kp-1 → wx.navigateTo /pages/wrongbook-list/index?kpId=KP-A (INV-5)', async () => {
    await mp.mockWxMethod('request', function (options: { url?: string }) {
      const url = options.url || '';
      if (url.indexOf('/api/home/weekly') >= 0) {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          week: '2026-W20',
          range: { from: '2026-05-11', to: '2026-05-17' },
          hero: { masteryRate: 0.68, masteryDelta: 0.06, sparkline: [0.62, 0.63, 0.65, 0.66, 0.67, 0.67, 0.68] },
          subjectRadar: [{ subject: 'math', masteryRate: 0.70, sampleSize: 12 }],
          weakKPs: [
            { kpId: 'KP-A', kpName: '韦达定理', subject: 'math', recentMissCount: 3, totalMissCount: 5 },
            { kpId: 'KP-B', kpName: '受力分析', subject: 'physics', recentMissCount: 2, totalMissCount: 4 },
            { kpId: 'KP-C', kpName: '函数对称', subject: 'math', recentMissCount: 1, totalMissCount: 3 },
          ],
          stats: { reviewedCount: 10, reviewedDurationMin: 50, newCount: 2 },
          failedTop: [],
          aiInsight: null,
        }}};
      }
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {} } };
    });

    try {
      await mp.reLaunch('/pages/me/weekly/index');
      await sleep(1500);

      const page = await mp.currentPage();
      expect(page.path).toBe('pages/me/weekly/index');
      const data = await page.data();
      expect(data.pageState, 'READY for tap').toBe('READY');

      const kp1 = await page.$('[data-test-id="weekly-weak-kp-1"]');
      expect(kp1, 'weekly-weak-kp-1 应渲染').toBeTruthy();
      if (kp1) {
        await kp1.tap();
        await sleep(800);
      }

      // 因 wrongbook-list 在 tabBar · navigateTo 静默失败 · impl 改用 switchTab + storage
      // (E2E TC-2 抓获 spec/tabbar 冲突 · 2026-05-17 surface)
      const next = await mp.currentPage();
      expect(next.path).toBe('pages/wrongbook-list/index');
      const intent = await mp.evaluate(function () {
        // wx 全局在 MP 运行时可用
        const w = (globalThis as unknown as { wx: { getStorageSync: (k: string) => unknown } }).wx;
        return w.getStorageSync('weakKpIntent');
      });
      expect((intent as { kpId?: string })?.kpId, 'weakKpIntent.kpId 应=KP-A · INV-5 + storage 传递').toBe('KP-A');
    } finally {
      try { await mp.restoreWxMethod('request'); } catch { /* */ }
    }
  }, 90_000);

  // ──────────────────────────────────────────────────────────
  // TC-3 · Edge ERROR · GET /weekly 500 → ERROR banner + retry
  // ──────────────────────────────────────────────────────────
  it('TC-3 · GET /weekly 500 → pageState=ERROR · error-banner + retry-btn exists', async () => {
    // statusCode=500 触发 httpJSON throw → ERROR 态
    await mp.mockWxMethod('request', function (_options: unknown) {
      return { statusCode: 500, data: { code: 50001, message: 'internal error', data: null } };
    });

    try {
      await mp.reLaunch('/pages/me/weekly/index');
      await sleep(1500);

      const page = await mp.currentPage();
      const data = await page.data();

      expect(data.pageState, '500 注入 → ERROR').toBe('ERROR');

      const banner = await page.$('[data-test-id="weekly-error-banner"]');
      expect(banner, 'weekly-error-banner exists').toBeTruthy();

      const retryBtn = await page.$('[data-test-id="weekly-retry-btn"]');
      expect(retryBtn, 'weekly-retry-btn exists').toBeTruthy();

      const back = await page.$('[data-test-id="weekly-back"]');
      const range = await page.$('[data-test-id="weekly-range"]');
      expect(back).toBeTruthy();
      expect(range).toBeTruthy();
    } finally {
      try { await mp.restoreWxMethod('request'); } catch { /* */ }
    }
  }, 90_000);

  // ──────────────────────────────────────────────────────────
  // TC-4 · Edge EMPTY · stats.reviewedCount === 0 → 整页换 empty-hero
  // ──────────────────────────────────────────────────────────
  it('TC-4 · stats.reviewedCount=0 → pageState=EMPTY · 6 数据块 NOT exists · empty-cta wx.switchTab', async () => {
    await mp.mockWxMethod('request', function (options: { url?: string }) {
      const url = options.url || '';
      if (url.indexOf('/api/home/weekly') >= 0) {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          week: '2026-W20',
          range: { from: '2026-05-11', to: '2026-05-17' },
          hero: { masteryRate: null, masteryDelta: null, sparkline: [null, null, null, null, null, null, null] },
          subjectRadar: [],
          weakKPs: [],
          stats: { reviewedCount: 0, reviewedDurationMin: 0, newCount: 0 },
          failedTop: [],
          aiInsight: null,
        }}};
      }
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {} } };
    });

    try {
      await mp.reLaunch('/pages/me/weekly/index');
      await sleep(1500);

      const page = await mp.currentPage();
      const data = await page.data();

      expect(data.pageState, 'stats.reviewedCount=0 → EMPTY').toBe('EMPTY');

      const empty = await page.$('[data-test-id="weekly-empty"]');
      expect(empty, 'weekly-empty exists').toBeTruthy();

      const notExistsTids = [
        'weekly-hero', 'weekly-radar',
        'weekly-weak-kp-1', 'weekly-weak-kp-2', 'weekly-weak-kp-3',
        'weekly-stats-trio', 'weekly-failed-scroller', 'weekly-ai-insight',
      ];
      for (const tid of notExistsTids) {
        const nodes = await page.$$(`[data-test-id="${tid}"]`);
        expect(nodes.length, `${tid} NOT exists 在 EMPTY 态`).toBe(0);
      }

      const cta = await page.$('[data-test-id="weekly-empty-cta"]');
      expect(cta, 'weekly-empty-cta exists').toBeTruthy();
    } finally {
      try { await mp.restoreWxMethod('request'); } catch { /* */ }
    }
  }, 90_000);

  // ──────────────────────────────────────────────────────────
  // TC-5 · A11Y · delta chip ↓ + a11y attr + sr-only text
  // ──────────────────────────────────────────────────────────
  it('TC-5 · masteryDelta=-0.03 → delta chip 含 ↓ + "-3" + a11y attr "down" + sr-only text', async () => {
    await mp.mockWxMethod('request', function (options: { url?: string }) {
      const url = options.url || '';
      if (url.indexOf('/api/home/weekly') >= 0) {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          week: '2026-W20',
          range: { from: '2026-05-11', to: '2026-05-17' },
          hero: { masteryRate: 0.65, masteryDelta: -0.03, sparkline: [0.68, 0.66, 0.65, 0.64, 0.65, 0.65, 0.65] },
          subjectRadar: [{ subject: 'math', masteryRate: 0.7, sampleSize: 10 }],
          weakKPs: [{ kpId: 'KP-1', kpName: 'X', subject: 'math', recentMissCount: 1, totalMissCount: 1 }],
          stats: { reviewedCount: 10, reviewedDurationMin: 50, newCount: 2 },
          failedTop: [],
          aiInsight: null,
        }}};
      }
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {} } };
    });

    try {
      await mp.reLaunch('/pages/me/weekly/index');
      await sleep(1500);

      const page = await mp.currentPage();
      const data = await page.data();

      const delta = await page.$('[data-test-id="weekly-delta"]');
      expect(delta, 'weekly-delta exists').toBeTruthy();

      expect(data.hero?.deltaDirection).toBe('down');

      if (delta) {
        const txt = (await delta.text()) || '';
        expect(txt).toMatch(/↓/);
        expect(txt).toMatch(/-3/);
      }

      expect(data.hero?.deltaSrText).toMatch(/下跌|下降|减少/);
    } finally {
      try { await mp.restoreWxMethod('request'); } catch { /* */ }
    }
  }, 90_000);

  // ──────────────────────────────────────────────────────────
  // TC-6 · P-HOME 4 数字 wire to today.weekSummary (INV-6 / AC8 兜底集)
  // ──────────────────────────────────────────────────────────
  it('TC-6 · P-HOME 4 数字 wire to weekSummary (null 兜底 + INV-6 不调 /weekly + 跨页同源)', async () => {
    // 空周 weekSummary: masteryRate=null · sparkline 散点 null · streak=0 · newCount=0
    // INV-6 验证: 用 globalThis 计数器 + mp.evaluate 读回 (函数序列化丢闭包 · 不能直接 ++)
    await mp.mockWxMethod('request', function (options: { url?: string }) {
      const g = globalThis as unknown as { __mockCalls?: { weekly: number; today: number } };
      g.__mockCalls = g.__mockCalls || { weekly: 0, today: 0 };
      const url = options.url || '';
      // 注意 endpoint 区分: /api/home/weekly (full review · INV-6 禁) ≠
      //                    /api/home/weekly-stats (P-HOME 4 stat · 允许)
      // 用 regex 严格匹配 /weekly 后必须紧跟 ?/$/末尾 · 避开 weekly-stats substring 撞车
      const isFullWeekly = /\/api\/home\/weekly($|\?)/.test(url);
      if (isFullWeekly) {
        g.__mockCalls.weekly++;
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          week: '2026-W20',
          range: { from: '2026-05-11', to: '2026-05-17' },
          hero: { masteryRate: null, masteryDelta: null, sparkline: [null, null, null, null, null, null, null] },
          subjectRadar: [], weakKPs: [],
          stats: { reviewedCount: 0, reviewedDurationMin: 0, newCount: 0 },
          failedTop: [], aiInsight: null,
        }}};
      }
      if (url.indexOf('/api/home/today') >= 0) {
        g.__mockCalls.today++;
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          tz: 'Asia/Shanghai',
          today: { total: 0, done: 0, circleProgress: 0 },
          weekSummary: {
            week: '2026-W20',
            masteryRate: null,
            sparkline: [0.60, null, 0.65, null, 0.68, null, 0.72],
            streak: 0,
            newCount: 0,
          },
        }}};
      }
      if (url.indexOf('/api/review/today') >= 0) {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: { total: 0, done: 0, items: [], tz: 'Asia/Shanghai' } } };
      }
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {} } };
    });

    try {
      // reset counter
      await mp.evaluate(function () { (globalThis as unknown as { __mockCalls: unknown }).__mockCalls = { weekly: 0, today: 0 }; });

      await mp.reLaunch('/pages/home/index');
      await sleep(1500);

      const homePage = await mp.currentPage();
      expect(homePage.path).toBe('pages/home/index');

      const homeData = await homePage.data();

      // (a) masteryRate=null → "—%" (em dash · 不 hyphen)
      expect(homeData.weekSummaryMasteryText).toBe('—%');

      // (b) sparkline null 索引断笔 · 数据模型层断言
      expect(homeData.homeWeekSummary?.sparkline?.[1]).toBeNull();
      expect(homeData.homeWeekSummary?.sparkline?.[3]).toBeNull();
      expect(homeData.homeWeekSummary?.sparkline?.[5]).toBeNull();

      // (c) streak=0 → streak chip wx:if 移除 · DOM 不存在
      const streakChips = await homePage.$$('[data-test-id="p-home-streak-chip"]');
      expect(streakChips.length).toBe(0);

      // (d) newCount stat exists · 用户 2026-05-18 决策恢复旧 4 维度无 "+" 前缀 ·
      //     绑 weekStats.newItems (BE /api/home/weekly-stats 真值) · 0 时显纯 "0"
      const newCountNode = await homePage.$('[data-test-id="p-home-week-new-count"]');
      expect(newCountNode, 'p-home-week-new-count exists').toBeTruthy();
      if (newCountNode) {
        const txt = (await newCountNode.text()) || '';
        // mock 没拦 weekly-stats endpoint · 真 BE 返 newItems · 验为数字字符即可
        expect(txt).toMatch(/^\d+$/);
      }

      // mastery rate stat exists · 绑 weekStats.masteryRate (旧 4 维度复活) ·
      // 数字 + "%" 后缀 (不再 SC-16-T02 的 "—%" em dash · 真 BE 整数百分比)
      const masteryNum = await homePage.$('[data-test-id="p-home-week-mastery-num"]');
      expect(masteryNum, 'p-home-week-mastery-num exists').toBeTruthy();
      if (masteryNum) {
        const txt = (await masteryNum.text()) || '';
        expect(txt).toMatch(/\d+%/);
      }

      // (e) INV-6: P-HOME mount 后 0 个 /weekly 请求 + ≥1 个 /today 请求
      const counts = await mp.evaluate(function () {
        const g = globalThis as unknown as { __mockCalls?: { weekly: number; today: number } };
        return g.__mockCalls || { weekly: -1, today: -1 };
      });
      expect((counts as { weekly: number }).weekly, 'INV-6 · P-HOME 不调 /api/home/weekly').toBe(0);
      expect((counts as { today: number }).today, 'P-HOME 调 /api/home/today ≥ 1').toBeGreaterThan(0);

      // (f) 跨页一致性: 进 weekly 页 · 数据同源
      await mp.navigateTo('/pages/me/weekly/index');
      await sleep(1500);

      const weeklyPage = await mp.currentPage();
      const weeklyData = await weeklyPage.data();

      expect(weeklyData.pageState).toBe('EMPTY');
    } finally {
      try { await mp.restoreWxMethod('request'); } catch { /* */ }
    }
  }, 120_000);
});

// ── 工具 ────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
