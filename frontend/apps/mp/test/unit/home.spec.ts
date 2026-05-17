/**
 * Unit test · P-HOME pure logic (no HTTP · no backend · no wx)
 * 0 mock · 100% pass · red line
 *
 * Tests buildGreeting, computeCirclePct, derivePageState — pure functions
 * exported from pages/home/index.ts for testability.
 */
import { describe, it, expect } from 'vitest';

import {
  SUBJECT_COLORS,
  buildCurrentWeekStrip,
  buildGreeting,
  buildSubjectsFromItems,
  computeCirclePct,
  derivePageState,
} from '../../pages/home/helpers';

// ── buildGreeting ───────────────────────────────────────────────

describe('buildGreeting (pure · time-dependent)', () => {
  it('returns a string containing day of week + month + date', () => {
    const result = buildGreeting();
    // Always contains "月" and "日" (Chinese date format)
    expect(result).toContain('月');
    expect(result).toContain('日');
  });

  it('contains a separator dot · between parts', () => {
    const result = buildGreeting();
    expect(result).toContain(' · ');
  });

  it('ends with a period-of-day greeting', () => {
    const result = buildGreeting();
    // Must end with one of: 早安 / 下午好 / 晚上好
    expect(result).toMatch(/(早安|下午好|晚上好)$/);
  });

  it('contains day name from 周一..周日', () => {
    const result = buildGreeting();
    expect(result).toMatch(/周[一二三四五六日]/);
  });
});

// ── computeCirclePct ────────────────────────────────────────────

describe('computeCirclePct (pure)', () => {
  it('returns 0 when total is 0', () => {
    expect(computeCirclePct(0, 0)).toBe(0);
  });

  it('returns 100 when done equals total', () => {
    expect(computeCirclePct(8, 8)).toBe(100);
  });

  it('returns 50 for half done', () => {
    expect(computeCirclePct(4, 8)).toBe(50);
  });

  it('rounds to nearest integer', () => {
    // 3/8 = 37.5 → 38
    expect(computeCirclePct(3, 8)).toBe(38);
  });

  it('returns 0 when done is 0', () => {
    expect(computeCirclePct(0, 10)).toBe(0);
  });

  it('handles large numbers', () => {
    expect(computeCirclePct(999, 1000)).toBe(100);
  });
});

// ── derivePageState ─────────────────────────────────────────────

describe('derivePageState (pure)', () => {
  const makeData = (total: number, done = 0) => ({
    total,
    done,
    items: [],
    tz: 'Asia/Shanghai',
  });

  it('returns LOADING when data is null and no error', () => {
    expect(derivePageState(null, false)).toBe('LOADING');
  });

  it('returns ERROR when data is null and hasError', () => {
    expect(derivePageState(null, true)).toBe('ERROR');
  });

  it('returns EMPTY when total is 0', () => {
    expect(derivePageState(makeData(0), false)).toBe('EMPTY');
  });

  it('returns READY when total > 0', () => {
    expect(derivePageState(makeData(8, 3), false)).toBe('READY');
  });

  it('returns READY even if hasError but data exists', () => {
    // Graceful degradation: stale data shown
    expect(derivePageState(makeData(5), true)).toBe('READY');
  });

  it('EMPTY takes precedence over error when data.total = 0', () => {
    expect(derivePageState(makeData(0), true)).toBe('EMPTY');
  });
});

// ── buildCurrentWeekStrip (B4 · B5 pure) ─────────────────────────
// 修复点回归 (intent encoded):
//   B4 — 周一→周日 d 值必须连续 · 旧硬编码周二/周三 d=22 重复是 bug
//   B5 — label 与 days 必须随 now 动态变化 · 旧硬编码 "4 月 20-26 日" 与今天 (2026-05-16 周六) 不符

describe('buildCurrentWeekStrip (B4 + B5 · pure)', () => {
  it('returns 7 days, 周一→周日 order', () => {
    const strip = buildCurrentWeekStrip(new Date(2026, 4, 16)); // 2026-05-16 周六
    expect(strip.days).toHaveLength(7);
    expect(strip.days.map((d) => d.w)).toEqual(['一', '二', '三', '四', '五', '六', '日']);
  });

  it('B4 regression · 周一-周日 d values are 7 distinct consecutive numbers (no 22-duplicate)', () => {
    const strip = buildCurrentWeekStrip(new Date(2026, 4, 16)); // 周六 → Mon=5/11 ... Sun=5/17
    const ds = strip.days.map((d) => parseInt(d.d, 10));
    expect(new Set(ds).size).toBe(7); // 全部不重复
    for (let i = 1; i < ds.length; i++) {
      expect(ds[i] - ds[i - 1]).toBe(1); // 严格连续
    }
  });

  it('B5 regression · today is 周六 → days[5].today === true · others false', () => {
    // buildCurrentWeekStrip 第 2 参 todayBadgeNum (= pending) · default 0 · 之前写死 8 ·
    // 现 P-HOME _fetchTodayData 注入真值 (total - done) · 让今天角标与 hero 自洽.
    const strip = buildCurrentWeekStrip(new Date(2026, 4, 16), 8); // Saturday · pending=8
    const todays = strip.days.map((d) => d.today);
    expect(todays).toEqual([false, false, false, false, false, true, false]);
    expect(strip.days[5].num).toBe(8); // today 上挂 badge (来自参数)
    expect(strip.days[0].num).toBe(0);
  });

  it('badge num 默认 0 (hide) · all-done 场景不假装"还有题"', () => {
    const strip = buildCurrentWeekStrip(new Date(2026, 4, 16)); // 不传第二参 · 默认 0
    expect(strip.days[5].num).toBe(0);
  });

  it('badge num 接 pending 真值 · pending=0 角标 hide', () => {
    const strip = buildCurrentWeekStrip(new Date(2026, 4, 16), 0);
    expect(strip.days[5].num).toBe(0);
  });

  it('B5 regression · 周日 (Sunday) 算本周最后一天 · today index = 6', () => {
    const strip = buildCurrentWeekStrip(new Date(2026, 4, 17)); // 2026-05-17 周日
    expect(strip.days[6].today).toBe(true);
    expect(strip.days.filter((d) => d.today)).toHaveLength(1);
  });

  it('B5 regression · 周一 → today index = 0', () => {
    const strip = buildCurrentWeekStrip(new Date(2026, 4, 11)); // 2026-05-11 周一
    expect(strip.days[0].today).toBe(true);
    expect(strip.days[0].d).toBe('11');
    expect(strip.days[6].d).toBe('17');
  });

  it('B5 regression · label reflects current week range (not hardcoded "4 月 20–26 日")', () => {
    const strip = buildCurrentWeekStrip(new Date(2026, 4, 16)); // 周六 → label 5 月 11–17 日
    expect(strip.label).toBe('5 月 11–17 日');
    expect(strip.label).not.toContain('4 月 20');
  });

  it('label uses 2-digit day padding only when > 9 · single digit days unpadded inside label', () => {
    // 2026-05-04 周一 → 本周 5/4 - 5/10 · label = "5 月 4–10 日" (label 不要 pad)
    const strip = buildCurrentWeekStrip(new Date(2026, 4, 4));
    expect(strip.label).toBe('5 月 4–10 日');
    // 但 days[i].d 必须 pad 到 2 位 (UI 对齐)
    expect(strip.days[0].d).toBe('04');
    expect(strip.days[6].d).toBe('10');
  });

  it('每个 day 必带 dots[] (BE 注入或空数组) · today 的 num 接 todayBadgeNum 参数', () => {
    // 之前断言 num=8 + dots.length>0 硬编码 · 现 buildCurrentWeekStrip:
    // - 第 2 参 todayBadgeNum (= pending) · 0 = 角标 hide
    // - 第 3 参 dotsByDay 由 BE /api/home/week-dots 注入 · 不传时全空数组 (诚实表示无排程).
    const strip = buildCurrentWeekStrip(new Date(2026, 4, 16), 8);
    for (const d of strip.days) {
      expect(Array.isArray(d.dots)).toBe(true);
      // 不再断言 length>0 · 因为 dots 从 BE 来 · 不传时 = [] 是合法状态
    }
    const today = strip.days.find((d) => d.today)!;
    expect(today.num).toBe(8);
  });

  it('dotsByDay 注入 · 每天 dots 取对应位置 · 未注入 = 空数组', () => {
    const fakeDots: string[][] = [
      ['#FF3B30'],                                 // Mon
      ['#FF9500', '#34C759'],                      // Tue
      [],                                          // Wed
      ['#FF3B30', '#FF3B30'],                      // Thu (dedup 由 BE 做 · helper 不去重)
      ['#34C759'],                                 // Fri
      [],                                          // Sat
      ['#FF9500'],                                 // Sun
    ];
    const strip = buildCurrentWeekStrip(new Date(2026, 4, 16), 0, fakeDots);
    expect(strip.days[0].dots).toEqual(['#FF3B30']);
    expect(strip.days[2].dots).toEqual([]);
    expect(strip.days[6].dots).toEqual(['#FF9500']);
  });
});

// ── SUBJECT_COLORS regression (B6) ───────────────────────────────
// 修复点 intent:
//   B6 — chip 在深蓝 reviewhero 卡上 · 暗色 #C41E3A/#0057B7/#9C4F00 看起来同色调
//        必须改 mockup 亮色 (#FF6B6B 数学 / #FFD166 物理 / #6DE895 英语)

describe('SUBJECT_COLORS (B6 · 亮色 regression)', () => {
  it('数学 is mockup bright red #FF6B6B (not legacy dark #C41E3A)', () => {
    expect(SUBJECT_COLORS['数学']).toBe('#FF6B6B');
    expect(SUBJECT_COLORS['数学']).not.toBe('#C41E3A');
  });

  it('物理 is mockup bright yellow #FFD166 (not legacy dark #0057B7)', () => {
    expect(SUBJECT_COLORS['物理']).toBe('#FFD166');
    expect(SUBJECT_COLORS['物理']).not.toBe('#0057B7');
  });

  it('英语 is mockup bright green #6DE895 (not legacy brown #9C4F00)', () => {
    expect(SUBJECT_COLORS['英语']).toBe('#6DE895');
    expect(SUBJECT_COLORS['英语']).not.toBe('#9C4F00');
  });

  it('all subjects defined (B6 四学科 + 语文新加 · subject chip 真聚合需要)', () => {
    // 之前只 4 学科 · 现加语文 (BE chinese key) · subjects chip 从 items[] 真聚合时需要色映射.
    expect(Object.keys(SUBJECT_COLORS).sort()).toEqual(['化学', '数学', '物理', '英语', '语文'].sort());
  });
});

// ── buildSubjectsFromItems · subject chip 从 items[] 真聚合 ─────
describe('buildSubjectsFromItems (替代之前 MVP_SUBJECTS 3/2/3 写死)', () => {
  it('items 空 → 空数组 (不渲染假 chip)', () => {
    expect(buildSubjectsFromItems([])).toEqual([]);
  });

  it('单学科 4 题 → 1 chip count=4 · 与 todayTotal 自洽', () => {
    const items = [
      { subject: 'math' }, { subject: 'math' }, { subject: 'math' }, { subject: 'math' },
    ];
    const out = buildSubjectsFromItems(items);
    expect(out).toEqual([{ name: '数学', count: 4, color: SUBJECT_COLORS['数学'] }]);
  });

  it('多学科 · 标签 + 计数都对', () => {
    const items = [
      { subject: 'math' }, { subject: 'math' },
      { subject: 'physics' },
      { subject: 'english' },
    ];
    const out = buildSubjectsFromItems(items);
    const sum = out.reduce((acc, x) => acc + x.count, 0);
    expect(sum).toBe(4);
    expect(out.find(x => x.name === '数学')?.count).toBe(2);
    expect(out.find(x => x.name === '物理')?.count).toBe(1);
    expect(out.find(x => x.name === '英语')?.count).toBe(1);
  });

  it('未知 subject 不渲染 (避免"未知 N 题" 误导)', () => {
    const items = [
      { subject: 'math' },
      { subject: 'unknown_subject' },
      { subject: null },
      { subject: '' },
    ];
    const out = buildSubjectsFromItems(items);
    const sum = out.reduce((acc, x) => acc + x.count, 0);
    expect(sum).toBe(1);  // 仅 math 计入
    expect(out).toEqual([{ name: '数学', count: 1, color: SUBJECT_COLORS['数学'] }]);
  });
});
