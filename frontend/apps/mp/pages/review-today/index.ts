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
// P07-D · 排序模式 · 桶内 (时段) sort 顺序 · 桶分组本身不变
// 默认 time (按 nextDueAt ASC · BE 已经如此返回 · 不动)
type SortMode = 'time' | 'tlevel' | 'subject';
const SORT_LABEL: Record<SortMode, string> = {
  time: '时间', tlevel: 'T 级', subject: '学科',
};

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

    // P07-D · 排序状态 · onShow / onLoad 不重置 · onSortTap 改
    sortMode: 'time' as SortMode,
    sortLabel: SORT_LABEL.time,
    // 缓存最近一次 getToday items · onSortTap 切换 mode 时不重发请求
    _rawItems: [] as import('../../src/api/review').ReviewPlanDto[],
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
      const builtSlots = buildSlotsFromItems(items, now, this.data.sortMode);
      // P07 spec L94 严格口径: doneCount = GRADED (= completedAt != null) ·
      // 不再用 mastered (BE ReviewPlanDto 根本不返这个字段 → undefined → 永远 0%).
      // 任务完成度 (progressPct) 与 掌握度 (masteryPct · BE 算 · ease 聚合) 是两个独立维度.
      // 4 题都已 grade (含 PARTIAL/FORGOT) → 进度 100%, 掌握度由 ease 反映.
      const doneCount = items.filter(i => i.completedAt).length;
      const waitCount = items.filter(i => !i.completedAt).length;
      // 进行中 = OPEN 未 grade · BE 现实不返该状态 → 永远 0 · 保留 hero label 占位
      const inProgressCount = total - doneCount - waitCount;
      const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

      // P07-A · masteryPct 直接用 BE 返值 (spec L98 · ease_factor 聚合).
      // BE 未实现/历史接口字段缺失时回退 0% · 不假装有 mastery.
      const masteryPct = typeof resp.masteryPct === 'number' ? resp.masteryPct : 0;

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
        masteryPct,
        _rawItems: items,
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

  // P07 ALL_DONE 态 CTA · spec §6 状态机 ALL_DONE → 跳 P-HOME ·
  // P07 是 tabBar 页 · 不能 navigateBack · 用 switchTab.
  onBackHome() {
    wx.switchTab({ url: '/pages/home/index' });
  },

  // P07-D · 右上 "排序 · {mode}" tap · ActionSheet 3 选项
  // 桶分组 (上午/下午/晚上) 不动 · 仅桶内 sort 顺序变.
  // spec/biz 都没具体定义这个 chip · 这里就定一份 "时间/T级/学科" 作为初版.
  onSortTap() {
    const modes: SortMode[] = ['time', 'tlevel', 'subject'];
    wx.showActionSheet({
      itemList: modes.map(m => `按${SORT_LABEL[m]}排序`),
      success: (res) => {
        const picked = modes[res.tapIndex];
        if (!picked || picked === this.data.sortMode) return;
        const now = new Date();
        const builtSlots = buildSlotsFromItems(this.data._rawItems, now, picked);
        this.setData({
          sortMode: picked,
          sortLabel: SORT_LABEL[picked],
          slots: builtSlots,
        });
      },
      fail: () => { /* user cancel · noop */ },
    });
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
