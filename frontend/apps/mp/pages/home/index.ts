// P-HOME 首页 · 1:1 mirror of design/mockups/wrongbook/01_home.html
// trace: design/mockups/wrongbook/01_home.html · @longfeng/testids pHome
// 状态机: LOADING → READY | EMPTY | ERROR
// API: src/api/home.ts · getHomeTodayCount · 真 API · 0 mock

import { TEST_IDS } from '@longfeng/testids';
import {
  getHomeTodayCount,
  getHomeTodayAggregate,
  getRecentMessages,
  getWeekDots,
  getWeeklyStats,
  type HomeWeekSummaryDto,
  type MessageItem,
  type WeeklyStatsResp,
} from '../../src/api/home';
import {
  buildCurrentWeekStrip,
  buildGreeting,
  buildSubjectsFromItems,
  computeCirclePct,
  derivePageState,
  buildSparklineSvgFromWeekSummary,
  formatMasteryPctFromWeekSummary,
  buildWeekDayLabels,
  computeIsoTodayIdx,
} from './helpers';
import type { PageState, SubjectChip } from './helpers';
// 跨页共享 "今日 grade" 判定 · P07 + P-HOME 同一 source · 防漂移
import { isCompletedToday } from '../../src/utils/today';

// SC-16-T02 · MVP studentId (登录上线时改读 store · 与 weekly 页同源)
const MVP_STUDENT_ID = '1';

// ─── Mock/MVP data 已全部删除 (2026-05-18 用户选项 A 全修) ─────────
// 之前 4 块 mock 现全清:
//   - MVP_SUBJECTS (3 数学/2 物理/3 英语 = 8 与 todayTotal 撞车)
//   - MVP_WEEK_STATS (23/8/2/68 永远不动)
//   - MVP_MESSAGES (含"妈妈分享" "免打扰更新" 完全假数据)
//   - PLACEHOLDER_DOTS_BY_WEEKDAY (helpers.ts · 周历下假彩点)
// 现全部由 BE /api/home/{weekly-stats, week-dots, messages/recent} 派生真值.
// SC-16-T02 weekSummary 4 字段更走 /api/home/today.weekSummary 投影.

// (B3) Sparkline SVG mockup 常量已删 (2026-05-18 用户决策 B 严格真值) ·
// 改用 SC-16-T02 weekSummarySparklineUri (真值 /today.weekSummary.sparkline) ·
// 空周不渲染 · 防 mockup 假曲线穿透 (与 P03/P04 治理同根)

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

    // SC-16-T02 · weekSummary 4 字段 wire (走 /today.weekSummary · INV-6 不调 /weekly)
    // null = LOADING / 未拉到 · 不显 "0%" (空周语义 · biz §10.14)
    homeWeekSummary: null as HomeWeekSummaryDto | null,
    // 派生字段 (helpers 计算): 减少 wxml 表达式复杂度
    weekSummaryMasteryText: '—%',
    weekSummarySparklineUri: '',
    weekSummaryStreak: 0,
    weekSummaryNewCount: 0,
    // weekly · BE /api/home/weekly-stats 真值 · init 0 · 加载后填充 (与 weekSummary 共存)
    weekStats: { mastered: 0, newItems: 0, forgotten: 0, masteryRate: 0 } as WeeklyStatsResp,
    // sparklineSvgUri mockup 占位已删 (B 方案 · 严格真值)

    // week schedule · 动态 (B4 + B5) · dots 由 BE /api/home/week-dots 注入
    weekLabel: buildCurrentWeekStrip(new Date()).label,
    weekDays: buildCurrentWeekStrip(new Date()).days,

    // 2026-05-18 sparkline 下方 day bar 标签 · 7 桶周一→周日 · "今天"贴 ISO 今天
    // index (周一=0..周日=6). 之前写死 [周一..周六,今天] 假设今天=周日 → 错位.
    weekDayLabels: buildWeekDayLabels(new Date()),
    todayIdx: computeIsoTodayIdx(new Date()),

    // messages · BE /api/home/messages/recent 派生 ≤3 · init 空
    messages: [] as MessageItem[],

    // quick entries
    quickEntries: QUICK_ENTRIES,
  },

  onLoad() {
    this._fetchTodayData();
    // SC-16-T02 · 并行拉 weekSummary (P-HOME 4 数字 wire · 不调 /api/home/weekly)
    this._fetchWeekSummary();
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
      // done = "今日已 grade" · 共享 src/utils/today.isCompletedToday 跟 P07 同口径.
      // review_plan cyclic 模型: 不能用 completedAt != null (累积曾经 grade), 必须比 today_start.
      const now = new Date();
      const itemsArr = Array.isArray(todayData.items) ? todayData.items : [];
      const done = typeof todayData.done === 'number'
        ? todayData.done
        : itemsArr.filter(i => isCompletedToday(
            (i as { completedAt?: string | null }).completedAt, now
          )).length;
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

  /**
   * SC-16-T02 · 拉 P-HOME 4 数字 (今日聚合含 weekSummary)
   * INV-6: P-HOME 必须仅从此投影消费 · 不调用 /api/home/weekly
   */
  async _fetchWeekSummary() {
    try {
      const data = await getHomeTodayAggregate(MVP_STUDENT_ID);
      const ws = data.weekSummary || null;
      if (ws) {
        const sparklineUri = buildSparklineSvgFromWeekSummary(ws.sparkline);
        this.setData({
          homeWeekSummary: ws,
          weekSummaryMasteryText: formatMasteryPctFromWeekSummary(ws.masteryRate),
          weekSummarySparklineUri: sparklineUri,
          weekSummaryStreak: ws.streak,
          weekSummaryNewCount: ws.newCount,
        });
      }
    } catch {
      // 静默降级 · 让 P-HOME 其他 sections 继续渲染 · weekSummary 显 "—%"
      this.setData({
        homeWeekSummary: null,
        weekSummaryMasteryText: '—%',
        weekSummaryStreak: 0,
        weekSummaryNewCount: 0,
      });
    }
  },

  onStartAll() {
    wx.navigateTo({ url: '/pages/review-exec/index' });
  },

  /**
   * SC-16-T02 · Tap P-HOME .bento「查看全部 ›」 → P-WEEKLY-REVIEW
   * 锚 mockup 01_home_v2.html line 291 视觉锚 · spec §7 entry
   */
  onWeeklyHomeTap() {
    wx.navigateTo({ url: '/pages/me/weekly/index' });
  },

  onQuickTap(e: WechatMiniprogram.TouchEvent) {
    const url = e.currentTarget.dataset.url as string;
    if (url) {
      wx.navigateTo({ url });
    }
  },

  /**
   * 2026-05-18 · 「月视图 ›」tap handler
   * spec P-HOME §7 出口表 (L241): 「月视图 ›」→ P10 calendar-month (`pages/calendar/month`).
   * biz §2A.3 L234 + §2B.6 步 2: 进 P10 触发 home_open_full_calendar{from=weekstrip}.
   *
   * 历史: 2026-05-18 (commit dc9602f) P10 未实装 · 暂用 toast 兜底.
   * 现 (P10 task 完): pages/calendar/month/ 4 件套已落地 + BE /api/calendar/events?month= 通 ·
   * 真 navigateTo 上线.
   */
  onMonthViewTap() {
    // P-HOME 周条带"完整日历"入口 · 不带 anchor · P10 默认本月 + today 选中
    wx.navigateTo({ url: '/pages/calendar/month/index' });
    // 埋点 (spec §12 home_open_full_calendar)
    console.log('[P-HOME] home_open_full_calendar', { from: 'weekstrip' });
  },
});
