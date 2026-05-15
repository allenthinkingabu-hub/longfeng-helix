/**
 * Unit test · wrongbook-list page pure helpers
 * 0 mock · 0 backend · 100% pass
 *
 * Tests: formatDueLabel, formatTimeAgo, buildStarsLabel, enrichItem
 * trace: pages/wrongbook-list/index.ts (exported helpers)
 */
import { describe, it, expect } from 'vitest';
import {
  formatDueLabel,
  formatTimeAgo,
  buildStarsLabel,
  enrichItem,
} from '../../pages/wrongbook-list/helpers';
import type { WrongQuestionListItem } from '../../src/api/wrongbook';

// ── Helper: build a mock item ─────────────────────────────────

function makeItem(overrides: Partial<WrongQuestionListItem> = {}): WrongQuestionListItem {
  return {
    qid: 'q-test',
    subject: 'math',
    kp: ['二次函数', '配方法'],
    stemSnippet: '已知函数 f(x)=x²−4x+3，求其顶点坐标。',
    thumb: '',
    masteryPct: 15,
    masteryLabel: 'NOT_MASTERED',
    nextDueAt: new Date(Date.now() + 3600000).toISOString(),
    nodeStage: 1,
    createdAt: new Date(Date.now() - 60000).toISOString(),
    errorType: '概念',
    difficulty: 3,
    questionNo: '17',
    ...overrides,
  };
}

// ── formatDueLabel ────────────────────────────────────────────

describe('formatDueLabel (pure · no backend)', () => {
  it('returns "已逾期" when nextDueAt is in the past', () => {
    const item = makeItem({ nextDueAt: new Date(Date.now() - 10000).toISOString(), nodeStage: 2 });
    expect(formatDueLabel(item)).toBe('T2 · 已逾期');
  });

  it('returns minutes when due < 1 hour from now', () => {
    const item = makeItem({ nextDueAt: new Date(Date.now() + 30 * 60000).toISOString(), nodeStage: 1 });
    const result = formatDueLabel(item);
    expect(result).toMatch(/^T1 · \d+ 分钟后$/);
  });

  it('returns "1 小时后" when due is 1-2 hours away', () => {
    const item = makeItem({ nextDueAt: new Date(Date.now() + 90 * 60000).toISOString(), nodeStage: 3 });
    expect(formatDueLabel(item)).toBe('T3 · 1 小时后');
  });

  it('returns hours when due is 2-24 hours away', () => {
    const item = makeItem({ nextDueAt: new Date(Date.now() + 5 * 3600000).toISOString(), nodeStage: 1 });
    const result = formatDueLabel(item);
    expect(result).toMatch(/^T1 · \d+ 小时后$/);
  });

  it('returns "明日 09:00" when due is 1-2 days away', () => {
    const item = makeItem({ nextDueAt: new Date(Date.now() + 30 * 3600000).toISOString(), nodeStage: 4 });
    expect(formatDueLabel(item)).toBe('T4 · 明日 09:00');
  });

  it('returns "N 天后" when due is > 2 days away', () => {
    const item = makeItem({ nextDueAt: new Date(Date.now() + 5 * 86400000).toISOString(), nodeStage: 5 });
    const result = formatDueLabel(item);
    expect(result).toMatch(/^T5 · \d+ 天后$/);
  });
});

// ── formatTimeAgo ─────────────────────────────────────────────

describe('formatTimeAgo (pure · no backend)', () => {
  it('returns "刚刚" for < 1 minute', () => {
    expect(formatTimeAgo(new Date(Date.now() - 30000).toISOString())).toBe('刚刚');
  });

  it('returns "N 分钟前" for 1-59 minutes', () => {
    const result = formatTimeAgo(new Date(Date.now() - 10 * 60000).toISOString());
    expect(result).toMatch(/^\d+ 分钟前$/);
  });

  it('returns "今日 HH:MM 入库" for same-day', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
    const result = formatTimeAgo(twoHoursAgo);
    expect(result).toMatch(/^今日 \d{2}:\d{2} 入库$/);
  });

  it('returns "昨天" for 1-2 days ago', () => {
    expect(formatTimeAgo(new Date(Date.now() - 30 * 3600000).toISOString())).toBe('昨天');
  });

  it('returns "N 天前" for > 2 days', () => {
    const result = formatTimeAgo(new Date(Date.now() - 5 * 86400000).toISOString());
    expect(result).toMatch(/^\d+ 天前$/);
  });
});

// ── buildStarsLabel ───────────────────────────────────────────

describe('buildStarsLabel (pure)', () => {
  it('returns correct number of stars', () => {
    expect(buildStarsLabel(3)).toBe('★★★');
    expect(buildStarsLabel(5)).toBe('★★★★★');
    expect(buildStarsLabel(1)).toBe('★');
  });

  it('clamps to 0-5 range', () => {
    expect(buildStarsLabel(0)).toBe('');
    expect(buildStarsLabel(-1)).toBe('');
    expect(buildStarsLabel(6)).toBe('★★★★★');
  });
});

// ── enrichItem ────────────────────────────────────────────────

describe('enrichItem (pure · derives display fields)', () => {
  it('maps subject to label and color', () => {
    const result = enrichItem(makeItem({ subject: 'physics' }));
    expect(result.subjectLabel).toBe('物理');
    expect(result.subjectColor).toBe('#FF9500');
  });

  it('maps masteryLabel to text and color', () => {
    const result = enrichItem(makeItem({ masteryLabel: 'MASTERED' }));
    expect(result.masteryText).toBe('已掌握');
    expect(result.masteryColor).toBe('green');
  });

  it('builds stageDots with correct done/now markers', () => {
    const result = enrichItem(makeItem({ nodeStage: 3 }));
    expect(result.stageDots).toHaveLength(6);
    expect(result.stageDots[0].cls).toBe('sb sb-done');
    expect(result.stageDots[1].cls).toBe('sb sb-done');
    expect(result.stageDots[2].cls).toBe('sb sb-now');
    expect(result.stageDots[3].cls).toBe('sb');
  });

  it('truncates stemShort to 20 chars', () => {
    const longSnippet = 'abcdefghijklmnopqrstuvwxyz1234567890';
    const result = enrichItem(makeItem({ stemSnippet: longSnippet }));
    expect(result.stemShort).toHaveLength(20);
    expect(result.stemShort).toBe(longSnippet.slice(0, 20));
  });

  it('falls back to NOT_MASTERED config for unknown masteryLabel', () => {
    const result = enrichItem(makeItem({ masteryLabel: 'UNKNOWN' as 'NOT_MASTERED' }));
    expect(result.masteryText).toBe('未掌握');
    expect(result.masteryColor).toBe('red');
  });
});

// ── listWrongQuestions export check ───────────────────────────

describe('api/wrongbook.ts exports (no HTTP)', () => {
  it('exports listWrongQuestions function', async () => {
    const mod = await import('../../src/api/wrongbook');
    expect(typeof mod.listWrongQuestions).toBe('function');
  });
});
