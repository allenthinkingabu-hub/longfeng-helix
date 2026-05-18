/**
 * P10 日历月视图 helpers (纯函数 · 给后续 unit test 直接覆盖)
 *
 * 职责:
 *   1. buildMonthCells: BE {days[]} + 锚月 → 42 格 cells[] (含上/下月 spillover)
 *   2. relationToDotClass: 事件 relationType / subject → mockup 色点 class
 *   3. groupEventsByDate: 把 days[] 拍平成 Map<dateISO, events[]> 便于查询
 *   4. formatMonthTitle / formatDayTitle / formatRowTime: i18n 字符串
 *
 * 锚 spec §2.2 + mockup 10_calendar_month.html L46-L66 (色点 class) + L156-L189 (42 格布局).
 */

import type { CalendarEventWire, CalendarMonthRespWire } from '../../../src/api/calendar';

// ── 月历 42 格 ───────────────────────────────────────────────────────

/** spec §2.1 + mockup .cell 状态 · 每格的真渲染数据. */
export interface MonthCell {
  /** 'YYYY-MM-DD' · 用于 tap dispatch + locating events. */
  date: string;
  /** Day-of-month (1..31) · 显示在 .d 上. */
  day: number;
  /** 是否当前月 · 否则 .mute 灰显. */
  inCurrentMonth: boolean;
  /** 周六/日 · .we 红字 (锚 mockup L47 .weekdays .we). */
  isWeekend: boolean;
  /** 是否今日 · 蓝圆 (锚 mockup L57 .cell.today). */
  isToday: boolean;
  /** 是否选中 (DAY_SELECTED 态 · 锚 mockup L59 .cell.selected). */
  isSelected: boolean;
  /** 事件总数 · 用于 .bar 右上角胶囊 (= dots.length + overflow). */
  eventCount: number;
  /** ≤3 色点 class · 锚 mockup L62-66 d-red/d-ora/d-grn/d-ind 等. */
  dotClasses: string[];
  /** 溢出数 (eventCount > 3 时为 eventCount - 3 · 否则 0). */
  overflow: number;
}

/**
 * BE 月查询响应 + 锚月 → 42 格 MonthCell[].
 *
 * 规则:
 *   - 锚月: yearMonth='YYYY-MM' (默认本月)
 *   - 首格: 锚月 1 号所在周的周一 (即可能是上月某日)
 *   - 末格: 首格 +41 天 (固定 6 行 × 7 列 = 42 · 与 mockup L152-L192 完全一致)
 *   - selectedDate: 默认 today (若 today 不在 yearMonth 内则默认锚月 1 号)
 *
 * @param resp BE /api/calendar/events?month=YYYY-MM 响应 · null 当作空月
 * @param yearMonth 锚 'YYYY-MM' · ISO
 * @param today ISO date 'YYYY-MM-DD' · today 高亮 · 通常调用 new Date().toISOString().slice(0,10)
 * @param selectedDate ISO date 'YYYY-MM-DD' · 选中态 · null 用 today
 */
export function buildMonthCells(
  resp: CalendarMonthRespWire | null,
  yearMonth: string,
  today: string,
  selectedDate: string | null,
): MonthCell[] {
  const [yStr, mStr] = yearMonth.split('-');
  const year = Number(yStr);
  const month = Number(mStr); // 1..12

  // 锚月 1 号是星期几 (1=Mon..7=Sun) — Date.getDay() 是 0=Sun..6=Sat · 转换:
  const firstDay = new Date(year, month - 1, 1);
  const isoWeekday1 = ((firstDay.getDay() + 6) % 7) + 1; // 1..7

  // 首格 (week starts Mon · 与 mockup L151 "一 二 三 四 五 六 日" 一致)
  const startDate = new Date(year, month - 1, 1 - (isoWeekday1 - 1));

  // 事件按日 bucket
  const byDate = groupEventsByDate(resp);

  // 选中日: 优先用户给的 selectedDate; 否则 today (若 today 在锚月内); 否则锚月 1 号
  const todayInAnchor = today.startsWith(yearMonth);
  const selected = selectedDate ?? (todayInAnchor ? today : `${yearMonth}-01`);

  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const iso = toIsoDate(d);
    const events = byDate.get(iso) ?? [];
    const dots = events.slice(0, 3).map(eventToDotClass);
    const dotsDedup = dedupKeepOrder(dots);
    const dotsCapped = dotsDedup.slice(0, 3);

    cells.push({
      date: iso,
      day: d.getDate(),
      inCurrentMonth: d.getFullYear() === year && d.getMonth() === month - 1,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: iso === today,
      isSelected: iso === selected,
      eventCount: events.length,
      dotClasses: dotsCapped,
      overflow: events.length > 3 ? events.length - 3 : 0,
    });
  }
  return cells;
}

/** Map<'YYYY-MM-DD', events[]> · 便于 cell + sheet 双消费. */
export function groupEventsByDate(resp: CalendarMonthRespWire | null): Map<string, CalendarEventWire[]> {
  const out = new Map<string, CalendarEventWire[]>();
  if (!resp || !resp.days) return out;
  for (const day of resp.days) {
    if (!day || !day.date) continue;
    out.set(day.date, day.events ?? []);
  }
  return out;
}

// ── 色点映射 ─────────────────────────────────────────────────────────

/**
 * Event → mockup 色点 CSS class (锚 mockup L64-L66).
 *
 * 规则 (spec §3 DayCell ColorDot + mockup 实例):
 *   - STUDY (复习节点): subject 决定颜色
 *       · math    → d-red    (mockup 1 号 .d-red)
 *       · physics → d-ora    (mockup 2 号 .d-ora)
 *       · english → d-ind    (mockup 22 号 .d-ind 靛蓝)
 *       · chemistry → d-grn  (mockup 13 号 .d-grn)
 *       · 其他 / unknown → d-blu (退化)
 *   - EXAM (考试): d-pnk (mockup 4 号 .d-pnk 粉)
 *   - FAMILY (家庭): d-grn (mockup row 4 接奶奶 · 绿 提醒)
 *   - REMINDER / GENERIC: d-tea (青)
 *
 * subject 从 relationId 解析 (relationId 形如 'question:200:node:700' 时无 subject ·
 * 仅 STUDY 走 colorTag 退化 · 老数据 colorTag=#FFC857 一律返 d-ora).
 */
export function eventToDotClass(event: CalendarEventWire): string {
  const type = (event.relationType || 'GENERIC').toUpperCase();
  if (type === 'EXAM') return 'd-pnk';
  if (type === 'FAMILY') return 'd-grn';
  if (type === 'STUDY') {
    // subject 待 BE 在 CalendarEventResp 加 subject 字段 (后续 task) · 现 fallback colorTag.
    return colorTagToDotClass(event.colorTag) ?? 'd-blu';
  }
  return 'd-tea';
}

/** colorTag '#FFC857' / '#FF3B30' → 最近的 mockup 色点 class. */
function colorTagToDotClass(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const t = tag.toUpperCase().replace('#', '');
  // 与 mockup --red/--orange/--green/--indigo/--yellow 配
  if (t.startsWith('FF3B30') || t.startsWith('FF453A')) return 'd-red';
  if (t.startsWith('FF9500') || t.startsWith('FFC857')) return 'd-ora';
  if (t.startsWith('34C759') || t.startsWith('30D158')) return 'd-grn';
  if (t.startsWith('5856D6') || t.startsWith('7D7AFF')) return 'd-ind';
  if (t.startsWith('FFCC00') || t.startsWith('FFD60A')) return 'd-ylw';
  if (t.startsWith('FF2D55')) return 'd-pnk';
  if (t.startsWith('30B0C7')) return 'd-tea';
  return null;
}

// ── 行渲染 (sheet) ───────────────────────────────────────────────────

/** sheet head 字符 · '8 条复习 · 1 场考试 · 1 条家庭' (mockup L199). */
export function formatDayCountSummary(events: CalendarEventWire[]): string {
  let study = 0; let exam = 0; let family = 0;
  for (const e of events) {
    const t = (e.relationType || '').toUpperCase();
    if (t === 'STUDY') study++;
    else if (t === 'EXAM') exam++;
    else if (t === 'FAMILY') family++;
  }
  const parts: string[] = [];
  if (study > 0) parts.push(`${study} 条复习`);
  if (exam > 0) parts.push(`${exam} 场考试`);
  if (family > 0) parts.push(`${family} 条家庭`);
  if (parts.length === 0) return '今日无事件';
  return parts.join(' · ');
}

/** Sheet head 标题 '4 月 21 日'. */
export function formatDayTitle(iso: string): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${Number(m)} 月 ${Number(d)} 日`;
}

/** Nav title '2026 年 4 月'. */
export function formatMonthTitle(yearMonth: string): string {
  if (!yearMonth) return '';
  const [y, m] = yearMonth.split('-');
  return `${y} 年 ${Number(m)} 月`;
}

/** Sub-nav weekday '周二'. */
export function formatWeekdayCN(iso: string): string {
  if (!iso) return '';
  const d = parseIsoDateLocal(iso);
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[d.getDay()];
}

/** Row time 'HH:mm' · 输入 ISO8601 string. */
export function formatRowTime(iso: string, tz: string = 'Asia/Shanghai'): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const fmt = new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    });
    return fmt.format(d);
  } catch {
    return iso.slice(11, 16);
  }
}

// ── 月切换 ───────────────────────────────────────────────────────────

/** 'YYYY-MM' → 上 / 下月 'YYYY-MM'. */
export function shiftMonth(yearMonth: string, delta: number): string {
  const [yStr, mStr] = yearMonth.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** today ISO date in tz · 形如 '2026-05-18'. */
export function todayIsoInTz(tz: string = 'Asia/Shanghai', now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(now);
}

// ── 内部 ─────────────────────────────────────────────────────────────

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function dedupKeepOrder<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of arr) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}
