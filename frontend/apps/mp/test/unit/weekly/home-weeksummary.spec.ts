/**
 * SC-16-T02 · P-HOME weekSummary helpers unit tests (AC8 兜底集)
 *
 * 覆盖 4 数字 wire helpers + null 索引断笔
 * trace: pages/home/helpers.ts + design/system/pages/P-HOME.spec.md §5.2
 */
import { describe, it, expect } from 'vitest';
import {
  formatMasteryPctFromWeekSummary,
  buildSparklineSvgFromWeekSummary,
  buildWeekDayLabels,
  computeIsoTodayIdx,
} from '../../../pages/home/helpers';

describe('formatMasteryPctFromWeekSummary · masteryRate → string', () => {
  it('0.68 → "68%" (P-HOME 4 数字之 1)', () => {
    expect(formatMasteryPctFromWeekSummary(0.68)).toBe('68%');
  });

  it('null → "—%" (em dash · 空周 spec §5.2)', () => {
    expect(formatMasteryPctFromWeekSummary(null)).toBe('—%');
  });

  it('undefined → "—%"', () => {
    expect(formatMasteryPctFromWeekSummary(undefined)).toBe('—%');
  });

  it('0 → "0%" (区别于 null · 0 是真值)', () => {
    expect(formatMasteryPctFromWeekSummary(0)).toBe('0%');
  });
});

describe('buildSparklineSvgFromWeekSummary · null → 0 连线 (2026-05-18 用户决策)', () => {
  it('全 valid 7 点 → 单 M-L 路径 · 含 stroke=#34C759 + 7 个 circle dots', () => {
    const uri = buildSparklineSvgFromWeekSummary([0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]);
    expect(uri).toMatch(/^data:image\/svg\+xml;utf8,/);
    const decoded = decodeURIComponent(uri.replace(/^data:image\/svg\+xml;utf8,/, ''));
    expect(decoded).toContain('<svg');
    expect(decoded).toContain('stroke="#34C759"');
    // 单连续 path (1 个 M + 6 个 L)
    const mCount = (decoded.match(/M/g) || []).length;
    expect(mCount).toBe(1);
    // 7 个数据点 marker
    const circleCount = (decoded.match(/<circle/g) || []).length;
    expect(circleCount).toBe(7);
  });

  it('索引 1/3/5 null → 仍 7 个点 + 单连线 · null 处画在 y=H 底部 (2026-05-18 新行为)', () => {
    const uri = buildSparklineSvgFromWeekSummary([0.6, null, 0.65, null, 0.68, null, 0.72]);
    const decoded = decodeURIComponent(uri.replace(/^data:image\/svg\+xml;utf8,/, ''));
    // 单连续 path (不再断笔 · 旧 4 段 expected 已废)
    const mCount = (decoded.match(/M/g) || []).length;
    expect(mCount).toBe(1);
    const circleCount = (decoded.match(/<circle/g) || []).length;
    expect(circleCount).toBe(7);
    // null 索引画在底部 y=40 (H=40 · v=0 → y=H)
    expect(decoded).toMatch(/cy="40\.0"/);
  });

  it('全 null → "" (空周 · wx:if 隐藏整个 sparkline)', () => {
    expect(buildSparklineSvgFromWeekSummary([null, null, null, null, null, null, null])).toBe('');
  });

  it('空数组 → ""', () => {
    expect(buildSparklineSvgFromWeekSummary([])).toBe('');
  });

  it('索引 0 / 6 null (头尾) → 仍 7 个点单连线 · 头尾画底部', () => {
    const uri = buildSparklineSvgFromWeekSummary([null, 0.6, 0.65, 0.7, 0.68, 0.65, null]);
    const decoded = decodeURIComponent(uri.replace(/^data:image\/svg\+xml;utf8,/, ''));
    const mCount = (decoded.match(/M/g) || []).length;
    expect(mCount).toBe(1);
    const circleCount = (decoded.match(/<circle/g) || []).length;
    expect(circleCount).toBe(7);
  });
});

// ─── day bar 标签动态化 (2026-05-18 修 "今天"错位 bug) ───────────────
describe('buildWeekDayLabels + computeIsoTodayIdx · day bar 动态贴 "今天"', () => {
  it('周一 (2026-05-18 Mon · jsDay=1) → idx 0 · "今天"贴最左', () => {
    const labels = buildWeekDayLabels(new Date(2026, 4, 18)); // May=4 (0-based)
    expect(computeIsoTodayIdx(new Date(2026, 4, 18))).toBe(0);
    expect(labels).toEqual(['今天', '周二', '周三', '周四', '周五', '周六', '周日']);
  });

  it('周三 (2026-05-20 Wed · jsDay=3) → idx 2 · "今天"贴第 3 位', () => {
    const labels = buildWeekDayLabels(new Date(2026, 4, 20));
    expect(computeIsoTodayIdx(new Date(2026, 4, 20))).toBe(2);
    expect(labels).toEqual(['周一', '周二', '今天', '周四', '周五', '周六', '周日']);
  });

  it('周日 (2026-05-24 Sun · jsDay=0) → idx 6 · "今天"贴最右 (旧写死 case)', () => {
    const labels = buildWeekDayLabels(new Date(2026, 4, 24));
    expect(computeIsoTodayIdx(new Date(2026, 4, 24))).toBe(6);
    expect(labels).toEqual(['周一', '周二', '周三', '周四', '周五', '周六', '今天']);
  });
});
