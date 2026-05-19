/**
 * @longfeng/ui-kit · AiJudgeBanner (核心组件 · satellite §2A.4 灵魂)
 *
 * trace:
 * - spec design/system/pages/P08-review-exec-ai-judge.spec.md §3 核心组件
 * - mockup design/mockups/wrongbook/20_review_exec_ai_judge.html L322-L385
 *
 * MP custom-component 模式偏离: ui-kit 当前是 pure-TS export (no .wxml/.wxss 三件套
 *   wechat custom component pattern · 与现役 ui-kit/src/index.ts stub 一致).
 * 实际 wxml 渲染 inline 在 frontend/apps/mp/pages/review-exec/index.wxml `.aijb` 区
 * (满足 SC20-T05 AC1 视觉一致 · 满足 Rule 11 Match codebase conventions: 现役
 *  page 全部 inline · 不强造 component 三件套 fork 现役模式).
 *
 * 本文件 export: props type + 1 个 view-model helper (banner UI 渲染要的衍生字段计算).
 */

export type AiJudgeVerdict = 'MASTERED' | 'PARTIAL' | 'FORGOT';
export type AiJudgeStatus =
  | 'IDLE'
  | 'UPLOADING'
  | 'PENDING'
  | 'DONE'
  | 'TIMEOUT'
  | 'LOW_CONFIDENCE'
  | 'SERVICE_UNAVAILABLE';

/** AiJudgeBanner props · 1:1 与 spec §3 行 AiJudgeBanner */
export interface AiJudgeBannerProps {
  /** AI 终判结果 · null = AI 失败/超时/不可用 */
  verdict: AiJudgeVerdict | null;
  /** 置信度 0.0-1.0 · TIMEOUT 时 0 */
  confidence: number;
  /** AI 诊断理由 (≤ 200 字中文) */
  reason: string;
  /** 学生答对的步骤 chips */
  matchedSteps: string[];
  /** 学生缺的步骤 chips */
  missedSteps: string[];
  /** 状态机当前态 · DONE 时主区渲染 · 其它退化 */
  status: AiJudgeStatus;
  /** 模型名 'claude-3.5-sonnet' | 'gpt-4o' · sub-header 显示 */
  modelUsed: string;
  /** 端到端耗时 ms · sub-header 显示 (e.g. "5.4s") */
  latencyMs: number;
}

export interface AiJudgeBannerViewModel {
  /** 是否渲染主 banner 区 (DONE 才渲染) */
  showMain: boolean;
  /** 是否渲染退化 fallback (TIMEOUT / LOW_CONFIDENCE / SERVICE_UNAVAILABLE) */
  showFallback: boolean;
  /** 渲染期间的 i18n key for fallback 文案 (主区 i18n 由 page 计算) */
  fallbackI18nKey: string | null;
  /** 置信度百分比整数 · 例如 0.754 → 75 */
  confidencePct: number;
  /** 模型 + latency 副标签 · 例如 "Claude 3.5 Sonnet · 5.4s" */
  modelSubtitle: string;
  /** verdict label i18n key · DONE 时根据 verdict 选 */
  verdictI18nKey: string | null;
  /**
   * SC22-T01 · fallback 视觉差 (wxss 选不同 class) · null = 主区 DONE 不退化:
   * - 'lowConfidence': 灰色文案 (区分 confidence ≥ 0.5 紫色 banner)
   * - 'timeout': 红色 + 超时图标 (biz §2B.22 TC-22.02)
   * - 'unavailable': 灰色 + 服务不可用图标 (SERVICE_UNAVAILABLE)
   */
  fallbackKind: 'lowConfidence' | 'timeout' | 'unavailable' | null;
}

const VERDICT_KEY: Record<AiJudgeVerdict, string> = {
  MASTERED: 'exec.judge.verdict.mastered',
  PARTIAL: 'exec.judge.verdict.partial',
  FORGOT: 'exec.judge.verdict.forgot',
};

const FALLBACK_KEY: Partial<Record<AiJudgeStatus, string>> = {
  TIMEOUT: 'exec.judge.timeout',
  LOW_CONFIDENCE: 'exec.judge.lowConfidence',
  SERVICE_UNAVAILABLE: 'exec.banner.fallback',
};

/** SC22-T01 · fallback 状态 → 视觉 kind 映射 (wxss class 选择 · biz §2B.22 视觉 polish) */
const FALLBACK_KIND: Partial<Record<AiJudgeStatus, 'lowConfidence' | 'timeout' | 'unavailable'>> = {
  TIMEOUT: 'timeout',
  LOW_CONFIDENCE: 'lowConfidence',
  SERVICE_UNAVAILABLE: 'unavailable',
};

const MODEL_DISPLAY: Record<string, string> = {
  'claude-3.5-sonnet': 'Claude 3.5 Sonnet',
  'gpt-4o': 'GPT-4o',
};

/**
 * 把 AiJudgeBannerProps 转成 view-model · MP page 调一次拿 derived 字段即可渲染.
 * 纯函数 · 易测 · 不依赖 wx API · 满足 Rule 9 Tests verify intent.
 */
export function deriveAiJudgeBannerViewModel(props: AiJudgeBannerProps): AiJudgeBannerViewModel {
  const showMain = props.status === 'DONE' && props.verdict !== null;
  const showFallback = !showMain && props.status !== 'IDLE' && props.status !== 'PENDING';

  const confPct = Math.round((isFinite(props.confidence) ? props.confidence : 0) * 100);
  const latencySec = (props.latencyMs / 1000).toFixed(1);
  const modelName = MODEL_DISPLAY[props.modelUsed] || props.modelUsed || '';
  const modelSubtitle = modelName ? `${modelName} · ${latencySec}s` : `${latencySec}s`;

  return {
    showMain,
    showFallback,
    fallbackI18nKey: showFallback ? (FALLBACK_KEY[props.status] || 'exec.banner.fallback') : null,
    confidencePct: confPct,
    modelSubtitle,
    verdictI18nKey: showMain && props.verdict ? VERDICT_KEY[props.verdict] : null,
    fallbackKind: showFallback ? (FALLBACK_KIND[props.status] || 'unavailable') : null,
  };
}

/**
 * final_grade_source 计算 · 实现 spec §6.3 三态规则 (A.2 双信源溯源宪法).
 *
 * - aiJudge === null OR status !== 'DONE' → 'self' (AI 未判 / 失败 / 退化)
 * - aiJudge.verdict === grade           → 'ai_accepted' (学生采纳)
 * - aiJudge.verdict !== grade           → 'ai_overridden' (学生 override)
 */
export function computeFinalGradeSource(
  grade: AiJudgeVerdict,
  aiJudge: { status: AiJudgeStatus; verdict: AiJudgeVerdict | null } | null,
): 'self' | 'ai_accepted' | 'ai_overridden' {
  if (aiJudge === null || aiJudge.status !== 'DONE' || aiJudge.verdict === null) return 'self';
  if (aiJudge.verdict === grade) return 'ai_accepted';
  return 'ai_overridden';
}
