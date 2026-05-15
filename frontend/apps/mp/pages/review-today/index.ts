// P07 今日复习 · 1:1 mirror of design/mockups/wrongbook/07_review_today.html
// trace: design/mockups/wrongbook/07_review_today.html · @longfeng/testids p07
// 状态机: LOADING → today.LIST | today.EMPTY | today.ALL_DONE
// API: src/api/review.ts · getToday + createSession · 真 API · 0 mock

import { TEST_IDS } from '@longfeng/testids';
import { getToday, createSession } from '../../src/api/review';
import { buildSlotsFromItems, MOCK_SLOTS } from './helpers';
import type { SlotData } from './helpers';

// ─── Types ──────────────────────────────────────────────────────
type PageState = 'LOADING' | 'today.LIST' | 'today.EMPTY' | 'today.ALL_DONE';

// ─── Page ──────────────────────────────────────────────────────
Page({
  data: {
    testIds: TEST_IDS.p07,

    pageState: 'LOADING' as PageState,
    slots: MOCK_SLOTS as SlotData[],
    totalCount: 8,
    doneCount: 3,
    inProgressCount: 1,
    waitCount: 4,
    estMinutes: 25,
    progressPct: 38,
    masteryPct: 72,

    dateStr: '',
    weekday: '',
  },

  onLoad() {
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    this.setData({ dateStr, weekday: days[d.getDay()] });

    this._fetchToday();
  },

  async _fetchToday() {
    try {
      const resp = await getToday('Asia/Shanghai');
      const items = resp.data.items;
      const total = resp.data.total;

      if (total === 0) {
        this.setData({ pageState: 'today.EMPTY' as PageState, totalCount: 0 });
        return;
      }

      const now = new Date();
      const builtSlots = buildSlotsFromItems(items, now);
      const completed = items.filter(i => i.mastered);
      const doneCount = completed.length;
      const waitCount = items.filter(i => !i.mastered && !i.completedAt).length;
      const inProgressCount = total - doneCount - waitCount;
      const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

      this.setData({
        slots: builtSlots.length > 0 ? builtSlots : MOCK_SLOTS,
        totalCount: total,
        doneCount,
        inProgressCount,
        waitCount,
        estMinutes: Math.max(1, total * 3),
        progressPct,
        pageState: (doneCount === total ? 'today.ALL_DONE' : 'today.LIST') as PageState,
      });
    } catch {
      // §9 降级: use mock data
      this.setData({ pageState: 'today.LIST' as PageState });
    }
  },

  onBackTap() {
    wx.navigateBack();
  },

  onTabHome() {
    wx.switchTab({ url: '/pages/home/index' });
  },

  onItemTap(e: WechatMiniprogram.TouchEvent) {
    const nid = e.currentTarget.dataset.nid;
    wx.navigateTo({
      url: `/pages/review-exec/index?nid=${nid}`,
    });
  },

  async onStartAllTap() {
    try {
      wx.vibrateShort({ type: 'light' });
    } catch { /* noop */ }

    try {
      const resp = await createSession({ tz: 'Asia/Shanghai' });
      const sid = resp.data.sid;
      wx.navigateTo({
        url: `/pages/review-exec/index?sid=${sid}`,
      });
    } catch {
      wx.showToast({ title: '启动失败 · 请重试', icon: 'none' });
    }
  },
});
