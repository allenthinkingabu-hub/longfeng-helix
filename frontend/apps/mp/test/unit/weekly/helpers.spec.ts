/**
 * SC-16-T02 · P-WEEKLY-REVIEW helpers unit tests
 *
 * 覆盖 7 个组件 props 派生函数 + null 兜底 corner cases
 * trace: pages/me/weekly/helpers.ts + biz §10.14 空值语义
 */
import { describe, it, expect } from 'vitest';
import {
  formatMasteryPct,
  formatDeltaText,
  computeDeltaDirection,
  formatRangeLabel,
  computeWeekLabel,
  buildSparklinePath,
  buildSubjectRadarSvg,
} from '../../../pages/me/weekly/helpers';

describe('formatMasteryPct · masteryRate → string (P-WEEKLY-REVIEW hero)', () => {
  it('0.68 → "68%"', () => {
    expect(formatMasteryPct(0.68)).toBe('68%');
  });

  it('null → "—%" (em dash · 不显 0%)', () => {
    expect(formatMasteryPct(null)).toBe('—%');
  });

  it('undefined → "—%" (兜底)', () => {
    expect(formatMasteryPct(undefined)).toBe('—%');
  });

  it('0 → "0%" (区别于 null · 0 是真值)', () => {
    expect(formatMasteryPct(0)).toBe('0%');
  });

  it('1.0 → "100%"', () => {
    expect(formatMasteryPct(1.0)).toBe('100%');
  });

  it('0.999 → "100%" (取整)', () => {
    expect(formatMasteryPct(0.999)).toBe('100%');
  });
});

describe('formatDeltaText · masteryDelta → "+6" / "-3"', () => {
  it('+0.06 → "+6"', () => {
    expect(formatDeltaText(0.06)).toBe('+6');
  });

  it('-0.03 → "-3"', () => {
    expect(formatDeltaText(-0.03)).toBe('-3');
  });

  it('null → "" (空字符串 · 不显 "0pts")', () => {
    expect(formatDeltaText(null)).toBe('');
  });

  it('undefined → ""', () => {
    expect(formatDeltaText(undefined)).toBe('');
  });

  it('0 → "0" (区别于 null)', () => {
    expect(formatDeltaText(0)).toBe('0');
  });

  it('0.004 → "0" (取整为 0)', () => {
    expect(formatDeltaText(0.004)).toBe('0');
  });
});

describe('computeDeltaDirection · "up" / "down" / "flat"', () => {
  it('+0.06 → "up"', () => {
    expect(computeDeltaDirection(0.06)).toBe('up');
  });

  it('-0.03 → "down"', () => {
    expect(computeDeltaDirection(-0.03)).toBe('down');
  });

  it('null → "flat" (兜底)', () => {
    expect(computeDeltaDirection(null)).toBe('flat');
  });

  it('0 → "flat"', () => {
    expect(computeDeltaDirection(0)).toBe('flat');
  });

  it('0.003 → "flat" (threshold 内)', () => {
    expect(computeDeltaDirection(0.003)).toBe('flat');
  });

  it('-0.004 → "flat" (threshold 内)', () => {
    expect(computeDeltaDirection(-0.004)).toBe('flat');
  });
});

describe('formatRangeLabel · range → "5月11 – 17日"', () => {
  it('同月 范围 → "5月11 – 17日"', () => {
    expect(formatRangeLabel({ from: '2026-05-11', to: '2026-05-17' })).toBe('5月11 – 17日');
  });

  it('跨月 范围 → "4月29日 – 5月5日"', () => {
    expect(formatRangeLabel({ from: '2026-04-29', to: '2026-05-05' })).toBe('4月29日 – 5月5日');
  });

  it('null → ""', () => {
    expect(formatRangeLabel(null)).toBe('');
  });

  it('undefined → ""', () => {
    expect(formatRangeLabel(undefined)).toBe('');
  });

  it('非法格式 → ""', () => {
    expect(formatRangeLabel({ from: 'invalid', to: 'invalid' })).toBe('');
  });
});

describe('computeWeekLabel · "2026-W20" → "W20"', () => {
  it('"2026-W20" → "W20"', () => {
    expect(computeWeekLabel('2026-W20')).toBe('W20');
  });

  it('"2026-W01" → "W01"', () => {
    expect(computeWeekLabel('2026-W01')).toBe('W01');
  });

  it('非法格式 → 原值', () => {
    expect(computeWeekLabel('xxx')).toBe('xxx');
  });
});

describe('buildSparklinePath · sparkline → svg path d 字符串 (null 断笔)', () => {
  it('全 valid 7 点 → 单 M-L-L 路径', () => {
    const path = buildSparklinePath([0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]);
    expect(path).toMatch(/^M0\.0/);
    expect(path).toMatch(/L/);
    // 不应有第二个 M (无断笔)
    const mCount = (path.match(/M/g) || []).length;
    expect(mCount).toBe(1);
  });

  it('索引 1 / 3 / 5 null → 4 段独立 path (3 个 null 断 3 处)', () => {
    const path = buildSparklinePath([0.5, null, 0.6, null, 0.7, null, 0.8]);
    // 4 个 M (每个 valid 值都重新起笔 · 因为 null 在中间断笔)
    const mCount = (path.match(/M/g) || []).length;
    expect(mCount).toBe(4);
  });

  it('全 null → 空字符串', () => {
    expect(buildSparklinePath([null, null, null, null, null, null, null])).toBe('');
  });

  it('空数组 → ""', () => {
    expect(buildSparklinePath([])).toBe('');
  });

  it('NaN 视为 null', () => {
    const path = buildSparklinePath([0.5, NaN, 0.7]);
    const mCount = (path.match(/M/g) || []).length;
    expect(mCount).toBe(2);
  });
});

describe('buildSubjectRadarSvg · subjects → 完整 svg', () => {
  it('5 学科 → svg 含 4 层网格 + 1 数据多边形', () => {
    const svg = buildSubjectRadarSvg([
      { subject: 'math', masteryRate: 0.72, sampleSize: 12 },
      { subject: 'physics', masteryRate: 0.58, sampleSize: 8 },
      { subject: 'english', masteryRate: 0.8, sampleSize: 5 },
      { subject: 'chinese', masteryRate: 0.65, sampleSize: 7 },
      { subject: 'chemistry', masteryRate: 0.55, sampleSize: 4 },
    ]);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 170 170"');
    // 4 层 grid polygon + 1 数据 polygon = 5 个 polygon tag
    const polygonCount = (svg.match(/<polygon/g) || []).length;
    expect(polygonCount).toBe(5);
  });

  it('空 subjects → svg 仍生成 (只 grid · 无 data 形状 · 2026-05-18 调整)', () => {
    const svg = buildSubjectRadarSvg([]);
    expect(svg).toContain('<svg');
    // 4 层 grid polygon · 旧版多 1 个空 data polygon · 新版去掉 (无意义)
    const polygonCount = (svg.match(/<polygon/g) || []).length;
    expect(polygonCount).toBe(4);
  });

  it('单 subject (math 42%) → 顶部 line + circle (2026-05-18 修 polygon 1 点不可见 bug)', () => {
    const svg = buildSubjectRadarSvg([
      { subject: 'math', masteryRate: 0.42, sampleSize: 7 },
    ]);
    expect(svg).toContain('<line');
    expect(svg).toContain('<circle');
    // 4 层 grid polygon (无 data polygon · 单点用 line+circle)
    expect((svg.match(/<polygon/g) || []).length).toBe(4);
  });

  it('双 subject → 两点连线 + 两端 circle', () => {
    const svg = buildSubjectRadarSvg([
      { subject: 'math', masteryRate: 0.42, sampleSize: 7 },
      { subject: 'physics', masteryRate: 0.55, sampleSize: 3 },
    ]);
    expect(svg).toContain('<line');
    expect((svg.match(/<circle/g) || []).length).toBe(2);
  });

  it('masteryRate 超界 1.5 → clamp 到 1.0', () => {
    const svg = buildSubjectRadarSvg([
      { subject: 'math', masteryRate: 1.5, sampleSize: 10 },
    ]);
    // 不抛错 · 不无穷大
    expect(svg).toContain('<svg');
  });
});
