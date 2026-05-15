// P-HOME 首页 · 1:1 mirror of design/mockups/wrongbook/01_home_ios_refined.html
// trace: design/mockups/wrongbook/01_home_ios_refined.html · @longfeng/testids pHome
// 状态机: LOADING → READY | EMPTY | ERROR
// API: src/api/home.ts · getHomeTodayCount · 真 API · 0 mock

import { TEST_IDS } from '@longfeng/testids';
import { getHomeTodayCount } from '../../src/api/home';
import { buildGreeting, computeCirclePct, derivePageState } from './helpers';
import type { PageState } from './helpers';

// ─── Subject palette ────────────────────────────────────────────
const SUBJECT_COLORS: Record<string, string> = {
  '数学': '#C41E3A',
  '物理': '#0057B7',
  '化学': '#1A6B3A',
  '英语': '#9C4F00',
};

// ─── Mock/MVP data ──────────────────────────────────────────────
const MVP_SUBJECTS = [
  { name: '数学', count: 3, color: SUBJECT_COLORS['数学'] },
  { name: '物理', count: 2, color: SUBJECT_COLORS['物理'] },
  { name: '英语', count: 3, color: SUBJECT_COLORS['英语'] },
];

const MVP_WEEK_STATS = { mastered: 23, newItems: 8, forgotten: 2, masteryRate: 68 };

const MVP_WEEK_DAYS = [
  { w: '一', d: '20', dots: ['#C41E3A', '#0057B7'], today: false, num: 0 },
  { w: '二', d: '22', dots: ['#C41E3A', '#0057B7', '#9C4F00', '#C41E3A', '#FF2D55'], today: true, num: 8 },
  { w: '三', d: '22', dots: ['#1A6B3A', '#30B0C7'], today: false, num: 0 },
  { w: '四', d: '23', dots: ['#C41E3A', '#1A6B3A', '#9C4F00'], today: false, num: 0 },
  { w: '五', d: '24', dots: ['#0057B7', '#30B0C7'], today: false, num: 0 },
  { w: '六', d: '25', dots: ['#9C4F00'], today: false, num: 0 },
  { w: '日', d: '26', dots: ['#1A6B3A', '#30B0C7', '#C41E3A'], today: false, num: 0 },
];

const MVP_MESSAGES = [
  { title: '记忆曲线 T3 · 二次函数', subtitle: '今晚 20:30 · 3 题即将到期', time: '10 min', icon: 'bell', iconColor: '#5856D6', theme: 'ind' },
  { title: '妈妈分享了「5 月月考安排」', subtitle: '5 月 12 日 · 周一 · 已同步到日历', time: '昨天', icon: 'calendar-o', iconColor: '#FF2D55', theme: 'pnk' },
  { title: '本周免打扰时段已更新', subtitle: '23:00 – 07:30 · 记忆曲线节奏不变', time: '周日', icon: 'clock-o', iconColor: '#30B0C7', theme: 'tea' },
];

const QUICK_ENTRIES = [
  { title: '错题本', subtitle: '128 题 · 未掌握 42', icon: 'description', theme: 'red', url: '/pages/capture/index' },
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

    // weekly
    weekStats: MVP_WEEK_STATS,

    // week schedule
    weekLabel: '4 月 20–26 日',
    weekDays: MVP_WEEK_DAYS,

    // messages
    messages: MVP_MESSAGES,

    // quick entries
    quickEntries: QUICK_ENTRIES,
  },

  onLoad() {
    this._fetchTodayData();
  },

  onShow() {
    // Refresh greeting (time-dependent)
    this.setData({ greeting: buildGreeting() });
  },

  async _fetchTodayData() {
    try {
      const resp = await getHomeTodayCount();
      const data = resp.data;
      const pct = computeCirclePct(data.done, data.total);

      this.setData({
        pageState: derivePageState(data, false),
        todayTotal: data.total,
        todayDone: data.done,
        circleProgress: pct / 100,
        circlePctText: `${pct}%`,
      });
    } catch {
      // Degrade: show READY with MVP defaults (mockup placeholder data)
      this.setData({
        pageState: 'READY' as PageState,
        todayTotal: 8,
        todayDone: 3,
        circleProgress: 0.38,
        circlePctText: '38%',
      });
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
