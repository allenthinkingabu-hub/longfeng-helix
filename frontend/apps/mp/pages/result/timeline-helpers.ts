// P04 result 艾宾浩斯 6 节点预览 · pure helpers (testable without wx runtime)
//
// 艾宾浩斯 7 节点偏移 · 与 BE review-plan-service.ReviewPlanService.NODE_OFFSETS 完全对齐 ·
// 单位: 毫秒 · T0..T6 = 2h / 1d / 2d / 4d / 7d / 14d / 30d.
// FE 预览跳过 T0 (= +2h "立刻复盘") · biz §2A.4 P04 L191 "T1-T6 共 6 个日历提醒" · 仅 T1..T6 上日历.

export const NODE_OFFSETS_MS: number[] = [
  2 * 3600_000,         // T0 · +2h (skip in preview)
  1 * 86400_000,        // T1 · +1d
  2 * 86400_000,        // T2 · +2d
  4 * 86400_000,        // T3 · +4d
  7 * 86400_000,        // T4 · +7d
  14 * 86400_000,       // T5 · +14d
  30 * 86400_000,       // T6 · +30d
];

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * 预览 timeline label · 基于 now (= 保存时近似时间) + NODE_OFFSETS_MS 计算每节点真日期.
 * 之前写死 ['15:28', '明日', '4/24', ...] mockup mock · 2026-05 还显 4 月日期穿帮.
 *
 * 格式规则:
 *   - 同日: HH:mm  (T0=+2h 才会同日 · 但 T0 跳过, 实际不会落这分支)
 *   - +1d: "明日"
 *   - +2d: "后天"
 *   - 其它: M/D
 */
export function formatTimelineLabel(now: Date, due: Date): string {
  const dayDiff = Math.round(
    (startOfLocalDay(due).getTime() - startOfLocalDay(now).getTime()) / 86400_000
  );
  if (dayDiff <= 0) return `${pad2(due.getHours())}:${pad2(due.getMinutes())}`;
  if (dayDiff === 1) return '明日';
  if (dayDiff === 2) return '后天';
  return `${due.getMonth() + 1}/${due.getDate()}`;
}

/** 生成 6 节点 (T1..T6) 预览 · pre-save 用当前时间 · post-save 优先用 BE plannedNodes 真值. */
export function buildTimelinePreview(now: Date): Array<{ tLevel: string; label: string }> {
  const out: Array<{ tLevel: string; label: string }> = [];
  for (let i = 1; i <= 6; i++) {
    const due = new Date(now.getTime() + NODE_OFFSETS_MS[i]);
    out.push({ tLevel: `T${i}`, label: formatTimelineLabel(now, due) });
  }
  return out;
}
