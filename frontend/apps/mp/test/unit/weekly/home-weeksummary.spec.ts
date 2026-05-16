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

describe('buildSparklineSvgFromWeekSummary · null 索引断笔', () => {
  it('全 valid 7 点 → 单 M-L 路径 · 含 stroke=#34C759', () => {
    const uri = buildSparklineSvgFromWeekSummary([0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]);
    expect(uri).toMatch(/^data:image\/svg\+xml;utf8,/);
    const decoded = decodeURIComponent(uri.replace(/^data:image\/svg\+xml;utf8,/, ''));
    expect(decoded).toContain('<svg');
    expect(decoded).toContain('stroke="#34C759"');
    // 1 个 M (无断笔)
    const mCount = (decoded.match(/[MmLl]/g) || []).filter((c) => c === 'M').length;
    expect(mCount).toBe(1);
  });

  it('索引 1/3/5 null → svg 含 4 段独立 path (4 个 M)', () => {
    const uri = buildSparklineSvgFromWeekSummary([0.6, null, 0.65, null, 0.68, null, 0.72]);
    const decoded = decodeURIComponent(uri.replace(/^data:image\/svg\+xml;utf8,/, ''));
    const mCount = (decoded.match(/[MmLl]/g) || []).filter((c) => c === 'M').length;
    expect(mCount).toBe(4);
  });

  it('全 null → svg 含空 path d=""', () => {
    const uri = buildSparklineSvgFromWeekSummary([null, null, null, null, null, null, null]);
    const decoded = decodeURIComponent(uri.replace(/^data:image\/svg\+xml;utf8,/, ''));
    expect(decoded).toContain('d=""');
  });

  it('空数组 → ""', () => {
    expect(buildSparklineSvgFromWeekSummary([])).toBe('');
  });

  it('索引 0 / 6 null (头尾) → 中段独立 path', () => {
    const uri = buildSparklineSvgFromWeekSummary([null, 0.6, 0.65, 0.7, 0.68, 0.65, null]);
    const decoded = decodeURIComponent(uri.replace(/^data:image\/svg\+xml;utf8,/, ''));
    const mCount = (decoded.match(/[MmLl]/g) || []).filter((c) => c === 'M').length;
    expect(mCount).toBe(1);
  });
});
