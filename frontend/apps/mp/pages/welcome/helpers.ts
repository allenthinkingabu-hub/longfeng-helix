// MP-CATCHUP-B-WELCOME · pure helpers (testable without wx runtime)
// trace: design/system/pages/P-LANDING-landing.spec.md §6 状态机

import type { LandingSample, KpiResponse } from '../../src/api/landing';

export type LandingPhase =
  | 'LOADING'
  | 'READY'
  | 'DEGRADED-samples'
  | 'DEGRADED-kpi'
  | 'DEGRADED-both';

export interface LandingSampleVM {
  subject: string;
  stemText: string;
  knowledgePoints: string[];
  errorReason: string;
  correction: string;
}

export interface KpiVM {
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
  kpiQuestionsM: string;
  kpiDailyK: string;
  kpiUsersK: string;
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
    ? (samplesVal as LandingSample[]).map((s) => ({
        subject: s.subject,
        stemText: s.stemText,
        knowledgePoints: s.knowledgePoints || [],
        errorReason: s.errorReason,
        correction: s.correction,
      }))
    : [];
  const kpi: KpiVM | null = kpiOk ? (kpiVal as KpiResponse) : null;

  const showSamples = samplesOk;
  const showKpi = kpiOk;
  const showDegradedBanner = !samplesOk || !kpiOk;
  let degradedMsg = '';
  if (phase === 'DEGRADED-samples') {
    degradedMsg = '样例加载失败 · 直接试试看 →';
  } else if (phase === 'DEGRADED-kpi') {
    degradedMsg = '统计数据暂时无法加载 · 不影响您体验 AI 错题分析';
  } else if (phase === 'DEGRADED-both') {
    degradedMsg = '网络不稳 · CTA 仍可点击进入';
  }

  // KPI 千分化 (避免 wxml filter)
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
