/**
 * @longfeng/ui-kit · AiHintRibbon · rating 区上方紫色 hint banner
 *
 * trace:
 * - spec design/system/pages/P08-review-exec-ai-judge.spec.md §3 AiHintRibbon
 * - mockup design/mockups/wrongbook/20_review_exec_ai_judge.html L401 (`.rating .ai-hint`)
 *
 * i18n: exec.rating.aiHint 含 {verdict} 插值 · 由 page 用 i18n.t() 算好后传入文字.
 */

import type { AiJudgeVerdict, AiJudgeStatus } from './AiJudgeBanner';

export interface AiHintRibbonProps {
  /** AI 终判 · 仅 DONE 时显示 ribbon */
  aiVerdict: AiJudgeVerdict | null;
  status: AiJudgeStatus;
}

export interface AiHintRibbonViewModel {
  visible: boolean;
  verdictI18nKey: string | null;
}

const VERDICT_KEY: Record<AiJudgeVerdict, string> = {
  MASTERED: 'exec.judge.verdict.mastered',
  PARTIAL: 'exec.judge.verdict.partial',
  FORGOT: 'exec.judge.verdict.forgot',
};

export function deriveAiHintRibbon(props: AiHintRibbonProps): AiHintRibbonViewModel {
  const visible = props.status === 'DONE' && props.aiVerdict !== null;
  return {
    visible,
    verdictI18nKey: visible && props.aiVerdict ? VERDICT_KEY[props.aiVerdict] : null,
  };
}
