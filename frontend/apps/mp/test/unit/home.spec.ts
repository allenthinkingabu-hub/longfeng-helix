/**
 * Unit test · P-HOME pure logic (no HTTP · no backend · no wx)
 * 0 mock · 100% pass · red line
 *
 * Tests buildGreeting, computeCirclePct, derivePageState — pure functions
 * exported from pages/home/index.ts for testability.
 */
import { describe, it, expect } from 'vitest';

import {
  buildGreeting,
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
