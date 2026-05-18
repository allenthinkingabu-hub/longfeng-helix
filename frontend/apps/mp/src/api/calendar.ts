/**
 * Calendar API client · 接 calendar-core (port 18080).
 *
 * 当前覆盖 P10 spec §5 #1 月范围查询:
 *   GET /api/calendar/events?month=YYYY-MM → {month, days:[{date, events:[...]}]}
 *
 * 未覆盖 (后续 task):
 *   - §5 #2 GET /api/calendar/events/{eid}  (P11 event detail)
 *   - §5 #3 PATCH /api/me/preferences      (filter chip 持久化)
 *   - §5 #4 POST /api/calendar/events/{eid}/subscribe (P09 关联 · 已有 BE 端)
 */
import { apiBase, httpJSON } from './_http';

// ── Wire shape (calendar-core CalendarEventResp record) ──────────────

export interface CalendarEventWire {
  id: number;
  relationType: string;        // 'STUDY' | 'EXAM' | 'FAMILY' | 'GENERIC'
  relationId: string;          // 'question:200:node:700' / 'family:xxx' / etc.
  ownerId: number;
  title: string;
  startAt: string;             // ISO8601
  endAt: string;               // ISO8601
  state: string;               // 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
  colorTag: string | null;     // hex '#FFC857' or null
  subscribed: boolean;
}

export interface CalendarDayBucketWire {
  date: string;                // 'YYYY-MM-DD'
  events: CalendarEventWire[];
}

export interface CalendarMonthRespWire {
  month: string;               // 'YYYY-MM' echo
  days: CalendarDayBucketWire[];
}

/**
 * GET /api/calendar/events?month=YYYY-MM · spec P10 §5 #1.
 *
 * BE 状态机 (§6): 5xx / parse error / 无 X-User-Id 均返 {month, days:[]} ·
 * FE 落 EMPTY 态而非 ERROR · 不阻塞浏览体验.
 */
export async function listMonthEvents(month: string): Promise<CalendarMonthRespWire> {
  // 2026-05-18 · X-User-Id 已由 _http.ts 默认注入 · 这里不再重复 header.
  const url = `${apiBase('calendar')}/api/calendar/events?month=${encodeURIComponent(month)}`;
  return httpJSON<CalendarMonthRespWire>(url);
}
