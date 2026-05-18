/**
 * P10 日历月视图 (CalendarMonth)
 * trace: design/system/pages/P10-calendar-month.spec.md · design/mockups/wrongbook/10_calendar_month.html
 *
 * 状态机 (spec §6):
 *   LOADING → READY (默认 today 选中) → DAY_SELECTED (tap 另日)
 *   LOADING → EMPTY (本月无事件)
 *   LOADING → ERROR (5xx · banner + retry)
 *
 * v1 MVP 覆盖:
 *   ✓ Nav title (年月 + tz + 周几) + 返回 P-HOME + prev/next/today 切月
 *   ✓ Weekday header (周一首列 · 周六/日红字)
 *   ✓ Month grid 42 格 (上/下月 spillover · today 蓝圆 · selected 白底 ·
 *     bar 计数 · ≤3 色点 · overflow "+N")
 *   ✓ Day list sheet (head 标题 + 计数 · row 复用 mockup tag/time 样式)
 *   ✓ Skeleton / Error banner / Empty 卡 (本月无安排)
 *
 * v1 暂缓 (后续 task):
 *   ⏸ Filter chip "显示复习" PATCH /api/me/preferences (跨域 user_setting)
 *   ⏸ Legend bar (mockup 未画 · spec §13 drift 提示)
 *   ⏸ Readonly banner (无 OBSERVER MVP 链路)
 *   ⏸ Subscribe (POST /events/{eid}/subscribe · P09 关联)
 *   ⏸ P11 跳转 (P11 未实装 · 临时 toast '事件详情开发中')
 */

import { TEST_IDS } from '@longfeng/testids';
import { listMonthEvents, type CalendarEventWire, type CalendarMonthRespWire } from '../../../src/api/calendar';
import {
  buildMonthCells,
  eventToDotClass,
  formatDayCountSummary,
  formatDayTitle,
  formatMonthTitle,
  formatRowTime,
  formatWeekdayCN,
  groupEventsByDate,
  shiftMonth,
  todayIsoInTz,
  type MonthCell,
} from './helpers';

interface EventRowVO {
  eventId: string;
  type: 'STUDY' | 'EXAM' | 'FAMILY' | 'GENERIC' | 'REMINDER';
  title: string;
  timeLabel: string;       // 'HH:mm' / '全天'
  subLabel: string;        // '数学 · 第 2 次' / '妈妈分享 · 全天'
  studyTag: string | null; // 'T1 复习' / null
  rowBarColor: string;     // CSS color (mockup row .bar3 inline)
  tagBg: string;           // mockup .tag inline · EXAM/FAMILY 时填 · STUDY 为 ''
  tagText: string;         // tag 中文 '考试' / '提醒'
  tagFg: string;           // .tag color
}

interface PageData {
  testIds: typeof TEST_IDS.p10;
  pageState: 'LOADING' | 'READY' | 'EMPTY' | 'ERROR';
  // Nav
  yearMonth: string;     // 'YYYY-MM'
  monthTitle: string;    // '2026 年 5 月'
  weekdayLabel: string;  // 'Asia/Shanghai · 周一'
  navTopPx: number;
  // Grid
  cells: MonthCell[];
  // Day sheet
  selectedDate: string;  // 'YYYY-MM-DD'
  dayTitle: string;      // '5 月 18 日'
  daySummary: string;    // '3 条复习 · 1 场考试'
  dayEvents: EventRowVO[];
}

const TZ = 'Asia/Shanghai';

Page<PageData, WechatMiniprogram.IAnyObject>({
  data: {
    testIds: TEST_IDS.p10,
    pageState: 'LOADING',
    yearMonth: '',
    monthTitle: '',
    weekdayLabel: '',
    navTopPx: 44,
    cells: [],
    selectedDate: '',
    dayTitle: '',
    daySummary: '',
    dayEvents: [],
  },

  // page-level cache of latest BE resp · 用于 tap 切日不重拉 + cell 重渲染
  _lastResp: null as CalendarMonthRespWire | null,

  onLoad(options: Record<string, string | undefined>) {
    // statusBarHeight 真值 · 与 P05 治 nav 状态栏挡同模式 (env() simulator 返 0).
    let navTopPx = 44;
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      navTopPx = (info as { statusBarHeight?: number }).statusBarHeight || 44;
    } catch { /* fallback 44 */ }

    // P-HOME 周条带 ?anchor=YYYY-MM-DD 入口 (spec §7 行 1 + biz §2A.3.3 第 7 条)
    const anchor = options.anchor;
    const today = todayIsoInTz(TZ);
    let yearMonth: string;
    let selectedDate: string;
    if (anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
      yearMonth = anchor.slice(0, 7);
      selectedDate = anchor;
    } else {
      yearMonth = today.slice(0, 7);
      selectedDate = today;
    }

    this.setData({
      navTopPx,
      yearMonth,
      monthTitle: formatMonthTitle(yearMonth),
      weekdayLabel: `${TZ} · ${formatWeekdayCN(today)}`,
      selectedDate,
    });
    this._fetchMonth(yearMonth, selectedDate);
  },

  async _fetchMonth(yearMonth: string, selectedDate: string) {
    this.setData({ pageState: 'LOADING' });
    try {
      const resp = await listMonthEvents(yearMonth);
      this._lastResp = resp;

      const today = todayIsoInTz(TZ);
      const cells = buildMonthCells(resp, yearMonth, today, selectedDate);

      const hasAny = (resp.days ?? []).some((d) => (d.events ?? []).length > 0);
      const pageState = hasAny ? 'READY' : 'EMPTY';

      this._renderDay(selectedDate, resp);
      this.setData({
        pageState,
        cells,
        // day sheet 由 _renderDay 已 setData · 这里只刷 grid 状态
      });
    } catch (err) {
      console.error('[P10] fetchMonth error:', err);
      this.setData({ pageState: 'ERROR' });
    }
  },

  /** 算 selectedDate 对应当日 sheet · 写入 dayTitle / daySummary / dayEvents. */
  _renderDay(date: string, respOverride?: CalendarMonthRespWire | null) {
    const resp = respOverride !== undefined ? respOverride : this._lastResp;
    const byDate = groupEventsByDate(resp ?? null);
    const events = byDate.get(date) ?? [];
    const dayEvents = events.map(toRowVO);
    this.setData({
      selectedDate: date,
      dayTitle: formatDayTitle(date),
      daySummary: formatDayCountSummary(events),
      dayEvents,
    });
  },

  // ── 用户操作 ───────────────────────────────────────────────────────

  onBackTap() {
    wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/home/index' }) });
  },

  onPrevMonth() {
    const next = shiftMonth(this.data.yearMonth, -1);
    this._switchToMonth(next);
  },
  onNextMonth() {
    const next = shiftMonth(this.data.yearMonth, +1);
    this._switchToMonth(next);
  },
  onTodayTap() {
    const today = todayIsoInTz(TZ);
    const ym = today.slice(0, 7);
    if (ym === this.data.yearMonth) {
      this._renderDay(today);
      // 重置 cells 选中态
      const cells = buildMonthCells(this._lastResp, ym, today, today);
      this.setData({ cells });
    } else {
      this._switchToMonth(ym, today);
    }
  },

  _switchToMonth(yearMonth: string, forcedSelected?: string) {
    const today = todayIsoInTz(TZ);
    // 切月时选中日: 强制日 > today 若在此月 > 此月 1 号
    const todayInYm = today.startsWith(yearMonth);
    const selectedDate = forcedSelected ?? (todayInYm ? today : `${yearMonth}-01`);
    this.setData({
      yearMonth,
      monthTitle: formatMonthTitle(yearMonth),
      selectedDate,
    });
    this._fetchMonth(yearMonth, selectedDate);
  },

  onCellTap(e: WechatMiniprogram.TouchEvent) {
    const date = e.currentTarget.dataset.date as string;
    if (!date) return;
    const today = todayIsoInTz(TZ);
    const cells = buildMonthCells(this._lastResp, this.data.yearMonth, today, date);
    this.setData({ cells });
    this._renderDay(date);
  },

  onEventTap(e: WechatMiniprogram.TouchEvent) {
    // P11 event-detail 未实装 · v1 临时 toast (spec §7 出口表行 1 路由 push P11)
    const eventId = e.currentTarget.dataset.eid as string;
    wx.showToast({
      title: '事件详情开发中',
      icon: 'none',
      duration: 1500,
    });
    // 埋点 (spec §12 calendar_event_tap)
    console.log('[P10] calendar_event_tap', { eventId });
  },

  onSheetAllTap() {
    // spec §7 出口表行 2: tap "全部 ›" → P07 /review?date=YYYY-MM-DD
    // 当前 P07 不支持 ?date= filter (后续 task) · 暂跳 P07 默认队列 + 占位 toast.
    wx.switchTab({ url: '/pages/review-today/index' });
  },

  onRetryTap() {
    this._fetchMonth(this.data.yearMonth, this.data.selectedDate);
  },

  onCaptureTap() {
    // EMPTY 态 CTA · spec §9 行 2 "本月无安排 · 去拍一道" → P02
    wx.switchTab({ url: '/pages/capture/index' });
  },
});

// ── 行 VO 构造 (mockup row 4 形态 · STUDY / EXAM / FAMILY / GENERIC) ─

function toRowVO(e: CalendarEventWire): EventRowVO {
  const type = (e.relationType || 'GENERIC').toUpperCase() as EventRowVO['type'];
  const rowBarColor = barColorFromDot(eventToDotClass(e));
  let studyTag: string | null = null;
  let tagBg = '';
  let tagFg = '';
  let tagText = '';
  let subLabel = '';

  if (type === 'STUDY') {
    // STUDY tag 形如 'T1 复习' · 老数据 colorTag=#FFC857 对应 T1..T6 不精确 ·
    // BE 后续应在 relationId 加 'node:N' 后缀 (已有: 'question:200:node:700') ·
    // 这里粗解 nodeIndex 给 FE 显示, 解析失败 fallback 'T 复习'.
    const nodeIdx = parseNodeIndexFromRelationId(e.relationId);
    studyTag = nodeIdx != null ? `T${nodeIdx + 1} 复习` : '复习';
    subLabel = e.title; // 题目标题 · BE title 字段
  } else if (type === 'EXAM') {
    tagText = '考试';
    tagBg = 'rgba(255,45,85,.14)';
    tagFg = '#C71F47';
    subLabel = '全天';
  } else if (type === 'FAMILY') {
    tagText = '提醒';
    tagBg = 'rgba(52,199,89,.14)';
    tagFg = '#1E7E34';
    subLabel = e.title;
  } else {
    tagText = '事件';
    tagBg = 'rgba(120,120,128,.14)';
    tagFg = '#3C3C43';
    subLabel = e.title;
  }

  return {
    eventId: String(e.id),
    type,
    title: type === 'STUDY' ? e.title : e.title,
    timeLabel: formatRowTime(e.startAt, TZ),
    subLabel,
    studyTag,
    rowBarColor,
    tagBg,
    tagText,
    tagFg,
  };
}

function barColorFromDot(dot: string): string {
  switch (dot) {
    case 'd-red': return '#FF3B30';
    case 'd-ora': return '#FF9500';
    case 'd-grn': return '#34C759';
    case 'd-ind': return '#5856D6';
    case 'd-ylw': return '#FFCC00';
    case 'd-pnk': return '#FF2D55';
    case 'd-tea': return '#30B0C7';
    case 'd-blu': return '#007AFF';
    default: return '#8E8E93';
  }
}

function parseNodeIndexFromRelationId(rid: string | null | undefined): number | null {
  if (!rid) return null;
  const m = /node:(\d+)/.exec(rid);
  if (!m) return null;
  // BE 老数据 nodeIndex (DB 字段) 已 0-based · 我们这里 FE 不再 +1 而是直接展示 T{n+1}.
  // 但 relationId 形如 'question:200:node:700' 时 700 是节点 PK 不是 index ·
  // 暂时 fallback null (老数据 / 不可解析时 studyTag 只显 '复习').
  const idx = Number(m[1]);
  if (!Number.isFinite(idx) || idx >= 100) return null;
  return idx;
}
