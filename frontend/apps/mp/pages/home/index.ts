// P-HOME 首页 · 1:1 mirror of design/mockups/wrongbook/01_home.html
// trace: design/mockups/wrongbook/01_home.html · @longfeng/testids pHome
// 状态机: LOADING → READY | EMPTY | ERROR
// API: src/api/home.ts · getHomeTodayCount · 真 API · 0 mock

import { TEST_IDS } from '@longfeng/testids';
import {
  getHomeTodayCount,
  getRecentMessages,
  getWeekDots,
  getWeeklyStats,
  type MessageItem,
  type WeeklyStatsResp,
} from '../../src/api/home';
import {
  buildCurrentWeekStrip,
  buildGreeting,
  buildSubjectsFromItems,
  computeCirclePct,
  derivePageState,
} from './helpers';
import type { PageState, SubjectChip } from './helpers';

// ─── Mock/MVP data 已全部删除 (2026-05-18 用户选项 A 全修) ─────────
// 之前 3 块 mock:
//   - MVP_SUBJECTS (3 数学/2 物理/3 英语 = 8 与 todayTotal 撞车)
//   - MVP_WEEK_STATS (23/8/2/68 永远不动)
//   - MVP_MESSAGES (含"妈妈分享" "免打扰更新" 完全假数据)
//   - PLACEHOLDER_DOTS_BY_WEEKDAY (helpers.ts · 周历下假彩点)
// 现全部由 BE /api/home/{weekly-stats, week-dots, messages/recent} 派生真值.

// (B3) Sparkline SVG · trace 01_home.html L280-290
// MP <view> 不能直接放 <svg> 标签 · 改成 data URI 给 <image> 用
// path / circle 数值与 mockup 完全一致 (300×40 viewBox · 7 段折线)
const SPARKLINE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 40" preserveAspectRatio="none">
  <defs>
    <linearGradient id="sparkg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#34C759" stop-opacity=".35"/>
      <stop offset="100%" stop-color="#34C759" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <path d="M0 28 L43 22 L86 24 L129 16 L172 12 L215 18 L258 8 L300 14 L300 40 L0 40 Z" fill="url(#sparkg)"/>
  <path d="M0 28 L43 22 L86 24 L129 16 L172 12 L215 18 L258 8 L300 14" stroke="#34C759" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="258" cy="8" r="3.5" fill="#34C759" stroke="#fff" stroke-width="1.5"/>
</svg>`;
// 用 encodeURIComponent 比 base64 更轻量, MP <image src="data:image/svg+xml;utf8,..."> OK
const SPARKLINE_SVG_URI = `data:image/svg+xml;utf8,${encodeURIComponent(SPARKLINE_SVG)}`;

const QUICK_ENTRIES = [
  { title: '错题本', subtitle: '128 题 · 未掌握 42', icon: 'description', theme: 'red', url: '/pages/wrongbook-list/index' },
  { title: '拍一道新错题', subtitle: '自动识别 · 多学科', icon: 'photograph', theme: 'grn', url: '/pages/capture/index' },
  { title: '完整日历', subtitle: '月 / 周 / 日视图', icon: 'calendar-o', theme: 'blu', url: '' },
  { title: '偏好与提醒', subtitle: '免打扰 · 节奏 · 语言', icon: 'setting-o', theme: 'pur', url: '' },
];

// ─── Page ───────────────────────────────────────────────────────
Page({
  data: {
    testIds: TEST_IDS.pHome,
    pageState: 'LOADING' as PageState,

    // greeting
    greeting: buildGreeting(),
    studentName: '小 A',
    streak: 12,
    mastered: 142,

    // review hero
    todayTotal: 0,
    todayDone: 0,
    estMin: 25,
    circleProgress: 0,
    circlePctText: '0%',
    // allDone = 今日 4 题全 GRADED · hero 切庆祝文案 (与 P07 一致 · 撤掉 "N 题待复习" 误导).
    allDone: false,
    // subjects 由 _fetchTodayData 真聚合 · init 空 · 之前写死 3/2/3 与 todayTotal 撞车.
    subjects: [] as SubjectChip[],

    // weekly · BE /api/home/weekly-stats 真值 · init 0 · 加载后填充
    weekStats: { mastered: 0, newItems: 0, forgotten: 0, masteryRate: 0 } as WeeklyStatsResp,
    sparklineSvgUri: SPARKLINE_SVG_URI,

    // week schedule · 动态 (B4 + B5) · dots 由 BE /api/home/week-dots 注入
    weekLabel: buildCurrentWeekStrip(new Date()).label,
    weekDays: buildCurrentWeekStrip(new Date()).days,

    // messages · BE /api/home/messages/recent 派生 ≤3 · init 空
    messages: [] as MessageItem[],

    // quick entries
    quickEntries: QUICK_ENTRIES,
  },

  onLoad() {
    this._fetchTodayData();
  },

  onShow() {
    // Refresh time-dependent data (greeting + 本周日程 · 跨日要切高亮).
    // weekDays badge num 用上次已知 pending · _fetchTodayData 拉到新值后会再次更新.
    const cachedPending = Math.max(0, (this.data.todayTotal as number) - (this.data.todayDone as number));
    const strip = buildCurrentWeekStrip(new Date(), cachedPending);
    this.setData({
      greeting: buildGreeting(),
      weekLabel: strip.label,
      weekDays: strip.days,
    });
    // 从 P04 保存新题回来 · 必须重新拉今日复习 · 否则 hero "X 题待复习" 永远不更新
    this._fetchTodayData();
    // _syncReviewBadge 已在 _fetchTodayData 完成回调里调过 · 不重复
  },

  _syncReviewBadge() {
    const pending = Math.max(0, (this.data.todayTotal as number) - (this.data.todayDone as number));
    if (pending > 0) {
      wx.setTabBarBadge({ index: 3, text: String(pending), fail: () => { /* ignore in non-tab context */ } });
    } else {
      wx.removeTabBarBadge({ index: 3, fail: () => { /* ignore */ } });
    }
  },

  async _fetchTodayData() {
    // 4 接口并行拉 · 各自 catch 独立降级 · 任一挂不拖累其它块.
    // 用 .catch → undefined 而非 Promise.allSettled (tsconfig lib 不含 ES2020 PromiseSettledResult).
    type FailableTodayData = Awaited<ReturnType<typeof getHomeTodayCount>> | undefined;
    type FailableWeekly = WeeklyStatsResp | undefined;
    type FailableDots = Awaited<ReturnType<typeof getWeekDots>> | undefined;
    type FailableMsg = Awaited<ReturnType<typeof getRecentMessages>> | undefined;

    const [todayData, weeklyData, dotsData, msgData] = await Promise.all([
      getHomeTodayCount().catch((err: unknown): FailableTodayData => {
        console.error('[P-HOME] getHomeTodayCount failed:', err);
        return undefined;
      }),
      getWeeklyStats().catch((err: unknown): FailableWeekly => {
        console.error('[P-HOME] getWeeklyStats failed:', err);
        return undefined;
      }),
      getWeekDots().catch((err: unknown): FailableDots => {
        console.error('[P-HOME] getWeekDots failed:', err);
        return undefined;
      }),
      getRecentMessages().catch((err: unknown): FailableMsg => {
        console.error('[P-HOME] getRecentMessages failed:', err);
        return undefined;
      }),
    ]);

    // ── #1 today (hero + subjects + circle + allDone + weekStrip badge) ──
    if (todayData) {
      const total = todayData.total ?? 0;
      // done = "今日已 grade" (= completedAt 落在今日窗口) · review_plan cyclic 模型 ·
      // 不能用 completedAt != null (= 累积曾经 grade · 昨晚 grade 的今晚 仍是历史标记).
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const itemsArr = Array.isArray(todayData.items) ? todayData.items : [];
      const done = typeof todayData.done === 'number'
        ? todayData.done
        : itemsArr.filter(i => {
            const ca = (i as { completedAt?: string | null }).completedAt;
            if (!ca) return false;
            const t = new Date(ca).getTime();
            return !isNaN(t) && t >= todayStart;
          }).length;
      const pct = computeCirclePct(done, total);
      const subjects = buildSubjectsFromItems(itemsArr as Array<{ subject?: string | null }>);
      const pending = Math.max(0, total - done);

      // weekStrip dots 来自 dotsData · 失败时 undefined (空 dots 真实反映 "无排程")
      const dotsByDay = dotsData
        ? dotsData.days.map((d: { date: string; dots: string[] }) => d.dots)
        : undefined;
      const strip = buildCurrentWeekStrip(new Date(), pending, dotsByDay);

      this.setData({
        pageState: derivePageState(todayData, false),
        todayTotal: total,
        todayDone: done,
        circleProgress: pct / 100,
        circlePctText: `${pct}%`,
        allDone: total > 0 && done >= total,
        subjects,
        weekLabel: strip.label,
        weekDays: strip.days,
      }, () => this._syncReviewBadge());
    } else {
      this.setData({
        pageState: 'READY' as PageState,
        todayTotal: 0,
        todayDone: 0,
        circleProgress: 0,
        circlePctText: '0%',
        allDone: false,
        subjects: [] as SubjectChip[],
      }, () => this._syncReviewBadge());
    }

    // ── #2 weekly-stats (本周回顾 4 stat) ──
    // 失败时保持 init {0,0,0,0} · 真值 0 比假 23/8/2/68 诚实.
    if (weeklyData) {
      this.setData({ weekStats: weeklyData });
    }

    // ── #3 messages (派生 ≤3 条) ──
    // 失败时保持 init [] · 用户看到 "暂无消息" 比看假 "妈妈分享" 诚实.
    if (msgData) {
      this.setData({ messages: msgData.messages });
    }
  },

  onStartAll() {
    wx.navigateTo({ url: '/pages/review-exec/index' });
  },

  onQuickTap(e: WechatMiniprogram.TouchEvent) {
    const url = e.currentTarget.dataset.url as string;
    if (url) {
      wx.navigateTo({ url });
    }
  },
});
