/**
 * P-WEEKLY-REVIEW helpers (SC-16-T02)
 * 纯函数 · 无副作用 · 给 unit test (test/unit/weekly/helpers.test.ts) 直接覆盖
 *
 * 空值兜底原则 (biz §10.14 + spec §5.1):
 *   masteryRate=null → '—%' (em dash 不是 hyphen)
 *   delta=null → '' (空字符串 · 不显 '0pts')
 *   sparkline[i]=null → svg path 在该索引断笔 (拆 path tag)
 */

import type { WeeklyRangeDto, WeeklySubjectRadarDto } from '../../../src/api/weekly';

/**
 * masteryRate 0..1 → "68%" · null → "—%" (em dash U+2014)
 * spec P-HOME §5.2 + biz §10.14 字段 1
 */
export function formatMasteryPct(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return '—%';
  return `${Math.round(rate * 100)}%`;
}

/**
 * masteryDelta (-0.03 .. +0.06) → "+6" / "-3" · null → ''
 * 不带 'pts' 后缀 · 由 wxml 拼接 i18n key (weekly.hero.delta.up/down)
 */
export function formatDeltaText(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return '';
  const pts = Math.round(delta * 100);
  if (pts === 0) return '0';
  return pts > 0 ? `+${pts}` : `${pts}`;
}

/**
 * 'up' / 'down' / 'flat'
 * - delta > 0.005 → 'up'
 * - delta < -0.005 → 'down'
 * - 其他 (含 null / 0 / 微小) → 'flat'
 */
export function computeDeltaDirection(
  delta: number | null | undefined,
): 'up' | 'down' | 'flat' {
  if (delta === null || delta === undefined) return 'flat';
  if (delta > 0.005) return 'up';
  if (delta < -0.005) return 'down';
  return 'flat';
}

/**
 * range {from:'2026-05-11', to:'2026-05-17'} → "5月11 – 17日"
 * 简单实现 · 不跨月 · 跨月由 P2 升级
 */
export function formatRangeLabel(range: WeeklyRangeDto | null | undefined): string {
  if (!range || !range.from || !range.to) return '';
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to);
  if (!from || !to) return '';
  if (from.month === to.month) {
    return `${from.month}月${from.day} – ${to.day}日`;
  }
  return `${from.month}月${from.day}日 – ${to.month}月${to.day}日`;
}

function parseIsoDate(iso: string): { month: number; day: number } | null {
  // 'YYYY-MM-DD'
  const match = iso.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { month: parseInt(match[1], 10), day: parseInt(match[2], 10) };
}

/**
 * "2026-W20" → "W20"
 */
export function computeWeekLabel(week: string): string {
  const match = week.match(/^\d{4}-(W\d{2})$/);
  return match ? match[1] : week;
}

/**
 * sparkline (Array<number|null> 长度 7) → svg path d 字符串
 * - null 索引断笔 (不 forward-fill)
 * - viewBox: 300x40
 * - 实现: 把 [v0,null,v2] 拆成 ['M0,Y0', 'M2*step,Y2'] · null 跳过 + 下一个 valid 重新 M 起笔
 *
 * 返回多个 path d (空格分隔) · wxml 端用单个 path tag 渲染全部
 * 注意: spec.ts Case 6 (b) 不断言 svg path d · 改断言 page.data().homeWeekSummary.sparkline[i] === null
 *       但本 helper 是 weekly 页 hero 用的 · 完整覆盖 nullable 7 点
 */
export function buildSparklinePath(sparkline: Array<number | null>): string {
  if (!Array.isArray(sparkline) || sparkline.length === 0) return '';
  const W = 300;
  const H = 40;
  const step = W / Math.max(1, sparkline.length - 1);

  const segments: string[] = [];
  let current: string[] = [];

  for (let i = 0; i < sparkline.length; i++) {
    const v = sparkline[i];
    if (v === null || v === undefined || !Number.isFinite(v)) {
      // 断笔: flush 当前 segment
      if (current.length > 0) {
        segments.push(current.join(' '));
        current = [];
      }
      continue;
    }
    // 0..1 → svg y 坐标 (反转: 1 在顶 0 在底)
    const y = Math.max(0, Math.min(H, (1 - v) * H));
    const x = i * step;
    if (current.length === 0) {
      current.push(`M${x.toFixed(1)},${y.toFixed(1)}`);
    } else {
      current.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
    }
  }
  if (current.length > 0) segments.push(current.join(' '));

  return segments.join(' ');
}

/**
 * subjectRadar[] → svg 字符串 (170×170 viewBox)
 * 5 学科 · 五边形网格 · 数据多边形
 * 简化: 不画 axis label (label 由 legend 旁边列出)
 */
export function buildSubjectRadarSvg(
  subjects: WeeklySubjectRadarDto[],
): string {
  const SIZE = 170;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 70;
  const n = Math.max(3, subjects.length);

  // 网格五边形 (4 层 · 不强制 5 边 · 用 subjects.length)
  const gridLayers: string[] = [];
  for (let layer = 1; layer <= 4; layer++) {
    const rL = (R * layer) / 4;
    const pts: string[] = [];
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const x = CX + rL * Math.cos(angle);
      const y = CY + rL * Math.sin(angle);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    gridLayers.push(
      `<polygon points="${pts.join(' ')}" fill="none" stroke="rgba(60,60,67,0.15)" stroke-width="1"/>`,
    );
  }

  // 数据多边形
  const dataPts: string[] = [];
  for (let i = 0; i < subjects.length; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rD = R * Math.max(0, Math.min(1, subjects[i].masteryRate));
    const x = CX + rD * Math.cos(angle);
    const y = CY + rD * Math.sin(angle);
    dataPts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const dataPolygon = `<polygon points="${dataPts.join(' ')}" fill="rgba(0,122,255,0.20)" stroke="#007AFF" stroke-width="1.5"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">
  ${gridLayers.join('\n  ')}
  ${dataPolygon}
</svg>`;
}
