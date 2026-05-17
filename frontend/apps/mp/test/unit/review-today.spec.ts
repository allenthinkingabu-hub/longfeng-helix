/**
 * Unit test · P07 review-today pure helpers
 * 0 mock · 0 backend · 100% pass
 *
 * Tests buildCountdown, formatHHMM, getSlotKey, getSlotTitle, buildSlotsFromItems
 * These are the core business logic functions extracted for testability.
 */
import { describe, it, expect } from 'vitest';

import {
  buildCountdown,
  formatHHMM,
  getSlotKey,
  getSlotTitle,
  getSlotIconClass,
  buildSlotsFromItems,
} from '../../pages/review-today/helpers';

// ── buildCountdown ──────────────────────────────────────────────

describe('buildCountdown (pure logic · no backend)', () => {
  it('≤ 15 min → state "now", label "X 分钟"', () => {
    const result = buildCountdown(4);
    expect(result.state).toBe('now');
    expect(result.label).toBe('4 分钟');
  });

  it('0 min → "0 分钟" (never negative)', () => {
    const result = buildCountdown(-5);
    expect(result.state).toBe('now');
    expect(result.label).toBe('0 分钟');
  });

  it('15 min boundary → still "now"', () => {
    expect(buildCountdown(15).state).toBe('now');
  });

  it('16-120 min → state "soon", label in hours', () => {
    const result = buildCountdown(60);
    expect(result.state).toBe('soon');
    expect(result.label).toBe('1 h');
  });

  it('120 min boundary → still "soon"', () => {
    expect(buildCountdown(120).state).toBe('soon');
  });

  it('> 120 min → state "wait", label "X h Y m"', () => {
    const result = buildCountdown(375); // 6h 15m
    expect(result.state).toBe('wait');
    expect(result.label).toBe('6 h 15 m');
  });

  it('exact hours → no trailing "m"', () => {
    const result = buildCountdown(300); // 5h 0m
    expect(result.state).toBe('wait');
    expect(result.label).toBe('5 h');
  });
});

// ── formatHHMM ──────────────────────────────────────────────────

describe('formatHHMM (pure)', () => {
  it('pads single-digit hours and minutes', () => {
    expect(formatHHMM(new Date('2026-04-21T09:05:00'))).toBe('09:05');
  });

  it('does not pad double-digit hours', () => {
    expect(formatHHMM(new Date('2026-04-21T14:30:00'))).toBe('14:30');
  });

  it('midnight → 00:00', () => {
    expect(formatHHMM(new Date('2026-04-21T00:00:00'))).toBe('00:00');
  });
});

// ── getSlotKey ──────────────────────────────────────────────────

describe('getSlotKey (pure)', () => {
  it('hour < 12 → "now"', () => {
    expect(getSlotKey(9)).toBe('now');
    expect(getSlotKey(0)).toBe('now');
    expect(getSlotKey(11)).toBe('now');
  });

  it('hour 12-17 → "afternoon"', () => {
    expect(getSlotKey(12)).toBe('afternoon');
    expect(getSlotKey(14)).toBe('afternoon');
    expect(getSlotKey(17)).toBe('afternoon');
  });

  it('hour >= 18 → "evening"', () => {
    expect(getSlotKey(18)).toBe('evening');
    expect(getSlotKey(23)).toBe('evening');
  });
});

// ── getSlotTitle ────────────────────────────────────────────────

describe('getSlotTitle (pure)', () => {
  it('"now" → "现在 · 上午"', () => {
    expect(getSlotTitle('now')).toBe('现在 · 上午');
  });
  it('"afternoon" → "下午"', () => {
    expect(getSlotTitle('afternoon')).toBe('下午');
  });
  it('"evening" → "晚上"', () => {
    expect(getSlotTitle('evening')).toBe('晚上');
  });
});

// ── getSlotIconClass ────────────────────────────────────────────

describe('getSlotIconClass (pure)', () => {
  it('maps slot keys to CSS classes', () => {
    expect(getSlotIconClass('now')).toBe('slotIconYellow');
    expect(getSlotIconClass('afternoon')).toBe('slotIconBlue');
    expect(getSlotIconClass('evening')).toBe('slotIconIndigo');
  });
});

// ── buildSlotsFromItems ─────────────────────────────────────────

describe('buildSlotsFromItems (pure · integration of all helpers)', () => {
  const now = new Date('2026-04-21T09:41:00');

  const makeItem = (id: number, nodeIndex: number, nextDueAt: string) => ({
    id,
    wrongItemId: 100 + id,
    studentId: 1,
    nodeIndex,
    easeFactor: 2.5,
    intervalDays: 1,
    nextDueAt,
    completedAt: null,
    mastered: false,
  });

  it('groups morning items into "now" slot', () => {
    const items = [
      makeItem(1, 1, '2026-04-21T09:45:00'),
      makeItem(2, 3, '2026-04-21T11:00:00'),
    ];
    const slots = buildSlotsFromItems(items, now);
    expect(slots).toHaveLength(1);
    expect(slots[0].key).toBe('now');
    expect(slots[0].items).toHaveLength(2);
  });

  it('groups afternoon items into "afternoon" slot', () => {
    const items = [
      makeItem(3, 4, '2026-04-21T14:30:00'),
      makeItem(4, 2, '2026-04-21T16:00:00'),
    ];
    const slots = buildSlotsFromItems(items, now);
    expect(slots).toHaveLength(1);
    expect(slots[0].key).toBe('afternoon');
    expect(slots[0].items).toHaveLength(2);
  });

  it('mixed times → multiple slots in order', () => {
    const items = [
      makeItem(1, 1, '2026-04-21T09:45:00'),
      makeItem(3, 4, '2026-04-21T14:30:00'),
      makeItem(5, 0, '2026-04-21T20:00:00'),
    ];
    const slots = buildSlotsFromItems(items, now);
    expect(slots.map(s => s.key)).toEqual(['now', 'afternoon', 'evening']);
  });

  it('empty items → empty slots', () => {
    expect(buildSlotsFromItems([], now)).toEqual([]);
  });

  it('countdown state for items near now', () => {
    const items = [makeItem(1, 1, '2026-04-21T09:45:00')]; // 4 min from now
    const slots = buildSlotsFromItems(items, now);
    expect(slots[0].items[0].countdownState).toBe('now');
    expect(slots[0].items[0].countdownLabel).toBe('4 分钟');
  });

  it('tLevel format matches T{nodeIndex}', () => {
    const items = [makeItem(1, 3, '2026-04-21T10:00:00')];
    const slots = buildSlotsFromItems(items, now);
    expect(slots[0].items[0].tLevel).toBe('T3');
  });

  it('hhmm formatting with padding', () => {
    const items = [makeItem(1, 0, '2026-04-21T09:05:00')];
    const slots = buildSlotsFromItems(items, now);
    expect(slots[0].items[0].hhmm).toBe('09:05');
  });

  // 用户反馈: hero 显 "1 进行中 / 1 未开始" 但卡片无标识 · 用户分不清是哪条 ·
  // 这组测试锁住卡片 progress 与 hero 计数同口径 (index.ts 内同 if-else 分支)
  it('progress: mastered=true → 已完成', () => {
    const item = { ...makeItem(1, 1, '2026-04-21T09:45:00'), mastered: true, completedAt: '2026-04-21T09:30:00' };
    const slots = buildSlotsFromItems([item], now);
    expect(slots[0].items[0].progress).toBe('done');
    expect(slots[0].items[0].progressLabel).toBe('已完成');
  });

  it('progress: !mastered && !completedAt → 未开始', () => {
    const item = { ...makeItem(1, 1, '2026-04-21T09:45:00'), mastered: false, completedAt: null };
    const slots = buildSlotsFromItems([item], now);
    expect(slots[0].items[0].progress).toBe('wait');
    expect(slots[0].items[0].progressLabel).toBe('未开始');
  });

  it('progress: !mastered && completedAt → 进行中 (PARTIAL/FORGOT 已答但未掌握)', () => {
    const item = { ...makeItem(1, 1, '2026-04-21T09:45:00'), mastered: false, completedAt: '2026-04-21T09:30:00' };
    const slots = buildSlotsFromItems([item], now);
    expect(slots[0].items[0].progress).toBe('inprogress');
    expect(slots[0].items[0].progressLabel).toBe('进行中');
  });
});
