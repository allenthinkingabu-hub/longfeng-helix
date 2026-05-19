/**
 * @longfeng/ui-kit · AiMark · GradeButtons preselected 按钮右上角 "AI★" 角标
 *
 * trace:
 * - spec design/system/pages/P08-review-exec-ai-judge.spec.md §3 GradeButtons preselected
 * - mockup design/mockups/wrongbook/20_review_exec_ai_judge.html L353 + L417 (`.rbtn .ai-mark`)
 *
 * AC3 字面: preselected 对应按钮渲染 双 border + box-shadow + <AiMark> 角标 ·
 *           aria-label '当前选择: PARTIAL · AI 建议' (色盲友好 · A.1 学生主体性)
 *
 * 本 helper 算 aria-label · 满足 TI2 色盲友好红线.
 */

import type { AiJudgeVerdict } from './AiJudgeBanner';

const VERDICT_LABEL_ZH: Record<AiJudgeVerdict, string> = {
  MASTERED: '已掌握',
  PARTIAL: '部分掌握',
  FORGOT: '未掌握',
};

/**
 * 给 grade 按钮算 aria-label · preselected 必须带 "· AI 建议" 后缀
 * 满足 TI2 色盲友好红线 (不仅靠颜色) + A.1 学生主体性宪法
 */
export function computeGradeButtonAriaLabel(
  grade: AiJudgeVerdict,
  preselected: AiJudgeVerdict | null,
): string {
  const base = `当前选择: ${VERDICT_LABEL_ZH[grade]}`;
  if (preselected !== null && preselected === grade) {
    return `${base} · AI 建议`;
  }
  return base;
}
