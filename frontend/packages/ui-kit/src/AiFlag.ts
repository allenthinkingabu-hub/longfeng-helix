/**
 * @longfeng/ui-kit · AiFlag · nav center 紫色 "AI 已判" chip
 *
 * trace:
 * - spec design/system/pages/P08-review-exec-ai-judge.spec.md §3 AiFlag
 * - mockup design/mockups/wrongbook/20_review_exec_ai_judge.html L189 (`.nav .ai-flag`)
 *
 * 见 AiJudgeBanner.ts 头部说明 · pure-TS view-model export · wxml inline.
 */

import type { AiJudgeStatus } from './AiJudgeBanner';

export interface AiFlagProps {
  /** AI judge 当前态 · 仅 DONE 才显示 flag */
  status: AiJudgeStatus;
}

/** flag 是否渲染 · 不传 status 默认隐藏 */
export function shouldShowAiFlag(props: AiFlagProps): boolean {
  return props.status === 'DONE';
}
