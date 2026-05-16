// P-HOME 首页 · 1:1 mirror of design/mockups/wrongbook/01_home.html
// trace: design/mockups/wrongbook/01_home.html · @longfeng/testids pHome
// 状态机: LOADING → READY | EMPTY | ERROR
// API: src/api/home.ts · getHomeTodayCount · 真 API · 0 mock

import { TEST_IDS } from '@longfeng/testids';
import { getHomeTodayCount, getHomeTodayAggregate, type HomeWeekSummaryDto } from '../../src/api/home';
import {
  SUBJECT_COLORS,
  buildCurrentWeekStrip,
  buildGreeting,
  computeCirclePct,
  derivePageState,
  buildSparklineSvgFromWeekSummary,
  formatMasteryPctFromWeekSummary,
} from './helpers';
import type { PageState } from './helpers';

// SC-16-T02 · MVP studentId (登录上线时改读 store · 与 weekly 页同源)
const MVP_STUDENT_ID = '1';

// ─── Mock/MVP data ──────────────────────────────────────────────
const MVP_SUBJECTS = [
  { name: '数学', count: 3, color: SUBJECT_COLORS['数学'] },
  { name: '物理', count: 2, color: SUBJECT_COLORS['物理'] },
  { name: '英语', count: 3, color: SUBJECT_COLORS['英语'] },
];

// SC-16-T02: weekStats 旧 mock 字段 (mastered/newItems/forgotten/masteryRate)
// 已被 weekSummary (masteryRate/sparkline/streak/newCount) 替换 · 不再消费
// 保留常量供 vrt baseline 兜底 (LOADING 态前) · 不绑到 wxml
const LEGACY_WEEK_STATS_PLACEHOLDER = { mastered: 0, newItems: 0, forgotten: 0, masteryRate: 0 };

// (B4 · B5) MVP_WEEK_DAYS / weekLabel 由 buildCurrentWeekStrip() 动态生成
// 旧硬编码 (周二/周三 d=22 重复 · 4 月 20-26 日) 已删除

const MVP_MESSAGES = [
  { title: '记忆曲线 T3 · 二次函数', subtitle: '今晚 20:30 · 3 题即将到期', time: '10 min', icon: 'bell', iconColor: '#5856D6', theme: 'ind' },
  { title: '妈妈分享了「5 月月考安排」', subtitle: '5 月 12 日 · 周一 · 已同步到日历', time: '昨天', icon: 'calendar-o', iconColor: '#FF2D55', theme: 'pnk' },
  { title: '本周免打扰时段已更新', subtitle: '23:00 – 07:30 · 记忆曲线节奏不变', time: '周日', icon: 'clock-o', iconColor: '#30B0C7', theme: 'tea' },
];

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
    subjects: MVP_SUBJECTS,

    // SC-16-T02 · weekSummary 4 字段 wire (替代旧 weekStats / sparklineSvgUri) · INV-6
    // null = LOADING / 未拉到 · 不显 "0%" (空周语义 · biz §10.14)
    homeWeekSummary: null as HomeWeekSummaryDto | null,
    // 派生字段 (helpers 计算): 减少 wxml 表达式复杂度
    weekSummaryMasteryText: '—%',
    weekSummarySparklineUri: '',
    weekSummaryStreak: 0,
    weekSummaryNewCount: 0,
    // legacy fallback (LOADING / ERROR 态)
    weekStats: LEGACY_WEEK_STATS_PLACEHOLDER,
    sparklineSvgUri: SPARKLINE_SVG_URI,

    // week schedule · 动态 (B4 + B5)
    weekLabel: buildCurrentWeekStrip(new Date()).label,
    weekDays: buildCurrentWeekStrip(new Date()).days,

    // messages
    messages: MVP_MESSAGES,

    // quick entries
    quickEntries: QUICK_ENTRIES,
  },

  onLoad() {
    this._fetchTodayData();
    // SC-16-T02 · 并行拉 weekSummary (P-HOME 4 数字 wire · 不调 /api/home/weekly)
    this._fetchWeekSummary();
  },

  onShow() {
    // Refresh time-dependent data (greeting + 本周日程 · 跨日要切高亮)
    const strip = buildCurrentWeekStrip(new Date());
    this.setData({
      greeting: buildGreeting(),
      weekLabel: strip.label,
      weekDays: strip.days,
    });
    // Sync 复习 tab badge to today's pending review count · mockup line 484 badge=8
    this._syncReviewBadge();
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
    try {
      const data = await getHomeTodayCount();
      // 后端 data.total / data.done 可能缺字段 · ?? 0 兜底 防 IDE Console:
      // "Setting data field 'todayDone' to undefined is invalid" (Fix-4b · 2026-05-16)
      const total = data.total ?? 0;
      const done = data.done ?? 0;
      const pct = computeCirclePct(done, total);

      this.setData({
        pageState: derivePageState(data, false),
        todayTotal: total,
        todayDone: done,
        circleProgress: pct / 100,
        circlePctText: `${pct}%`,
      }, () => this._syncReviewBadge());
    } catch {
      // Degrade: show READY with MVP defaults (mockup placeholder data)
      this.setData({
        pageState: 'READY' as PageState,
        todayTotal: 8,
        todayDone: 3,
        circleProgress: 0.38,
        circlePctText: '38%',
      }, () => this._syncReviewBadge());
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
});
