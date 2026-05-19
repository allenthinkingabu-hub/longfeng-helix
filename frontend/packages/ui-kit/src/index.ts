// @longfeng/ui-kit · actual components land in later tasks

// ── SC20-T05 · AI Judge UI components (M-AI-ANSWER-JUDGE · P08 satellite) ──
// trace: design/system/pages/P08-review-exec-ai-judge.spec.md §3 核心组件
export type {
  AiJudgeVerdict,
  AiJudgeStatus,
  AiJudgeBannerProps,
  AiJudgeBannerViewModel,
} from './AiJudgeBanner';
export {
  deriveAiJudgeBannerViewModel,
  computeFinalGradeSource,
} from './AiJudgeBanner';

export type { AiFlagProps } from './AiFlag';
export { shouldShowAiFlag } from './AiFlag';

export type { AiMetaChipProps, AiMetaChipViewModel } from './AiMetaChip';
export { deriveAiMetaChip } from './AiMetaChip';

export type { AiHintRibbonProps, AiHintRibbonViewModel } from './AiHintRibbon';
export { deriveAiHintRibbon } from './AiHintRibbon';

export { computeGradeButtonAriaLabel } from './AiMark';

export type { GradeButtonsProps, GradeButtonViewModel } from './GradeButtons';
export { deriveGradeButtonsViewModel } from './GradeButtons';
