/**
 * @longfeng/ui-kit · AiMetaChip · metarow 第 4 紫色 chip "AI 已判 {pct}%"
 *
 * trace:
 * - spec design/system/pages/P08-review-exec-ai-judge.spec.md §3 AiMetaChip
 * - mockup design/mockups/wrongbook/20_review_exec_ai_judge.html L220 (`.metarow .chip.purple`)
 */

import type { AiJudgeStatus } from './AiJudgeBanner';

export interface AiMetaChipProps {
  confidence: number;
  status: AiJudgeStatus;
}

export interface AiMetaChipViewModel {
  visible: boolean;
  /** 百分比整数 · 例如 0.754 → 75 */
  pct: number;
}

export function deriveAiMetaChip(props: AiMetaChipProps): AiMetaChipViewModel {
  const visible = props.status === 'DONE';
  const conf = isFinite(props.confidence) ? props.confidence : 0;
  return { visible, pct: Math.round(conf * 100) };
}
