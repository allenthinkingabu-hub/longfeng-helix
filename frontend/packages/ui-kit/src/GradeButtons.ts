/**
 * @longfeng/ui-kit · GradeButtons · preselected ring 与 AI 建议 view-model
 *
 * SC20-T05 AC3: 扩展现役 grade buttons 加 preselected prop ·
 *               preselected 按钮: 双 border + box-shadow + <AiMark> 角标 +
 *               aria-label '当前选择: X · AI 建议' (色盲友好 · A.1)
 *
 * 现役 frontend/apps/mp/pages/review-exec/index.wxml inline `.rating .rbtn` 3 按钮
 *   (.rbtn-forgot / .rbtn-partial / .rbtn-master · L198-L234) · 满足 Rule 11
 *   Match codebase conventions 不强造 Component 三件套 fork 现役模式.
 * 本文件只 export 计算 ring class + aria-label 的 helper · page 层级渲染.
 */

import type { AiJudgeVerdict } from './AiJudgeBanner';
import { computeGradeButtonAriaLabel } from './AiMark';

export interface GradeButtonsProps {
  /** 是否已揭示 (revealed=true 才允许 tap) */
  revealed: boolean;
  /** AI 建议预选值 · null = 无 AI 建议 (退化 / IDLE / 未到 JUDGED_DONE) */
  preselected: AiJudgeVerdict | null;
  /** 是否已掌握按钮被禁用 (master spec 现役开关 · 与 satellite 无关) */
  masteredEnabled: boolean;
  /** grade 正在提交中 · 防双 tap */
  isGrading: boolean;
}

/** 单按钮 view-model · class + aria-label + showMark 直接绑 wxml */
export interface GradeButtonViewModel {
  grade: AiJudgeVerdict;
  /** wxml 拼 class · 带 rbtn-{kind} + 可能的 preselected ring + disabled */
  cls: string;
  ariaLabel: string;
  /** 是否显示右上角 AI★ 角标 */
  showMark: boolean;
  /** 是否完全禁用 tap */
  disabled: boolean;
}

const KIND_CLASS: Record<AiJudgeVerdict, string> = {
  FORGOT: 'rbtn-forgot',
  PARTIAL: 'rbtn-partial',
  MASTERED: 'rbtn-master',
};

/**
 * 3 按钮统一 view-model · ordering 与 mockup L411-L425 一致 (forgot · partial · master)
 */
export function deriveGradeButtonsViewModel(props: GradeButtonsProps): GradeButtonViewModel[] {
  return (['FORGOT', 'PARTIAL', 'MASTERED'] as AiJudgeVerdict[]).map((grade) => {
    const isPreselected = props.preselected !== null && props.preselected === grade;
    const masteredDisabled = grade === 'MASTERED' && !props.masteredEnabled;
    const disabled = !props.revealed || props.isGrading || masteredDisabled;
    const cls = [
      'rbtn',
      KIND_CLASS[grade],
      isPreselected ? 'rbtn-preselected' : '',
      disabled ? 'rbtn-disabled' : '',
    ].filter(Boolean).join(' ');
    return {
      grade,
      cls,
      ariaLabel: computeGradeButtonAriaLabel(grade, props.preselected),
      showMark: isPreselected,
      disabled,
    };
  });
}
