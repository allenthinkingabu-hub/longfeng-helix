// P07 · 今日待复习 (review-today) · T09 stub + T10 tap→exec transition
// trace: design/mockups/wrongbook/07_review_today.html → 08_review_exec.html
// H5 sibling: frontend/apps/h5/src/pages/ReviewToday/index.tsx
//
// T10 scope: item tap → createSession → wx.navigateTo('/pages/review-exec/index?sid=X&nid=Y')
//            + "全部开始" CTA → createSession → first nid

import { createSession, getToday } from '../../src/api/review';
import type { ReviewPlanDto } from '../../src/api/review';
import { extractNidFromTap, buildExecUrl } from './helpers';

// Re-export for backward compat (transition tests may import from index)
export { extractNidFromTap, buildExecUrl } from './helpers';

// ─── Types ──────────────────────────────────────────────────────
interface ItemData {
  nid: string;
  tLevel: string;
  hhmm: string;
  subject: string;
  kp: string;
  stem: string;
  countdownState: string;
  countdownLabel: string;
  sideColor: string;
}

// ─── Mock items (frontend dev fallback · matches mockup) ────────
const MOCK_ITEMS: ItemData[] = [
  {
    nid: '1001', tLevel: 'T1', hhmm: '09:45', subject: '数学', kp: '二次函数 · 顶点式',
    stem: '已知 f(x)=x²−4x+3，求顶点坐标与对称轴。', countdownState: 'now', countdownLabel: '4 分钟', sideColor: 'red',
  },
  {
    nid: '1002', tLevel: 'T3', hhmm: '11:00', subject: '物理', kp: '欧姆定律 · 并联',
    stem: 'R₁=4Ω, R₂=6Ω 并联接 12V，求总电流。', countdownState: 'soon', countdownLabel: '1 h', sideColor: 'orange',
  },
  {
    nid: '1003', tLevel: 'T4', hhmm: '14:30', subject: '化学', kp: '方程配平',
    stem: 'Al + HCl → AlCl₃ + H₂', countdownState: 'wait', countdownLabel: '5 h', sideColor: 'indigo',
  },
  {
    nid: '1004', tLevel: 'T2', hhmm: '16:00', subject: '英语', kp: 'past perfect',
    stem: 'By the time he arrived, the meeting ___ already started.', countdownState: 'wait', countdownLabel: '6 h 15 m', sideColor: 'green',
  },
];

// ─── Page ──────────────────────────────────────────────────────
Page({
  _isNavigating: false,

  data: {
    items: MOCK_ITEMS,
    total: 8,
    doneCount: 3,
    inProgressCount: 1,
    waitCount: 4,
    estMinutes: 25,
    progressPct: 38,
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
      if (items.length === 0) return;

      const mapped: ItemData[] = items.map((item: ReviewPlanDto) => {
        const due = new Date(item.nextDueAt);
        const hh = due.getHours();
        const mm = due.getMinutes();
        return {
          nid: String(item.id),
          tLevel: `T${item.nodeIndex}`,
          hhmm: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
          subject: '',
          kp: '',
          stem: `节点 #${item.id}`,
          countdownState: 'wait',
          countdownLabel: '',
          sideColor: 'blue',
        };
      });

      this.setData({
        items: mapped,
        total: resp.data.total,
      });
    } catch {
      // §9 降级: keep mock data
    }
  },

  // ── T10: item tap → review-exec ───────────────────────────────
  async onItemTap(e: WechatMiniprogram.TouchEvent) {
    if (this._isNavigating) return;

    const nid = extractNidFromTap(e);
    if (!nid) return;

    this._isNavigating = true;
    wx.vibrateShort({ type: 'light' });

    try {
      const resp = await createSession({ node_ids: [Number(nid)], tz: 'Asia/Shanghai' });
      const sid = resp.data.sid;
      wx.navigateTo({ url: buildExecUrl(sid, nid) });
    } catch {
      wx.showToast({ title: '启动失败 · 请重试', icon: 'none' });
    } finally {
      this._isNavigating = false;
    }
  },

  // ── T10: "全部开始" CTA → createSession → first nid ──────────
  async onStartAllTap() {
    if (this._isNavigating) return;
    this._isNavigating = true;
    wx.vibrateShort({ type: 'light' });

    try {
      const resp = await createSession({ tz: 'Asia/Shanghai' });
      const sid = resp.data.sid;
      const firstNid = resp.data.nids.length > 0 ? String(resp.data.nids[0]) : '0';
      wx.navigateTo({ url: buildExecUrl(sid, firstNid) });
    } catch {
      wx.showToast({ title: '启动失败 · 请重试', icon: 'none' });
    } finally {
      this._isNavigating = false;
    }
  },

  onBackTap() {
    wx.navigateBack();
  },
});
