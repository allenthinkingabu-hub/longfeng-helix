/**
 * SC-11 landing API · 调 anonymous-service :8090
 * 文档: design/system/pages/P-LANDING-landing.spec.md §5
 * 后端: SC-11-T01 已落 · /api/landing/samples + /api/landing/kpi
 *
 * NOTE: stub-only scaffold from P0 prep. Real impl owed by team B.
 * Convention: use `httpJSON` + `apiBase('anon')` (landing endpoints live on :8090).
 */
import { httpJSON, apiBase } from './_http';

export interface SamplesResponse {
  samples: Array<{
    subject: string;
    errorReason: string;
    correction: string;
    variant?: string;
  }>;
}

export interface KpiResponse {
  totalStudents: number;
  totalQuestions: number;
  avgImproveRate: number;
}

/** TODO: team B · GET /api/landing/samples?bucket={A|B} */
export async function getSamples(_bucket?: string): Promise<SamplesResponse> {
  void httpJSON;
  void apiBase;
  throw new Error('NOT_IMPLEMENTED · team B');
}

/** TODO: team B · GET /api/landing/kpi */
export async function getKpi(): Promise<KpiResponse> {
  void httpJSON;
  void apiBase;
  throw new Error('NOT_IMPLEMENTED · team B');
}
