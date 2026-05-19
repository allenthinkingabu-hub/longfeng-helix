// SC21-T02 · Override Ack CTA view-model helper
// 派生学生 tap 非 AI-建议按钮后 banner 出现的 ack 文案 vm.
// biz §2B.21 步 2 字面: "你选择了 {grade} · 与 AI 不同 (这有助于我们改进 AI)"

import type { AiJudgeVerdict, AiJudgeStatus } from './AiJudgeBanner';

export interface OverrideAckProps {
  /** 学生最终选的 grade (用户 tap 自评按钮的结果 · 一定非 null) · 例: 'FORGOT'. */
  userGrade: AiJudgeVerdict;
  /** AI 判 verdict (null = 退化态 / AI 未判). */
  aiVerdict: AiJudgeVerdict | null;
  /** AI 判状态 · 仅 DONE 时算 override 才显示 ack. */
  aiStatus: AiJudgeStatus;
  /** final_grade_source 三态字面值 (computeFinalGradeSource 的输出). */
  finalGradeSource: 'self' | 'ai_accepted' | 'ai_overridden' | null;
}

export interface OverrideAckViewModel {
  /** 是否显示 ack · 仅 finalGradeSource='ai_overridden' 时 true. */
  visible: boolean;
  /** i18n key 'exec.judge.cta.overrideAck' (调用端传 zh/en locale + values 插值). */
  i18nKey: 'exec.judge.cta.overrideAck';
  /** 插值 values · {grade} 替换为对应 verdict i18n key (调用端再 translate 二次). */
  values: { grade: string };
}

/**
 * 派生 override ack vm.
 *
 * 触发条件 (3 件同时满足 · 任一不满足 → visible=false):
 * 1. finalGradeSource === 'ai_overridden' (computeFinalGradeSource 三态规则一致)
 * 2. aiStatus === 'DONE' (AI 真判完 · 非退化态)
 * 3. aiVerdict !== null (双信源溯源 A.2 · 必须有 AI 信源对比)
 *
 * grade i18n key 映射:
 * - MASTERED → 'exec.judge.verdict.mastered' → 中文 '已掌握' / 英文 'Mastered'
 * - PARTIAL  → 'exec.judge.verdict.partial'  → 中文 '部分掌握' / 英文 'Partial'
 * - FORGOT   → 'exec.judge.verdict.forgot'   → 中文 '未掌握'   / 英文 'Forgot'
 *
 * 调用端示例:
 *   const vm = deriveOverrideAckViewModel({ userGrade: 'FORGOT', aiVerdict: 'MASTERED', aiStatus: 'DONE', finalGradeSource: 'ai_overridden' });
 *   if (vm.visible) {
 *     const gradeLabel = translate(zhLocale, `exec.judge.verdict.${vm.values.grade.toLowerCase()}`);
 *     const ackText = translate(zhLocale, vm.i18nKey, { grade: gradeLabel });
 *     // ackText = '你选择了 未掌握 · 与 AI 不同 (这有助于我们改进 AI)'
 *   }
 */
export function deriveOverrideAckViewModel(props: OverrideAckProps): OverrideAckViewModel {
  const visible =
    props.finalGradeSource === 'ai_overridden'
    && props.aiStatus === 'DONE'
    && props.aiVerdict !== null;
  return {
    visible,
    i18nKey: 'exec.judge.cta.overrideAck',
    values: { grade: props.userGrade },
  };
}
