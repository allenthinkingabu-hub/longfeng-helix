// P07 今日复习 · 1:1 mirror of design/mockups/wrongbook/07_review_today.html
// trace: design/mockups/wrongbook/07_review_today.html · @longfeng/testids p07
// 状态机: LOADING → today.LIST | today.EMPTY | today.ALL_DONE
// API: src/api/review.ts · getToday + createSession · 真 API · 0 mock

import { TEST_IDS } from '@longfeng/testids';
import { getToday, createSession } from '../../src/api/review';
import { buildSlotsFromItems } from './helpers';
import type { SlotData } from './helpers';

// ─── Types ──────────────────────────────────────────────────────
type PageState = 'LOADING' | 'today.LIST' | 'today.EMPTY' | 'today.ALL_DONE';

// ─── Page ──────────────────────────────────────────────────────
Page({
  data: {
    testIds: TEST_IDS.p07,

    pageState: 'LOADING' as PageState,
    // 全部 0 初始 · 真 API 返回后填充 · 之前预置 MOCK_SLOTS + 8/3/1/4/38/72 是
    // 假数据穿透生产: EMPTY 时 wx:if 没遮 slots → mock 卡片 + 空状态同屏渲染
    slots: [] as SlotData[],
    totalCount: 0,
    doneCount: 0,
    inProgressCount: 0,
    waitCount: 0,
    estMinutes: 0,
    progressPct: 0,
    masteryPct: 0,

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

  // 从 P04 保存新题回来 / tab 切换回来 都要重新拉 · 保证 "我刚加的题" 立刻出现
  onShow() {
    if (this.data.pageState !== 'LOADING') {
      this._fetchToday();
    }
  },

  async _fetchToday() {
    try {
      const resp = await getToday('Asia/Shanghai');
      const items = resp.items;
      const total = resp.total;

      if (total === 0) {
        // 全部 hero 计数清零 · 防止上次的真数据残留 · 防 hero 显 8 但 slots 空 的不一致
        this.setData({
          pageState: 'today.EMPTY' as PageState,
          slots: [],
          totalCount: 0,
          doneCount: 0,
          inProgressCount: 0,
          waitCount: 0,
          estMinutes: 0,
          progressPct: 0,
        });
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
        // 真 builtSlots 即使是空数组也用 · 之前 builtSlots.length>0 ? : MOCK_SLOTS
        // fallback 会把假题塞进真有数据但分桶失败的场景 · 假装有题
        slots: builtSlots,
        totalCount: total,
        doneCount,
        inProgressCount,
        waitCount,
        estMinutes: Math.max(1, total * 3),
        progressPct,
        pageState: (doneCount === total ? 'today.ALL_DONE' : 'today.LIST') as PageState,
      });
    } catch (err) {
      // §9 降级: API 真失败时露白 · 不假装有 mock 复习题
      console.error('[P07] getToday failed:', err);
      this.setData({
        pageState: 'today.EMPTY' as PageState,
        slots: [],
        totalCount: 0,
        doneCount: 0,
        inProgressCount: 0,
        waitCount: 0,
      });
    }
  },

  onBackTap() {
    wx.navigateBack();
  },

  onItemTap(e: WechatMiniprogram.TouchEvent) {
    const nid = e.currentTarget.dataset.nid;
    wx.navigateTo({
      url: `/pages/review-exec/index?nid=${nid}`,
    });
  },

  // In-flight guard for "全部开始" CTA · 防双击触发两次 createSession + navigateTo:
  // 第二次会撞 BE / WeChat 导航 race · 弹 "启动失败" toast 让用户以为没生效。
  _starting: false as boolean,

  async onStartAllTap() {
    if (this._starting) return;
    this._starting = true;

    try {
      wx.vibrateShort({ type: 'light' });
    } catch { /* noop */ }

    try {
      const resp = await createSession({ tz: 'Asia/Shanghai' });
      const sid = resp.sid;
      if (!sid) {
        throw new Error('createSession: empty sid');
      }
      wx.navigateTo({
        url: `/pages/review-exec/index?sid=${sid}`,
        complete: () => { this._starting = false; },
      });
    } catch (err) {
      console.error('[P07] createSession failed:', err);
      wx.showToast({ title: '启动失败 · 请重试', icon: 'none' });
      this._starting = false;
    }
  },
});
