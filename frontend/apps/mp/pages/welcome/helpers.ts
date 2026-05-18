// MP-CATCHUP-B-WELCOME · pure helpers (testable without wx runtime)
// trace: design/system/pages/P-LANDING-landing.spec.md §6 状态机 + §3 SampleChips
//        design/mockups/wrongbook/14_landing.html line 161-194 (sample card 真字段)
//
// 2026-05-18 重写: VM 扩展为 mockup-aligned 字段 (subjectKey/subjectLabel/kpJoined/tnLabel)
// KPI 改为静态性能信号 (不再绑后端 LandingKpiDto) · spec drift surface

import type { LandingSample, KpiResponse } from '../../src/api/landing';

export type LandingPhase =
  | 'LOADING'
  | 'READY'
  | 'DEGRADED-samples'
  | 'DEGRADED-kpi'
  | 'DEGRADED-both';

/** Mockup-aligned sample VM · for wxml horizontal scroll cards + P-SAMPLE overlay */
export interface LandingSampleVM {
  /** Raw subject from backend (数学/英语/物理/...) */
  subject: string;
  /** CSS thumbnail class key: 'math' | 'phys' | 'eng' | 'default' */
  subjectKey: 'math' | 'phys' | 'eng' | 'default';
  /** Display label including grade hint (mockup line 164/175/186) */
  subjectLabel: string;
  /** Question stem text (rendered as formula in mockup) */
  stemText: string;
  /** Joined knowledge points (mockup "知识点 · A / B") */
  kpJoined: string;
  /** Raw KP array (kept for overlay) */
  knowledgePoints: string[];
  /** Why-wrong (mockup line 168/179/190) */
  errorReason: string;
  /** Correction explanation (overlay only) */
  correction: string;
  /** Tn review-schedule chip (mockup line 170/181/192) · assigned by index */
  tnLabel: string;
}

/** Static performance KPI · spec §3 HeroDemo.kpiList (不来自后端) */
export interface KpiVM {
  /** Kept for backward-compat with existing tests · always populated even when API failed */
  cumulativeQuestions: number;
  dailyAnalyses: number;
  happyUsers: number;
}

export interface LandingDerivedState {
  phase: LandingPhase;
  samples: LandingSampleVM[];
  kpi: KpiVM | null;
  showSamples: boolean;
  showKpi: boolean;
  showDegradedBanner: boolean;
  degradedMsg: string;
  // backward-compat for existing e2e — kept always (filled from API or 0)
  kpiQuestionsM: string;
  kpiDailyK: string;
  kpiUsersK: string;
}

// ─── subject mapping (mockup grade fallback · 后端不返 grade) ────────────────
const SUBJECT_MAP: Record<string, { key: LandingSampleVM['subjectKey']; label: string }> = {
  数学: { key: 'math', label: '数学 · 高一' },
  物理: { key: 'phys', label: '物理 · 高二' },
  英语: { key: 'eng', label: '英语 · 初三' },
};

// Tn schedule (mockup 顺序映射 · 后端不返 Tn · 按 sample index 分配)
const TN_LABELS = ['T1 · 1h 后复习', 'T2 · 1d 后复习', 'T3 · 3d 后复习', 'T4 · 7d 后复习'];

function mapSample(s: LandingSample, idx: number): LandingSampleVM {
  const meta = SUBJECT_MAP[s.subject] || { key: 'default' as const, label: s.subject };
  const kp = (s.knowledgePoints || []).filter(Boolean);
  return {
    subject: s.subject,
    subjectKey: meta.key,
    subjectLabel: meta.label,
    stemText: s.stemText,
    knowledgePoints: kp,
    kpJoined: kp.slice(0, 2).join(' / '),
    errorReason: s.errorReason,
    correction: s.correction,
    tnLabel: TN_LABELS[idx] || `T${idx + 1} · 复习`,
  };
}

/**
 * Map (samplesResult, kpiResult) → page state · spec §6 状态机
 * Pure function · 0 wx · 0 setData · 100% testable
 *
 * @param samplesVal — getSamples() result · undefined = rejected
 * @param kpiVal — getKpi() result · undefined = rejected
 */
export function deriveLandingState(
  samplesVal: LandingSample[] | undefined,
  kpiVal: KpiResponse | undefined,
): LandingDerivedState {
  const samplesOk = samplesVal !== undefined;
  const kpiOk = kpiVal !== undefined;

  let phase: LandingPhase;
  if (samplesOk && kpiOk) phase = 'READY';
  else if (!samplesOk && !kpiOk) phase = 'DEGRADED-both';
  else if (!samplesOk) phase = 'DEGRADED-samples';
  else phase = 'DEGRADED-kpi';

  const samples: LandingSampleVM[] = samplesOk
    ? (samplesVal as LandingSample[]).map(mapSample)
    : [];
  const kpi: KpiVM | null = kpiOk ? (kpiVal as KpiResponse) : null;

  const showSamples = samplesOk;
  // showKpi 永远 true · KPI 改静态性能信号 · 与后端 KPI fetch 解耦 (spec drift fix)
  const showKpi = true;
  const showDegradedBanner = !samplesOk;
  let degradedMsg = '';
  if (phase === 'DEGRADED-samples') {
    degradedMsg = '样例加载失败 · 直接试试看 →';
  } else if (phase === 'DEGRADED-both') {
    degradedMsg = '网络不稳 · 直接试试看 →';
  }

  // Backward-compat KPI 千分化 · 给老 e2e 用 · 即使 API fail 也给 0
  const kpiQuestionsM = kpi ? (kpi.cumulativeQuestions / 1_000_000).toFixed(1) : '0.0';
  const kpiDailyK = kpi ? Math.round(kpi.dailyAnalyses / 1000).toString() : '0';
  const kpiUsersK = kpi ? Math.round(kpi.happyUsers / 1000).toString() : '0';

  return {
    phase,
    samples,
    kpi,
    showSamples,
    showKpi,
    showDegradedBanner,
    degradedMsg,
    kpiQuestionsM,
    kpiDailyK,
    kpiUsersK,
  };
}
