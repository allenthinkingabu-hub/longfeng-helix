/**
 * Unit test · P10 日历月视图 helpers
 * trace: pages/calendar/month/helpers.ts · design/system/pages/P10-calendar-month.spec.md
 *
 * 测试纯函数:
 *  - buildMonthCells: BE resp + 锚月 → 42 格 cells[] (含上/下月 spillover · today · selected)
 *  - eventToDotClass: STUDY/EXAM/FAMILY/GENERIC 色点映射
 *  - groupEventsByDate: bucket
 *  - formatMonthTitle / formatDayTitle / shiftMonth / todayIsoInTz
 *  - formatDayCountSummary
 */
import { describe, it, expect } from 'vitest';
import {
  buildMonthCells,
  eventToDotClass,
  formatDayCountSummary,
  formatDayTitle,
  formatMonthTitle,
  groupEventsByDate,
  shiftMonth,
} from '../../pages/calendar/month/helpers';
import type { CalendarEventWire, CalendarMonthRespWire } from '../../src/api/calendar';

function makeEvent(over: Partial<CalendarEventWire>): CalendarEventWire {
  // 注意: 不要用 ?? 兜底 colorTag · 否则 null override 被 fallback 吃掉 ·
  // 用 'in' 检查显式区分 "未传" vs "传 null".
  return {
    id: over.id ?? 1,
    relationType: over.relationType ?? 'STUDY',
    relationId: over.relationId ?? 'question:200:node:700',
    ownerId: 1,
    title: over.title ?? '测试题',
    startAt: over.startAt ?? '2026-05-18T08:00:00Z',
    endAt: '2026-05-18T08:30:00Z',
    state: 'SCHEDULED',
    colorTag: 'colorTag' in over ? (over.colorTag as string | null) : '#FFC857',
    subscribed: false,
  };
}

describe('buildMonthCells · 42-cell month grid', () => {
  it('returns exactly 42 cells', () => {
    const cells = buildMonthCells(null, '2026-05', '2026-05-18', '2026-05-18');
    expect(cells.length).toBe(42);
  });

  it('marks 2026-05-18 (Mon) as today + selected', () => {
    const cells = buildMonthCells(null, '2026-05', '2026-05-18', '2026-05-18');
    const today = cells.find((c) => c.date === '2026-05-18');
    expect(today?.isToday).toBe(true);
    expect(today?.isSelected).toBe(true);
    expect(today?.inCurrentMonth).toBe(true);
  });

  it('first cell is Monday of week containing May 1 (2026-04-27 Mon)', () => {
    // May 1 2026 is Friday · ISO week Mon = April 27
    const cells = buildMonthCells(null, '2026-05', '2026-05-18', '2026-05-18');
    expect(cells[0].date).toBe('2026-04-27');
    expect(cells[0].inCurrentMonth).toBe(false); // mute
  });

  it('cell with 3+ events: dots capped at 3, overflow=N-3', () => {
    const resp: CalendarMonthRespWire = {
      month: '2026-05',
      days: [
        {
          date: '2026-05-18',
          events: [
            makeEvent({ id: 1, relationType: 'STUDY', colorTag: '#FF3B30' }),
            makeEvent({ id: 2, relationType: 'EXAM' }),
            makeEvent({ id: 3, relationType: 'FAMILY' }),
            makeEvent({ id: 4, relationType: 'STUDY', colorTag: '#FF9500' }),
            makeEvent({ id: 5, relationType: 'STUDY', colorTag: '#34C759' }),
          ],
        },
      ],
    };
    const cells = buildMonthCells(resp, '2026-05', '2026-05-18', '2026-05-18');
    const today = cells.find((c) => c.date === '2026-05-18')!;
    expect(today.eventCount).toBe(5);
    expect(today.dotClasses.length).toBeLessThanOrEqual(3);
    expect(today.overflow).toBe(2);
  });

  it('weekend cells marked isWeekend=true (Sat/Sun)', () => {
    const cells = buildMonthCells(null, '2026-05', '2026-05-18', '2026-05-18');
    // 2026-05-02 (Sat) + 2026-05-03 (Sun)
    const sat = cells.find((c) => c.date === '2026-05-02');
    const sun = cells.find((c) => c.date === '2026-05-03');
    expect(sat?.isWeekend).toBe(true);
    expect(sun?.isWeekend).toBe(true);
  });

  it('null resp returns 42 cells with eventCount=0', () => {
    const cells = buildMonthCells(null, '2026-05', '2026-05-18', '2026-05-18');
    expect(cells.every((c) => c.eventCount === 0)).toBe(true);
  });

  it('selectedDate explicit override beats today', () => {
    const cells = buildMonthCells(null, '2026-05', '2026-05-18', '2026-05-22');
    const today = cells.find((c) => c.date === '2026-05-18');
    const selected = cells.find((c) => c.date === '2026-05-22');
    expect(today?.isToday).toBe(true);
    expect(today?.isSelected).toBe(false);
    expect(selected?.isSelected).toBe(true);
  });
});

describe('eventToDotClass · type → mockup color class', () => {
  it('EXAM → d-pnk', () => {
    expect(eventToDotClass(makeEvent({ relationType: 'EXAM' }))).toBe('d-pnk');
  });
  it('FAMILY → d-grn', () => {
    expect(eventToDotClass(makeEvent({ relationType: 'FAMILY' }))).toBe('d-grn');
  });
  it('STUDY with colorTag #FF3B30 (red) → d-red', () => {
    expect(eventToDotClass(makeEvent({ relationType: 'STUDY', colorTag: '#FF3B30' }))).toBe('d-red');
  });
  it('STUDY with colorTag #FFC857 (orange) → d-ora', () => {
    expect(eventToDotClass(makeEvent({ relationType: 'STUDY', colorTag: '#FFC857' }))).toBe('d-ora');
  });
  it('STUDY with unknown colorTag → d-blu (fallback)', () => {
    expect(eventToDotClass(makeEvent({ relationType: 'STUDY', colorTag: null }))).toBe('d-blu');
  });
  it('GENERIC / REMINDER → d-tea', () => {
    expect(eventToDotClass(makeEvent({ relationType: 'GENERIC' }))).toBe('d-tea');
    expect(eventToDotClass(makeEvent({ relationType: 'REMINDER' }))).toBe('d-tea');
  });
});

describe('groupEventsByDate · bucket', () => {
  it('null resp returns empty Map', () => {
    expect(groupEventsByDate(null).size).toBe(0);
  });
  it('buckets days[] by date', () => {
    const resp: CalendarMonthRespWire = {
      month: '2026-05',
      days: [
        { date: '2026-05-15', events: [makeEvent({ id: 1 })] },
        { date: '2026-05-22', events: [makeEvent({ id: 2 }), makeEvent({ id: 3 })] },
      ],
    };
    const map = groupEventsByDate(resp);
    expect(map.get('2026-05-15')?.length).toBe(1);
    expect(map.get('2026-05-22')?.length).toBe(2);
    expect(map.get('2026-05-30')).toBeUndefined();
  });
});

describe('format helpers', () => {
  it('formatMonthTitle "2026-05" → "2026 年 5 月"', () => {
    expect(formatMonthTitle('2026-05')).toBe('2026 年 5 月');
  });
  it('formatDayTitle "2026-05-18" → "5 月 18 日"', () => {
    expect(formatDayTitle('2026-05-18')).toBe('5 月 18 日');
  });
  it('shiftMonth("2026-05", -1) → "2026-04"; (+1) → "2026-06"', () => {
    expect(shiftMonth('2026-05', -1)).toBe('2026-04');
    expect(shiftMonth('2026-05', +1)).toBe('2026-06');
  });
  it('shiftMonth wraps year: "2026-01" -1 → "2025-12"; "2026-12" +1 → "2027-01"', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', +1)).toBe('2027-01');
  });
});

describe('formatDayCountSummary', () => {
  it('mixed counts: 3 STUDY + 1 EXAM + 2 FAMILY → "3 条复习 · 1 场考试 · 2 条家庭"', () => {
    const events: CalendarEventWire[] = [
      makeEvent({ id: 1, relationType: 'STUDY' }),
      makeEvent({ id: 2, relationType: 'STUDY' }),
      makeEvent({ id: 3, relationType: 'STUDY' }),
      makeEvent({ id: 4, relationType: 'EXAM' }),
      makeEvent({ id: 5, relationType: 'FAMILY' }),
      makeEvent({ id: 6, relationType: 'FAMILY' }),
    ];
    expect(formatDayCountSummary(events)).toBe('3 条复习 · 1 场考试 · 2 条家庭');
  });
  it('only STUDY → "5 条复习"', () => {
    const events: CalendarEventWire[] = Array.from({ length: 5 }, (_, i) =>
      makeEvent({ id: i, relationType: 'STUDY' }));
    expect(formatDayCountSummary(events)).toBe('5 条复习');
  });
  it('empty → "今日无事件"', () => {
    expect(formatDayCountSummary([])).toBe('今日无事件');
  });
});
